@echo off
setlocal

cd /d "%~dp0..\backend"

set "PYTHON_EXE=C:\tmp\uv-cache\builds-v0\.tmptjzeE5\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=%~dp0..\backend\venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=py"

"%PYTHON_EXE%" -m uvicorn main:app --host 127.0.0.1 --port 8000
