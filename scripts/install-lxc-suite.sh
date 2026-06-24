#!/usr/bin/env bash
#
# Fresh Debian 13 LXC installer for the full Jellyfin Remote audio suite.
#
# Run inside the LXC as root:
#   apt-get update && apt-get install -y ca-certificates curl
#   curl -fsSL https://raw.githubusercontent.com/seanbrown-com/jellyfin-remote/main/scripts/install-lxc-suite.sh | bash
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

echo "Installing base packages..."
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl git rsync \
  python3 python3-venv python3-pip \
  nodejs npm \
  mpv alsa-utils

if [[ -d "$SRC_DIR/.git" ]]; then
  echo "Updating existing source checkout at $SRC_DIR..."
  git -C "$SRC_DIR" fetch --prune origin
  git -C "$SRC_DIR" checkout "$REPO_REF"
  git -C "$SRC_DIR" pull --ff-only origin "$REPO_REF"
else
  echo "Cloning $REPO_URL to $SRC_DIR..."
  rm -rf "$SRC_DIR"
  git clone --branch "$REPO_REF" "$REPO_URL" "$SRC_DIR"
fi

echo "Installing audio renderer..."
"$SRC_DIR/jf-audio-renderer/scripts/lxc-setup-debian.sh" "$SRC_DIR/jf-audio-renderer"

echo "Installing music controller..."
"$SRC_DIR/jf-music-controller/scripts/lxc-setup-debian.sh" "$SRC_DIR/jf-music-controller"

systemctl daemon-reload
systemctl enable jf-audio-renderer.service jf-music-controller.service

cat <<'MSG'

Install complete.

Before starting playback, verify audio devices inside the LXC:
  aplay -L

Configure the apps:
  http://<lxc-ip>:8787/admin/   audio renderer
  http://<lxc-ip>:8088/admin/   music controller

If you prefer YAML first, edit:
  /etc/jf-audio/config.yaml
  /etc/jf-music/config.yaml

Then start/restart:
  systemctl restart jf-audio-renderer jf-music-controller

Useful checks:
  systemctl status jf-audio-renderer --no-pager
  systemctl status jf-music-controller --no-pager
  journalctl -u jf-audio-renderer -u jf-music-controller -f
MSG
