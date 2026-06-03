from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RepeatMode(str, Enum):
    NONE = "none"
    ONE = "one"
    ALL = "all"


class PlayMode(str, Enum):
    REPLACE_QUEUE = "replaceQueue"
    APPEND = "append"
    PLAY_NOW = "playNow"


class PlayRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    item_id: str | None = Field(None, alias="itemId")
    mode: PlayMode = PlayMode.REPLACE_QUEUE
    queue: list[str] = Field(default_factory=list)


class SeekRequest(BaseModel):
    seconds: float


class VolumeRequest(BaseModel):
    volume: int = Field(ge=0, le=100)


class QueueSetRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    item_ids: list[str] = Field(..., alias="itemIds")


class QueueReorderRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_index: int = Field(..., alias="fromIndex")
    to_index: int = Field(..., alias="toIndex")


class PlayerState(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    state: Literal["idle", "playing", "paused", "stopped"]
    item_id: str | None = Field(None, alias="itemId")
    title: str | None = None
    album: str | None = None
    artists: list[str] = Field(default_factory=list)
    position: float = 0.0
    duration: float | None = None
    volume: int = 80
    shuffle: bool = False
    repeat: RepeatMode = RepeatMode.NONE
    image_tag: str | None = Field(None, alias="imageTag")
