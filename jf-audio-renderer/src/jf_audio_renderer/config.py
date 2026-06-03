from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class JellyfinConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    base_url: str = Field(..., description="Jellyfin server root URL, no trailing slash")
    api_key: str
    user_id: str
    device_id: str = "jf-audio-renderer-1"
    device_name: str = "JF Audio Renderer"


class RendererSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8787
    mpv_socket: str = "/run/jf-audio/mpv.sock"
    audio_device: str = "alsa/default"
    default_volume: int = 80
    api_token: str = ""


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="JF_AUDIO_",
        env_nested_delimiter="__",
        extra="ignore",
    )

    config_path: Optional[Path] = Field(default=None, validation_alias="CONFIG_PATH")

    jellyfin: Optional[JellyfinConfig] = None
    renderer: RendererSection = Field(default_factory=RendererSection)

    @classmethod
    def from_yaml_dict(cls, data: dict[str, Any], *, config_path: Optional[Path] = None) -> AppConfig:
        jelly = data.get("jellyfin") or {}
        rend = data.get("renderer") or {}
        jf: Optional[JellyfinConfig] = None
        if jelly.get("base_url") and jelly.get("api_key") and jelly.get("user_id"):
            jf = JellyfinConfig(
                base_url=str(jelly["base_url"]).rstrip("/"),
                api_key=str(jelly["api_key"]),
                user_id=str(jelly["user_id"]),
                device_id=str(jelly.get("device_id") or "jf-audio-renderer-1"),
                device_name=str(jelly.get("device_name") or "JF Audio Renderer"),
            )
        renderer = RendererSection.model_validate(rend) if rend else RendererSection()
        return cls(config_path=config_path, jellyfin=jf, renderer=renderer)

    @classmethod
    def load(cls, path: Optional[Path]) -> AppConfig:
        if path is None or not path.exists():
            return cls()
        data: dict[str, Any] = yaml.safe_load(path.read_text()) or {}
        return cls.from_yaml_dict(data, config_path=path)
