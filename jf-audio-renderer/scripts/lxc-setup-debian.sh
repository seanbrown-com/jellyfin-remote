#!/usr/bin/env bash
#
# Proxmox LXC (Debian 13, compatible with Debian 12+) — install JF Audio Renderer dependencies, venv, and systemd.
#
# Usage (inside the LXC, as root):
#   ./scripts/lxc-setup-debian.sh /path/to/jf-audio-renderer-source
#
# On the Proxmox host (before running this script), ensure audio is passed through, e.g. in
# /etc/pve/lxc/<vmid>.conf (exact lines depend on Proxmox version and privileges):
#   lxc.cgroup2.devices.allow: c 116:* rwm
#   lxc.mount.entry: /dev/snd dev/snd none bind,optional,create=dir
#
# Then verify inside the container:
#   aplay -L
#
set -euo pipefail

SRC="${1:?Pass the path to the jf-audio-renderer source tree (this repository directory).}"
DEST="${DEST:-/opt/jf-audio-renderer}"
CFG="${CFG:-/etc/jf-audio/config.yaml}"
SRC="$(realpath "$SRC")"
DEST="$(realpath -m "$DEST")"
CFG="$(realpath -m "$CFG")"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl rsync \
  python3 python3-venv python3-pip \
  mpv alsa-utils

cd /
install -d -m 0755 "$(dirname "$DEST")"
rm -rf "$DEST"
install -d -m 0755 "$DEST"
rsync -a --delete \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.git' \
  "$SRC"/ "$DEST"/

python3 -m venv "$DEST/.venv"
"$DEST/.venv/bin/python" -m pip install --upgrade pip
"$DEST/.venv/bin/pip" install -e "$DEST"

install -d -m 0755 /etc/jf-audio
if [[ ! -f "$CFG" ]]; then
  install -m 0644 "$DEST/config.example.yaml" "$CFG"
  echo "Installed $CFG — edit jellyfin credentials and renderer.audio_device before starting the service."
fi

install -d -m 0755 /etc/systemd/system
install -m 0644 "$DEST/scripts/systemd/jf-audio-renderer.service" /etc/systemd/system/jf-audio-renderer.service

systemctl daemon-reload
systemctl enable jf-audio-renderer.service || true
echo "Done. Start with: systemctl start jf-audio-renderer"
echo "Optional: export JF_AUDIO_DATA_DIR=/etc/jf-audio so encrypted config (config.enc, key.bin, admin.bcrypt) lives with your secrets; use https://<host>:8787/admin/ to configure."
