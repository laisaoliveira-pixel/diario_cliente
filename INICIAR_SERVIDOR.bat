@echo off
title Diario do Cliente - SRH
cd /d "%~dp0"
color 0A

echo.
echo  =====================================================
echo   Diario do Cliente - BPO Folha
echo   Bernhoeft Contadores Associados
echo  =====================================================
echo.

:: Verifica se PHP esta disponivel
php --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERRO: PHP nao encontrado no PATH!
    echo.
    echo  Como instalar PHP sem XAMPP:
    echo    1. Acesse: https://windows.php.net/download
    echo    2. Baixe a versao "Non Thread Safe" (x64, zip)
    echo    3. Extraia para C:\php
    echo    4. Adicione C:\php ao PATH do sistema
    echo       (Painel de Controle - Sistema - Variaveis de Ambiente)
    echo    5. Reinicie este bat
    echo.
    pause
    exit /b 1
)

echo  PHP encontrado. Iniciando servidor na porta 8080...
echo.
echo  Acesse: http://localhost:8080
echo  Pressione Ctrl+C para encerrar.
echo.

:: Abre o navegador apos 1 segundo
ping -n 2 127.0.0.1 >nul 2>&1
start "" "http://localhost:8080"

:: Inicia o servidor PHP built-in
php -S localhost:8080 router.php

echo.
echo  Servidor encerrado.
pause
