#!/bin/bash
set -Eeuo pipefail

cd "${COZE_WORKSPACE_PATH}"
if [ -f "./.cozeproj/scripts/init_env.sh" ]; then
    echo "⚙️ Initializing environment..."
    # 使用 bash 执行，确保即使没有 x 权限也能跑
    bash ./.cozeproj/scripts/init_env.sh
else
    echo "⚠️ Warning: init_env.sh not found, skipping environment init."
fi
echo "Installing dependencies..."
# 安装所有依赖（包含 Taro 核心和 React）
pnpm install

echo "Building the Taro project..."
# 串行构建替代 pnpm build 的 7 任务并发：
# 并发时 web/weapp/tt/admin/tsc 等多个 Node 进程同时驻留，内存峰值可达 3-5GB，
# 部署容器内存有限会被 OOM Kill，导致部署持续失败。
# 串行执行 + 限制单进程堆内存，将峰值控制在容器可承受范围内。
export NODE_OPTIONS="--max-old-space-size=1536 ${NODE_OPTIONS:-}"

echo "[1/7] lint..."
pnpm lint:build

echo "[2/7] tsc..."
pnpm tsc

echo "[3/7] server..."
pnpm build:server

echo "[4/7] admin..."
pnpm build:admin

echo "[5/7] web..."
pnpm build:web

echo "[6/7] weapp..."
pnpm build:weapp

echo "[7/7] tt..."
pnpm build:tt

echo "Build completed successfully! Assets are in /dist"
