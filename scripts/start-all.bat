@echo off
REM ================================================
REM  Quadro do Mane - Bootstrap + Start (Windows)
REM  Pre-requisitos: Docker Desktop rodando, Node 20+, npm 10+, Python 3
REM  Uso: scripts\start-all.bat
REM ================================================

cd /d "%~dp0\.."

echo ================================================
echo   Quadro do Mane - Bootstrap + Start
echo ================================================

REM 1. Garante .env com secrets fortes
if not exist .env (
    echo [1/7] Gerando .env com secrets fortes...
    python scripts\generate_env.py
) else (
    echo [1/7] .env ja existe, mantendo.
)

REM 2. Sobe Postgres + Redis via Docker Compose
echo [2/7] Subindo Postgres + Redis...
docker compose up -d
if errorlevel 1 (
    echo ERRO: Docker nao respondeu. Inicie o Docker Desktop e tente novamente.
    pause
    exit /b 1
)
echo   Aguardando Postgres (15s)...
timeout /t 15 /nobreak >nul

REM 3. Instala dependencias
echo [3/7] Instalando dependencias (pode demorar)...
call npm install
if errorlevel 1 (
    echo ERRO: npm install falhou.
    pause
    exit /b 1
)

REM 4. Migrations + Prisma Client
echo [4/7] Aplicando migrations e gerando Prisma Client...
cd apps\api
call npx prisma migrate deploy
call npx prisma generate
cd ..\..

REM 5. Seed
echo [5/7] Executando seed...
cd apps\api
call npm run seed
cd ..\..

REM 6. Sobe API em nova janela
echo [6/7] Subindo API na porta 3001...
start "Quadro API" cmd /k "cd apps\api && npm run dev"

REM 7. Sobe Web em nova janela
echo [7/7] Subindo Web na porta 3000...
timeout /t 3 /nobreak >nul
start "Quadro Web" cmd /k "cd apps\web && npm run dev"

echo.
echo ================================================
echo   Servicos iniciados!
echo ================================================
echo   API:    http://localhost:3001/api
echo   Docs:   http://localhost:3001/api/docs
echo   Web:    http://localhost:3000
echo.
echo   Login padrao:
echo     Email: admin@quadrodomane.local
echo     Senha: AlterarNoPrimeiroLogin123!
echo.
echo   Para parar: feche as janelas "Quadro API" e "Quadro Web"
echo ================================================
pause