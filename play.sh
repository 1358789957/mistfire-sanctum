#!/usr/bin/env bash
# 在本机启动雾火神殿。手机连同一 Wi-Fi 后访问打印出的地址。
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
echo "雾火神殿  http://127.0.0.1:${PORT}"
if command -v hostname >/dev/null; then
  hostname -I 2>/dev/null | tr ' ' '\n' | while read -r ip; do
    [ -n "$ip" ] && echo "  手机打开  http://${ip}:${PORT}"
  done
fi
echo "Ctrl+C 结束"
python3 -m http.server "$PORT"
