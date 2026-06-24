#!/usr/bin/env bash
#
# Pull the latest Jellyfin Remote suite from GitHub and redeploy both services.
#
# Run inside the LXC as root:
#   /opt/jellyfin-remote-src/scripts/update-lxc-suite.sh
#
# Optional environment overrides:
#   REPO_URL=https://github.com/seanbrown-com/jellyfin-remote.git
#   REPO_REF=main
#   SRC_DIR=/opt/jellyfin-remote-src
#
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/seanbrown-com/jellyfin-remote.git}"
REPO_REF="${REPO_REF:-main}"
SRC_DIR="${SRC_DIR:-/opt/jellyfin-remote-src}"

if [[ "$(id -u)" != "0" ]]; then
  echo "Run this script as root inside the LXC." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl git rsync \
  python3 python3-venv python3-pip \
  nodejs npm \
  mpv alsa-utils

if [[ -d "$SRC_DIR/.git" ]]; then
  echo "Pulling latest source in $SRC_DIR..."
  git -C "$SRC_DIR" fetch --prune origin
  git -C "$SRC_DIR" checkout "$REPO_REF"
  git -C "$SRC_DIR" pull --ff-only origin "$REPO_REF"
else
  echo "Source checkout missing; cloning $REPO_URL to $SRC_DIR..."
  rm -rf "$SRC_DIR"
  git clone --branch "$REPO_REF" "$REPO_URL" "$SRC_DIR"
fi

echo "Stopping services..."
systemctl stop jf-music-controller.service jf-audio-renderer.service || true

echo "Redeploying audio renderer..."
"$SRC_DIR/jf-audio-renderer/scripts/lxc-setup-debian.sh" "$SRC_DIR/jf-audio-renderer"

echo "Redeploying music controller..."
"$SRC_DIR/jf-music-controller/scripts/lxc-setup-debian.sh" "$SRC_DIR/jf-music-controller"

systemctl daemon-reload
systemctl restart jf-audio-renderer.service jf-music-controller.service

cat <<'MSG'

Update complete.

Current status:
  systemctl status jf-audio-renderer --no-pager
  systemctl status jf-music-controller --no-pager

Logs:
  journalctl -u jf-audio-renderer -u jf-music-controller -f
MSG
