@echo off
title UniCord Server
cd /d "%~dp0"
echo ========================================================
echo               STARTING UNICORD WEB APP
echo ========================================================
if exist "C:\Python314\python.exe" (
    "C:\Python314\python.exe" server.py
) else (
    python server.py
)
pause
