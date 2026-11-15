#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$SCRIPT_DIR/downloads"
for name in TripMate-v58-android-v1.1.5.apk TripMate-v54-Windows-1.0.1-Setup.exe; do
  expected="$(awk -v target="downloads/$name" '$2 == target {print $1}' "$SCRIPT_DIR/downloads-SHA256SUMS.txt")"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || { echo "缺少安装文件校验值。"; exit 1; }
  valid_file() { [[ -f "$1" ]] && printf '%s  %s\n' "$expected" "$1" | sha256sum --check --status; }
  if valid_file "$SCRIPT_DIR/downloads/$name"; then continue; fi
  if valid_file "/opt/tripmate/downloads/$name"; then
    cp -- "/opt/tripmate/downloads/$name" "$SCRIPT_DIR/downloads/$name"
    continue
  fi
  case "$name" in
    TripMate-v58-android-v1.1.5.apk) release=v58 ;;
    TripMate-v54-Windows-1.0.1-Setup.exe) release=v54 ;;
  esac
  echo "准备 $name（已有完整安装包时跳过下载）"
  curl -fL --retry 3 --connect-timeout 15 -C - "https://github.com/xuantingjiang39/TripMate/releases/download/$release/$name" -o "$SCRIPT_DIR/downloads/$name.part"
  valid_file "$SCRIPT_DIR/downloads/$name.part" || { echo "安装文件校验失败，未更新服务。请检查下载缓存后重试。"; exit 1; }
  mv -f -- "$SCRIPT_DIR/downloads/$name.part" "$SCRIPT_DIR/downloads/$name"
done
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
