@echo off
REM Deploy Quartermaster Plugin to Test Vault
REM This script copies the built plugin files to the test vault

set SOURCE_DIR=%~dp0dist
set DEST_DIR=C:\Dev\testing-vault\.obsidian\plugins\quartermaster

echo ======================================
echo Deploying Quartermaster to Test Vault
echo ======================================
echo.

REM Check if dist folder exists
if not exist "%SOURCE_DIR%" (
    echo ERROR: dist folder not found!
    echo Please run 'npm run build' first.
    echo.
    pause
    exit /b 1
)

REM Create destination directories if they don't exist
echo Creating directories...
if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"
if not exist "%DEST_DIR%\config" mkdir "%DEST_DIR%\config"
if not exist "%DEST_DIR%\config\templates" mkdir "%DEST_DIR%\config\templates"

REM Copy main plugin files from dist
echo.
echo Copying plugin files...
copy /Y "%SOURCE_DIR%\main.js" "%DEST_DIR%\main.js"
copy /Y "%SOURCE_DIR%\manifest.json" "%DEST_DIR%\manifest.json"
copy /Y "%SOURCE_DIR%\styles.css" "%DEST_DIR%\styles.css"

REM Copy config files from dist
echo.
echo Copying config files...
copy /Y "%SOURCE_DIR%\config\*.yaml" "%DEST_DIR%\config\"

REM Copy templates directory from dist (if it exists)
echo.
echo Copying templates directory...
if exist "%SOURCE_DIR%\config\templates\*.yaml" (
    copy /Y "%SOURCE_DIR%\config\templates\*.yaml" "%DEST_DIR%\config\templates\"
) else (
    echo No custom templates found - templates directory created empty
)

echo.
echo ======================================
echo Deployment complete!
echo ======================================
echo.
echo Files copied to: %DEST_DIR%
echo.
echo Next steps:
echo 1. Open Obsidian
echo 2. Go to Settings ^> Community Plugins
echo 3. Reload the plugin or restart Obsidian
echo.
pause
