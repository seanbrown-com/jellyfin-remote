import logging
import os
from pathlib import Path

import uvicorn

from jf_music_controller.app import create_app
from jf_music_controller.config import AppConfig
from jf_music_controller.secure_store import SecurePaths

logger = logging.getLogger(__name__)


def _paths() -> SecurePaths:
    yaml_path = Path(os.environ.get("CONFIG_PATH", "config.yaml")).expanduser()
    return SecurePaths.resolve("JF_MUSIC_", yaml_path)


def _load() -> tuple[AppConfig, SecurePaths]:
    paths = _paths()
    data = paths.load_config_dict()
    cfg = AppConfig.from_yaml_dict(data)
    if cfg.jellyfin is None:
        logger.warning("Jellyfin not configured; music API disabled until /admin/setup completes")
    return cfg, paths


def cli_main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    cfg, paths = _load()
    host = os.environ.get("CONTROLLER_HOST", cfg.controller.host)
    port = int(os.environ.get("CONTROLLER_PORT", str(cfg.controller.port)))
    app = create_app(cfg, paths)
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    cli_main()
