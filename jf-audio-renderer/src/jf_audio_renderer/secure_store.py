from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from cryptography.fernet import Fernet, InvalidToken


def _fernet_from_key_material(raw: bytes) -> Fernet:
    raw = raw.strip()
    if len(raw) == 32:
        return Fernet(base64.urlsafe_b64encode(raw))
    return Fernet(raw)


@dataclass(frozen=True)
class SecurePaths:
    """On-disk layout for encrypted config + admin material (binary files)."""

    data_dir: Path
    config_enc: Path
    key_bin: Path
    admin_bcrypt: Path
    session_secret: Path
    legacy_yaml: Path

    @classmethod
    def resolve(cls, env_prefix: str, default_yaml: Path) -> SecurePaths:
        """
        env_prefix: JF_AUDIO_ or JF_MUSIC_
        Data dir: ${PREFIX}DATA_DIR or parent directory of CONFIG_PATH / legacy_yaml.
        """
        yaml_path = default_yaml.expanduser().resolve()
        raw_data = os.environ.get(f"{env_prefix}DATA_DIR") or os.environ.get("JF_DATA_DIR")
        if raw_data:
            data_dir = Path(raw_data).expanduser().resolve()
        else:
            data_dir = yaml_path.parent
        data_dir.mkdir(parents=True, exist_ok=True)
        return cls(
            data_dir=data_dir,
            config_enc=data_dir / "config.enc",
            key_bin=data_dir / "key.bin",
            admin_bcrypt=data_dir / "admin.bcrypt",
            session_secret=data_dir / "session.secret",
            legacy_yaml=yaml_path,
        )

    def load_config_dict(self) -> dict[str, Any]:
        if self.config_enc.is_file() and self.key_bin.is_file():
            fernet = _fernet_from_key_material(self.key_bin.read_bytes())
            raw = fernet.decrypt(self.config_enc.read_bytes())
            return yaml.safe_load(raw.decode("utf-8")) or {}
        if self.legacy_yaml.is_file():
            return yaml.safe_load(self.legacy_yaml.read_text()) or {}
        return {}

    def save_encrypted_config(self, data: dict[str, Any]) -> None:
        self.data_dir.mkdir(parents=True, mode=0o700, exist_ok=True)
        if not self.key_bin.is_file():
            key_material = os.urandom(32)
            self.key_bin.write_bytes(key_material)
            self.key_bin.chmod(0o600)
        fernet = _fernet_from_key_material(self.key_bin.read_bytes())
        blob = fernet.encrypt(yaml.safe_dump(data, sort_keys=False).encode("utf-8"))
        tmp = self.config_enc.with_suffix(".tmp")
        tmp.write_bytes(blob)
        tmp.replace(self.config_enc)
        self.config_enc.chmod(0o600)

    def admin_configured(self) -> bool:
        return self.admin_bcrypt.is_file() and len(self.admin_bcrypt.read_bytes()) > 0

    def verify_admin_password(self, password: str) -> bool:
        import bcrypt

        if not self.admin_bcrypt.is_file():
            return False
        hashed = self.admin_bcrypt.read_bytes()
        try:
            return bcrypt.checkpw(password.encode("utf-8"), hashed)
        except ValueError:
            return False

    def set_admin_password(self, password: str) -> None:
        import bcrypt

        self.data_dir.mkdir(parents=True, mode=0o700, exist_ok=True)
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12))
        tmp = self.admin_bcrypt.with_suffix(".tmp")
        tmp.write_bytes(hashed)
        tmp.replace(self.admin_bcrypt)
        self.admin_bcrypt.chmod(0o600)

    def ensure_session_secret(self) -> str:
        if not self.session_secret.is_file():
            import secrets

            self.session_secret.write_text(secrets.token_urlsafe(48), encoding="utf-8")
            self.session_secret.chmod(0o600)
        return self.session_secret.read_text(encoding="utf-8").strip()

    def using_encrypted_store(self) -> bool:
        return self.config_enc.is_file() and self.key_bin.is_file()

    def decrypt_or_none(self) -> dict[str, Any] | None:
        if not (self.config_enc.is_file() and self.key_bin.is_file()):
            return None
        try:
            fernet = _fernet_from_key_material(self.key_bin.read_bytes())
            raw = fernet.decrypt(self.config_enc.read_bytes())
            return yaml.safe_load(raw.decode("utf-8")) or {}
        except (InvalidToken, OSError, yaml.YAMLError):
            return None
