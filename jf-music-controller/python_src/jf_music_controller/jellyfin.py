from __future__ import annotations

from typing import Any

import httpx

from jf_music_controller.config import JellyfinConfig


def _primary_tag(item: dict[str, Any]) -> str | None:
    tags = item.get("ImageTags") or {}
    return tags.get("Primary")


class JellyfinBrowser:
    def __init__(self, cfg: JellyfinConfig) -> None:
        self._cfg = cfg
        self._base = cfg.base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base,
            headers={
                "X-Emby-Token": cfg.api_key,
                "X-Emby-Authorization": 'MediaBrowser Client="JF Music Controller", Device="Web", DeviceId="jf-music-web", Version="0.1"',
            },
            timeout=httpx.Timeout(60.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    def image_url(self, item_id: str, tag: str | None, max_width: int = 480) -> str:
        t = tag or ""
        q = f"tag={t}&format=Webp&maxWidth={max_width}" if t else f"format=Webp&maxWidth={max_width}"
        return f"{self._base}/Items/{item_id}/Images/Primary?{q}&api_key={self._cfg.api_key}"

    async def _items(self, **params: Any) -> dict[str, Any]:
        r = await self._client.get(f"/Users/{self._cfg.user_id}/Items", params=params)
        r.raise_for_status()
        return r.json()

    async def get_item(self, item_id: str) -> dict[str, Any]:
        r = await self._client.get(
            f"/Users/{self._cfg.user_id}/Items/{item_id}",
            params={"Fields": "MediaSources,ParentId,Album,AlbumArtist,Artists,IndexNumber,RunTimeTicks,ChildCount,ProductionYear,ImageTags"},
        )
        r.raise_for_status()
        return r.json()

    def normalize_artist(self, item: dict[str, Any]) -> dict[str, Any]:
        iid = item["Id"]
        tag = _primary_tag(item)
        return {
            "id": iid,
            "name": item.get("Name") or "Unknown",
            "imageUrl": f"/api/image/{iid}?maxWidth=480" if tag else None,
        }

    def normalize_album(self, item: dict[str, Any]) -> dict[str, Any]:
        iid = item["Id"]
        tag = _primary_tag(item)
        artist = item.get("AlbumArtist") or ""
        return {
            "id": iid,
            "name": item.get("Name") or "Unknown",
            "artist": artist,
            "artistId": None,
            "year": item.get("ProductionYear"),
            "imageUrl": f"/api/image/{iid}?maxWidth=480" if tag else None,
            "trackCount": item.get("ChildCount"),
        }

    def normalize_track(self, item: dict[str, Any]) -> dict[str, Any]:
        iid = item["Id"]
        tag = _primary_tag(item)
        raw_artists = item.get("AlbumArtist") or item.get("Artists") or []
        if isinstance(raw_artists, str):
            artists = [raw_artists]
        elif isinstance(raw_artists, list):
            artists = [str(a) for a in raw_artists]
        else:
            artists = []
        return {
            "id": iid,
            "name": item.get("Name") or "Unknown",
            "artists": artists,
            "album": item.get("Album") or "",
            "albumId": item.get("AlbumId") or item.get("ParentId") or "",
            "indexNumber": item.get("IndexNumber"),
            "discNumber": item.get("ParentIndexNumber"),
            "durationTicks": item.get("RunTimeTicks"),
            "imageUrl": f"/api/image/{iid}?maxWidth=320" if tag else None,
        }

    async def recently_added_albums(self, limit: int = 24) -> list[dict[str, Any]]:
        data = await self._items(
            IncludeItemTypes="MusicAlbum",
            Recursive="true",
            SortBy="DateCreated",
            SortOrder="Descending",
            Limit=limit,
            Fields="PrimaryImageTag,ProductionYear,ChildCount,AlbumArtist",
        )
        return [self.normalize_album(x) for x in data.get("Items") or []]

    async def favorite_albums(self, limit: int = 24) -> list[dict[str, Any]]:
        data = await self._items(
            IncludeItemTypes="MusicAlbum",
            Recursive="true",
            Filters="IsFavorite",
            SortBy="SortName",
            SortOrder="Ascending",
            Limit=limit,
            Fields="PrimaryImageTag,ProductionYear,ChildCount,AlbumArtist",
        )
        return [self.normalize_album(x) for x in data.get("Items") or []]

    async def recently_played(self, limit: int = 16) -> list[dict[str, Any]]:
        data = await self._items(
            IncludeItemTypes="Audio",
            Recursive="true",
            SortBy="DatePlayed",
            SortOrder="Descending",
            Limit=limit,
            Fields="PrimaryImageTag,Album,AlbumArtist,ParentId,Type",
        )
        items = []
        for x in data.get("Items") or []:
            if x.get("Type") == "Audio":
                items.append(self.normalize_track(x))
        return items

    async def playlists(self) -> list[dict[str, Any]]:
        data = await self._items(
            IncludeItemTypes="Playlist",
            Recursive="true",
            SortBy="SortName",
            Fields="PrimaryImageTag",
        )
        out = []
        for x in data.get("Items") or []:
            iid = x["Id"]
            tag = _primary_tag(x)
            out.append(
                {
                    "id": iid,
                    "name": x.get("Name") or "Playlist",
                    "imageUrl": f"/api/image/{iid}?maxWidth=480" if tag else None,
                }
            )
        return out

    async def playlist_tracks(self, playlist_id: str) -> list[dict[str, Any]]:
        data = await self._items(
            ParentId=playlist_id,
            IncludeItemTypes="Audio",
            SortBy="IndexNumber",
            Fields="PrimaryImageTag,Album,AlbumArtist,Artists,RunTimeTicks,ParentId,AlbumId",
        )
        return [self.normalize_track(x) for x in data.get("Items") or []]

    async def artists(self, start_index: int = 0, limit: int = 100) -> list[dict[str, Any]]:
        data = await self._items(
            IncludeItemTypes="MusicArtist",
            Recursive="true",
            SortBy="SortName",
            SortOrder="Ascending",
            StartIndex=start_index,
            Limit=limit,
            Fields="PrimaryImageTag",
        )
        return [self.normalize_artist(x) for x in data.get("Items") or []]

    async def artist_albums(self, artist_id: str) -> list[dict[str, Any]]:
        data = await self._items(
            IncludeItemTypes="MusicAlbum",
            Recursive="true",
            ArtistIds=artist_id,
            SortBy="ProductionYear,SortName",
            Fields="PrimaryImageTag,ProductionYear,ChildCount,AlbumArtist",
        )
        return [self.normalize_album(x) for x in data.get("Items") or []]

    async def albums(self, start_index: int = 0, limit: int = 48) -> list[dict[str, Any]]:
        data = await self._items(
            IncludeItemTypes="MusicAlbum",
            Recursive="true",
            SortBy="SortName",
            SortOrder="Ascending",
            StartIndex=start_index,
            Limit=limit,
            Fields="PrimaryImageTag,ProductionYear,ChildCount,AlbumArtist",
        )
        return [self.normalize_album(x) for x in data.get("Items") or []]

    async def album_detail(self, album_id: str) -> dict[str, Any]:
        item = await self.get_item(album_id)
        return self.normalize_album(item)

    async def album_tracks(self, album_id: str) -> list[dict[str, Any]]:
        data = await self._items(
            ParentId=album_id,
            IncludeItemTypes="Audio",
            SortBy="IndexNumber,ParentIndexNumber",
            Fields="PrimaryImageTag,Album,AlbumArtist,Artists,RunTimeTicks,AlbumId,ParentId",
        )
        return [self.normalize_track(x) for x in data.get("Items") or []]

    async def track_detail(self, track_id: str) -> dict[str, Any]:
        item = await self.get_item(track_id)
        return self.normalize_track(item)

    async def songs(self, start_index: int = 0, limit: int = 100) -> list[dict[str, Any]]:
        data = await self._items(
            IncludeItemTypes="Audio",
            Recursive="true",
            SortBy="SortName",
            SortOrder="Ascending",
            StartIndex=start_index,
            Limit=limit,
            Fields="PrimaryImageTag,Album,AlbumArtist,Artists,RunTimeTicks,AlbumId,ParentId",
        )
        return [self.normalize_track(x) for x in data.get("Items") or []]

    async def genres(self) -> list[dict[str, Any]]:
        data = await self._items(
            IncludeItemTypes="MusicGenre",
            Recursive="true",
            SortBy="SortName",
            Fields="PrimaryImageTag",
        )
        out = []
        for x in data.get("Items") or []:
            iid = x["Id"]
            tag = _primary_tag(x)
            out.append(
                {
                    "id": iid,
                    "name": x.get("Name") or "Genre",
                    "imageUrl": f"/api/image/{iid}?maxWidth=320" if tag else None,
                }
            )
        return out

    async def genre_items(self, genre_id: str, limit: int = 100) -> list[dict[str, Any]]:
        data = await self._items(
            GenreIds=genre_id,
            IncludeItemTypes="MusicAlbum",
            Recursive="true",
            Limit=limit,
            Fields="PrimaryImageTag,ProductionYear,ChildCount,AlbumArtist",
        )
        return [self.normalize_album(x) for x in data.get("Items") or []]

    async def search(self, q: str, limit: int = 30) -> dict[str, list[dict[str, Any]]]:
        if not q.strip():
            return {"artists": [], "albums": [], "tracks": [], "playlists": []}
        r = await self._client.get(
            f"/Users/{self._cfg.user_id}/Items",
            params={
                "SearchTerm": q,
                "IncludeItemTypes": "MusicArtist,MusicAlbum,Audio,Playlist",
                "Recursive": "true",
                "Limit": limit,
                "Fields": "PrimaryImageTag,ProductionYear,ChildCount,AlbumArtist,Album,Artists,RunTimeTicks,AlbumId,ParentId",
            },
        )
        r.raise_for_status()
        data = r.json()
        artists, albums, tracks, playlists = [], [], [], []
        for x in data.get("Items") or []:
            t = x.get("Type")
            if t == "MusicArtist":
                artists.append(self.normalize_artist(x))
            elif t == "MusicAlbum":
                albums.append(self.normalize_album(x))
            elif t == "Audio":
                tracks.append(self.normalize_track(x))
            elif t == "Playlist":
                iid = x["Id"]
                tag = _primary_tag(x)
                playlists.append(
                    {
                        "id": iid,
                        "name": x.get("Name") or "Playlist",
                        "imageUrl": f"/api/image/{iid}?maxWidth=320" if tag else None,
                    }
                )
        return {"artists": artists, "albums": albums, "tracks": tracks, "playlists": playlists}

    async def fetch_primary_image(self, item_id: str, max_width: int = 480) -> tuple[bytes, str]:
        r = await self._client.get(
            f"/Items/{item_id}/Images/Primary",
            params={"maxWidth": max_width, "format": "Webp"},
        )
        r.raise_for_status()
        ct = r.headers.get("content-type", "image/webp")
        return r.content, ct
