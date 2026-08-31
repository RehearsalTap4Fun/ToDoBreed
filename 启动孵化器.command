#!/bin/bash
# 怪奇生物孵化器 · 双击启动器（本地离线运行，零远端依赖）
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ ! -f dist/index.html ]; then
  echo "首次运行，正在构建……"
  npm run build || { echo "构建失败"; read -n1; exit 1; }
fi
if [ ! -d qmonster-assets/catalog ]; then
  echo "正在同步 QMonster 部件资源……"
  npm run sync:qmonster || echo "（资源同步失败，形象渲染将不可用，但游戏可玩）"
fi

# 已在运行则直接打开页面
if curl -s -o /dev/null "http://localhost:5123"; then
  open "http://localhost:5123"
  exit 0
fi
node scripts/serve.mjs &
SERVER_PID=$!
sleep 1
open "http://localhost:5123"
echo "服务器运行中（关闭此窗口即停止）。"
wait $SERVER_PID
