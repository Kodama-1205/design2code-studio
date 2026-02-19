@echo off
chcp 65001 >nul
set NODE_OPTIONS=--no-warnings
cd /d "%~dp0.."
npm run dev
exit /b %ERRORLEVEL%
