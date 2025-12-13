@echo off
cd /d "%~dp0"

echo Iniciando TCG Tool...
echo.

REM Arranca servidor
start cmd /k uvicorn app:app --host 127.0.0.1 --port 8000

REM Esperar 2 segundos para que el servidor levante
timeout /t 2 > nul

REM Abrir navegador
start http://127.0.0.1:8000
