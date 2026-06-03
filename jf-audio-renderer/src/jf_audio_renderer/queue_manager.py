from __future__ import annotations

import asyncio
import random
from typing import TYPE_CHECKING

from jf_audio_renderer.models import RepeatMode

if TYPE_CHECKING:
    pass


class QueueManager:
    def __init__(self) -> None:
        self._items: list[str] = []
        self._index: int = 0
        self._shuffle: bool = False
        self._repeat: RepeatMode = RepeatMode.NONE
        self._lock = asyncio.Lock()

    async def get_flags(self) -> tuple[bool, RepeatMode]:
        async with self._lock:
            return self._shuffle, self._repeat

    async def snapshot(self) -> tuple[list[str], int]:
        async with self._lock:
            return list(self._items), self._index

    async def set_queue(self, item_ids: list[str], start_index: int = 0) -> None:
        async with self._lock:
            self._items = list(item_ids)
            self._index = max(0, min(start_index, len(self._items) - 1 if self._items else 0))

    async def replace_with(self, item_ids: list[str], play_index: int = 0) -> None:
        async with self._lock:
            self._items = list(item_ids)
            if not self._items:
                self._index = 0
            else:
                self._index = max(0, min(play_index, len(self._items) - 1))

    async def append(self, item_ids: list[str]) -> None:
        async with self._lock:
            self._items.extend(item_ids)

    async def insert_next(self, item_ids: list[str]) -> None:
        async with self._lock:
            pos = min(self._index + 1, len(self._items))
            for i, x in enumerate(item_ids):
                self._items.insert(pos + i, x)

    async def current(self) -> str | None:
        async with self._lock:
            if not self._items:
                return None
            if self._index >= len(self._items):
                self._index = len(self._items) - 1
            return self._items[self._index]

    async def remove_at(self, index: int) -> None:
        async with self._lock:
            if index < 0 or index >= len(self._items):
                return
            self._items.pop(index)
            if not self._items:
                self._index = 0
            elif index < self._index:
                self._index -= 1
            elif self._index >= len(self._items):
                self._index = max(0, len(self._items) - 1)

    async def reorder(self, from_index: int, to_index: int) -> None:
        async with self._lock:
            if from_index < 0 or from_index >= len(self._items):
                return
            if to_index < 0 or to_index >= len(self._items):
                return
            item = self._items.pop(from_index)
            self._items.insert(to_index, item)
            if from_index == self._index:
                self._index = to_index
            else:
                if from_index < self._index <= to_index:
                    self._index -= 1
                elif to_index <= self._index < from_index:
                    self._index += 1

    async def next_track(self) -> str | None:
        async with self._lock:
            if not self._items:
                return None
            if self._repeat == RepeatMode.ONE:
                return self._items[self._index]
            if self._index + 1 < len(self._items):
                self._index += 1
                return self._items[self._index]
            if self._repeat == RepeatMode.ALL:
                self._index = 0
                return self._items[self._index]
            return None

    async def previous_track(self) -> str | None:
        async with self._lock:
            if not self._items:
                return None
            if self._repeat == RepeatMode.ONE:
                return self._items[self._index]
            if self._index > 0:
                self._index -= 1
                return self._items[self._index]
            if self._repeat == RepeatMode.ALL:
                self._index = len(self._items) - 1
                return self._items[self._index]
            return None

    async def set_shuffle(self, enabled: bool) -> None:
        async with self._lock:
            self._shuffle = enabled
            if enabled and len(self._items) > 1:
                cur = self._items[self._index]
                rest = [x for i, x in enumerate(self._items) if i != self._index]
                random.shuffle(rest)
                self._items = [cur] + rest
                self._index = 0

    async def set_repeat(self, mode: RepeatMode) -> None:
        async with self._lock:
            self._repeat = mode
