from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.templating import Jinja2Templates

from jf_music_controller.config import AppConfig
from jf_music_controller.secure_store import SecurePaths
from jf_music_controller.self_restart import restart_from_background_task

logger = logging.getLogger(__name__)

_TEMPLATES = Jinja2Templates(directory=str(Path(__file__).parent / "templates" / "admin"))


def _ctx(request: Request, **extra: Any) -> dict[str, Any]:
    return {"request": request, **extra}


def _render(name: str, context: dict[str, Any], *, status_code: int = 200) -> HTMLResponse:
    return _TEMPLATES.TemplateResponse(context["request"], name, context, status_code=status_code)


def _template_flat(data: dict[str, Any]) -> dict[str, Any]:
    cfg = AppConfig.from_yaml_dict(data)
    jf = cfg.jellyfin
    jelly = {
        "base_url": jf.base_url if jf else (data.get("jellyfin") or {}).get("base_url", ""),
        "api_key": jf.api_key if jf else (data.get("jellyfin") or {}).get("api_key", ""),
        "user_id": jf.user_id if jf else (data.get("jellyfin") or {}).get("user_id", ""),
    }
    return {
        "jellyfin": jelly,
        "controller": cfg.controller.model_dump(),
        "renderer": cfg.renderer.model_dump(),
    }


def _dict_from_form_music(form: dict[str, str]) -> dict[str, Any]:
    jellyfin = {
        "base_url": (form.get("jellyfin_base_url") or "").strip().rstrip("/"),
        "api_key": (form.get("jellyfin_api_key") or "").strip(),
        "user_id": (form.get("jellyfin_user_id") or "").strip(),
    }
    controller = {
        "host": (form.get("controller_host") or "0.0.0.0").strip(),
        "port": int(form.get("controller_port") or 8088),
        "static_dir": (form.get("controller_static_dir") or "web/dist").strip(),
    }
    renderer = {
        "base_url": (form.get("renderer_base_url") or "http://127.0.0.1:8787").strip().rstrip("/"),
        "token": (form.get("renderer_token") or "").strip(),
    }
    out: dict[str, Any] = {"controller": controller, "renderer": renderer}
    if jellyfin["base_url"] and jellyfin["api_key"] and jellyfin["user_id"]:
        out["jellyfin"] = jellyfin
    return out


