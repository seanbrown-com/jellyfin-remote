from __future__ import annotations

import logging
import os
from pathlib import Path

import uvicorn

from jf_audio_renderer.api import create_app
from jf_audio_renderer.config import AppConfig
from jf_audio_renderer.secure_store import SecurePaths

logger = logging.getLogger(__name__)


def _paths() -> SecurePaths:
    yaml_path = Path(os.environ.get("CONFIG_PATH", "config.yaml")).expanduser()
    return SecurePaths.resolve("JF_AUDIO_", yaml_path)


def _load_config() -> tuple[AppConfig, SecurePaths]:
    paths = _paths()
    data = paths.load_config_dict()
    cfg = AppConfig.from_yaml_dict(data, config_path=paths.legacy_yaml if paths.legacy_yaml.is_file() else None)
    if cfg.jellyfin is None:
        logger.warning("Jellyfin is not configured; player API is disabled until settings are completed via /admin/setup")
    return cfg, paths


def cli_main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    cfg, paths = _load_config()
    host = os.environ.get("RENDERER_HOST", cfg.renderer.host)
    port = int(os.environ.get("RENDERER_PORT", str(cfg.renderer.port)))
    app = create_app(cfg, paths)
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    cli_main()
