from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class JellyfinConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    base_url: str
    api_key: str
    user_id: str


class ControllerSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8088
    static_dir: str = "web/dist"


class RendererSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    base_url: str = "http://127.0.0.1:8787"
    token: str = ""


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JF_MUSIC_", env_nested_delimiter="__", extra="ignore")

    jellyfin: Optional[JellyfinConfig] = None
    controller: ControllerSection = Field(default_factory=ControllerSection)
    renderer: RendererSection = Field(default_factory=RendererSection)

    @classmethod
    def from_yaml_dict(cls, data: dict[str, Any]) -> AppConfig:
        jelly = data.get("jellyfin") or {}
        jf: Optional[JellyfinConfig] = None
        if jelly.get("base_url") and jelly.get("api_key") and jelly.get("user_id"):
            jf = JellyfinConfig.model_validate(jelly)
        ctrl = ControllerSection.model_validate(data.get("controller") or {})
        rend = RendererSection.model_validate(data.get("renderer") or {})
        return cls(jellyfin=jf, controller=ctrl, renderer=rend)

    @classmethod
    def load(cls, path: Path) -> AppConfig:
        data: dict[str, Any] = yaml.safe_load(path.read_text()) or {}
        return cls.from_yaml_dict(data)
