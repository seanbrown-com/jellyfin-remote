#!/usr/bin/env bash
#
# Proxmox LXC (Debian 12+) — install JF Music Controller (FastAPI BFF + Vite UI), venv, and systemd.
#
# Usage (inside the LXC, as root):
#   ./scripts/lxc-setup-debian.sh /path/to/jf-music-controller-source
#
# This script installs Node.js from Debian repos to build the static web bundle. The controller
# does not require /dev/snd (only the renderer does).
#
set -euo pipefail

SRC="${1:?Pass the path to the jf-music-controller source tree (this repository directory).}"
DEST="${DEST:-/opt/jf-music-controller}"
CFG="${CFG:-/etc/jf-music/config.yaml}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl \
  python3 python3-venv python3-pip \
  nodejs npm

install -d -m 0755 "$(dirname "$DEST")"
rm -rf "$DEST"
install -d -m 0755 "$DEST"
rsync -a --delete \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.git' \
  --exclude 'web/node_modules' \
  "$SRC"/ "$DEST"/

echo "Building web UI…"
(cd "$DEST/web" && npm ci && npm run build)

python3 -m venv "$DEST/.venv"
"$DEST/.venv/bin/python" -m pip install --upgrade pip
"$DEST/.venv/bin/pip" install -e "$DEST"

install -d -m 0755 /etc/jf-music
if [[ ! -f "$CFG" ]]; then
  install -m 0644 "$DEST/config.example.yaml" "$CFG"
  echo "Installed $CFG — edit jellyfin credentials and renderer.base_url (point at the renderer service)."
fi

install -d -m 0755 /etc/systemd/system
install -m 0644 "$DEST/scripts/systemd/jf-music-controller.service" /etc/systemd/system/jf-music-controller.service

systemctl daemon-reload
systemctl enable jf-music-controller.service || true
echo "Done. Start with: systemctl start jf-music-controller"
echo "Open http://<lxc-ip>:8088 after both services are running."
echo "Optional: export JF_MUSIC_DATA_DIR=/etc/jf-music for encrypted admin storage; browse /admin/ on port 8088."
