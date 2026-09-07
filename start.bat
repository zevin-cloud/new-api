@echo off
chcp 65001 >nul
title New API Local Dev Launcher

echo ========================================================
echo               New API 本地开发启动器
echo ========================================================
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo [1/2] 正在启动后端服务 (http://localhost:3000)...
start "New API Backend" cmd /k "cd /d %ROOT_DIR% && go run main.go"

echo [2/2] 正在启动前端服务 (http://localhost:5173)...
start "New API Classic Web" cmd /k "cd /d %ROOT_DIR%web\classic && bun run dev -- --port 5173"

echo.
echo ========================================================
echo 服务已在独立窗口中启动：
echo - 后端服务: http://localhost:3000
echo - 前端服务: http://localhost:5173
echo.
echo 如需停止服务，直接关闭对应弹出的命令行窗口即可。
echo ========================================================
pause