def register_admin(app: FastAPI, paths: SecurePaths) -> None:
    secret = paths.ensure_session_secret()
    app.add_middleware(
        SessionMiddleware,
        secret_key=secret,
        max_age=7 * 24 * 3600,
        same_site="lax",
        https_only=False,
    )

    router = APIRouter(prefix="/admin", tags=["admin"])
    service = "JF Music Controller"

    @router.get("/login", response_class=HTMLResponse)
    async def admin_login_get(request: Request):
        if paths.admin_configured() and request.session.get("admin") == "1":
            return RedirectResponse("/admin/", status_code=303)
        return _render("login.html", _ctx(request, service=service, error=None))

    @router.post("/login", response_class=HTMLResponse)
    async def admin_login_post(request: Request, password: str = Form(...)):
        if not paths.admin_configured():
            return RedirectResponse("/admin/setup", status_code=303)
        if not paths.verify_admin_password(password):
            return _render(
                "login.html",
                _ctx(request, service=service, error="Invalid password."),
                status_code=401,
            )
        request.session["admin"] = "1"
        return RedirectResponse("/admin/", status_code=303)

    @router.get("/logout")
    async def admin_logout(request: Request):
        request.session.clear()
        return RedirectResponse("/admin/login", status_code=303)

    @router.get("/setup", response_class=HTMLResponse)
    async def admin_setup_get(request: Request):
        if paths.admin_configured():
            return RedirectResponse("/admin/login", status_code=303)
        raw = paths.load_config_dict()
        flat = _template_flat(raw if raw else {})
        return _render("setup.html", _ctx(request, service=service, error=None, **flat))

    @router.post("/setup", response_class=HTMLResponse)
    async def admin_setup_post(
        request: Request,
        password: str = Form(...),
        password2: str = Form(...),
        jellyfin_base_url: str = Form(""),
        jellyfin_api_key: str = Form(""),
        jellyfin_user_id: str = Form(""),
        controller_host: str = Form(""),
        controller_port: str = Form(""),
        controller_static_dir: str = Form(""),
        renderer_base_url: str = Form(""),
        renderer_token: str = Form(""),
    ):
        if paths.admin_configured():
            return RedirectResponse("/admin/login", status_code=303)
        if password != password2:
            flat = _template_flat(
                {
                    "jellyfin": {
                        "base_url": jellyfin_base_url,
                        "api_key": jellyfin_api_key,
                        "user_id": jellyfin_user_id,
                    },
                    "controller": {},
                    "renderer": {},
                },
            )
            return _render(
                "setup.html",
                _ctx(request, service=service, error="Passwords do not match.", **flat),
                status_code=400,
            )
        form = {
            "jellyfin_base_url": jellyfin_base_url,
            "jellyfin_api_key": jellyfin_api_key,
            "jellyfin_user_id": jellyfin_user_id,
            "controller_host": controller_host,
            "controller_port": controller_port,
            "controller_static_dir": controller_static_dir,
            "renderer_base_url": renderer_base_url,
            "renderer_token": renderer_token,
        }
        data = _dict_from_form_music(form)
        if "jellyfin" not in data:
            flat = _template_flat(data)
            return _render(
                "setup.html",
                _ctx(request, service=service, error="Jellyfin base URL, API key, and user id are required.", **flat),
                status_code=400,
            )
        paths.set_admin_password(password)
        paths.save_encrypted_config(data)
        request.session["admin"] = "1"
        logger.info("Admin bootstrap complete; encrypted config at %s", paths.config_enc)
        return HTMLResponse(
            "<!doctype html><html><body style='background:#0b0b10;color:#eee;font-family:sans-serif;padding:24px'>"
            "<h1>Setup complete</h1><p>Open <strong>Admin</strong> and use <strong>Restart service</strong> if listen host, port, or static path must take effect.</p>"
            "<p><a style='color:#c4b5fd' href='/admin/'>Open admin</a></p></body></html>",
            status_code=200,
        )

    @router.get("/", response_class=HTMLResponse)
    async def admin_dashboard_get(request: Request):
        if not paths.admin_configured():
            return RedirectResponse("/admin/setup", status_code=303)
        if request.session.get("admin") != "1":
            return RedirectResponse("/admin/login", status_code=303)
        raw = paths.load_config_dict()
        flat = _template_flat(raw)
        return _render(
            "dashboard_music.html",
            _ctx(request, service=service, error=None, message=None, encrypted=paths.using_encrypted_store(), **flat),
        )

    @router.post("/save", response_class=HTMLResponse)
    async def admin_save_post(
        request: Request,
        new_password: str = Form(""),
        new_password2: str = Form(""),
        jellyfin_base_url: str = Form(""),
        jellyfin_api_key: str = Form(""),
        jellyfin_user_id: str = Form(""),
        controller_host: str = Form(""),
        controller_port: str = Form(""),
        controller_static_dir: str = Form(""),
        renderer_base_url: str = Form(""),
        renderer_token: str = Form(""),
    ):
        if not paths.admin_configured():
            return RedirectResponse("/admin/setup", status_code=303)
        if request.session.get("admin") != "1":
            return RedirectResponse("/admin/login", status_code=303)
        if new_password or new_password2:
            if new_password != new_password2:
                raw = paths.load_config_dict()
                flat = _template_flat(raw)
                return _render(
                    "dashboard_music.html",
                    _ctx(
                        request,
                        service=service,
                        error="New passwords do not match.",
                        message=None,
                        encrypted=paths.using_encrypted_store(),
                        **flat,
                    ),
                    status_code=400,
                )
            if new_password:
                paths.set_admin_password(new_password)
        form = {
            "jellyfin_base_url": jellyfin_base_url,
            "jellyfin_api_key": jellyfin_api_key,
            "jellyfin_user_id": jellyfin_user_id,
            "controller_host": controller_host,
            "controller_port": controller_port,
            "controller_static_dir": controller_static_dir,
            "renderer_base_url": renderer_base_url,
            "renderer_token": renderer_token,
        }
        data = _dict_from_form_music(form)
        if "jellyfin" not in data:
            raw = paths.load_config_dict()
            flat = _template_flat(raw)
            return _render(
                "dashboard_music.html",
                _ctx(
                    request,
                    service=service,
                    error="Jellyfin base URL, API key, and user id are required.",
                    message=None,
                    encrypted=paths.using_encrypted_store(),
                    **flat,
                ),
                status_code=400,
            )
        paths.save_encrypted_config(data)
        flat = _template_flat(data)
        return _render(
            "dashboard_music.html",
            _ctx(
                request,
                service=service,
                error=None,
                message="Saved encrypted configuration. Use Restart service below to apply listen host/port and static directory.",
                encrypted=True,
                **flat,
            ),
        )

    @router.post("/restart", response_class=HTMLResponse)
    async def admin_restart_post(request: Request, background_tasks: BackgroundTasks):
        if not paths.admin_configured():
            return RedirectResponse("/admin/setup", status_code=303)
        if request.session.get("admin") != "1":
            return RedirectResponse("/admin/login", status_code=303)
        if sys.platform == "win32":
            return HTMLResponse(
                "<!doctype html><html><body style='background:#0b0b10;color:#eee;font-family:sans-serif;padding:24px'>"
                "<h1>Restart not available</h1>"
                "<p>In-process restart is not supported on Windows. Stop and start <code>jf-music-controller</code> from your environment.</p>"
                "<p><a style='color:#c4b5fd' href='/admin/'>Back to admin</a></p></body></html>",
                status_code=200,
            )
        background_tasks.add_task(restart_from_background_task)
        return HTMLResponse(
            "<!doctype html><html><head><meta charset='utf-8'><title>Restarting</title></head>"
            "<body style='background:#0b0b10;color:#eee;font-family:sans-serif;padding:24px'>"
            "<h1>Restarting…</h1>"
            "<p>The process is being replaced with a fresh start. Open browser tabs may need a refresh.</p>"
            "<p><a style='color:#c4b5fd' href='/admin/'>Open admin</a></p>"
            "<script>setTimeout(function(){ location.href='/admin/'; }, 4000);</script>"
            "</body></html>",
            status_code=200,
        )

    app.include_router(router)
