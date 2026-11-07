#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "--check" ]]; then
  (cd "$SCRIPT_DIR" && sha256sum --check downloads-SHA256SUMS.txt)
  exit
fi
[[ "$(id -u)" -eq 0 ]] || { echo "请使用 sudo 运行。"; exit 1; }
(cd "$SCRIPT_DIR" && sha256sum --check downloads-SHA256SUMS.txt)
install -d -o root -g root -m 0755 /opt/tripmate/downloads
for name in TripMate-v58-android-v1.1.5.apk TripMate-v54-Windows-1.0.1-Setup.exe; do
  install -o root -g root -m 0644 "$SCRIPT_DIR/downloads/$name" "/opt/tripmate/downloads/$name.tmp.$$"
  mv -f -- "/opt/tripmate/downloads/$name.tmp.$$" "/opt/tripmate/downloads/$name"
done
echo "安卓与 Windows 安装包已放入服务器下载目录。"
