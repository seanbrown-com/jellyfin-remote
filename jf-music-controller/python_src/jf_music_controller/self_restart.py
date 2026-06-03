"""Re-exec the running process (same argv) after configuration changes."""

from __future__ import annotations

import logging
import os
import sys

logger = logging.getLogger(__name__)


def restart_from_background_task() -> None:
    """Replace this OS process with a fresh invocation.

    Intended for use from a FastAPI ``BackgroundTasks`` entry so the HTTP
    response is fully sent before ``exec`` runs. No-op on Windows.
    """
    if sys.platform == "win32":
        logger.warning("In-process restart is not supported on Windows; restart the app manually.")
        return
    argv = sys.argv[:]
    if not argv:
        logger.error("Self-restart skipped: sys.argv is empty")
        return
    program = argv[0]
    try:
        os.execvp(program, argv)
    except OSError:
        logger.exception("Self-restart failed (execvp %r)", program)
