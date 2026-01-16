@echo off
REM Windows deployment script for Quartermaster Obsidian Plugin
REM
REM Usage: npm run deploy:win
REM   or: .\deploy-windows.bat
REM
REM NOTE: As of the latest update, the deploy script now auto-detects
REM Windows vs WSL environment, so this wrapper is optional.
REM You can use "npm run deploy" directly in either environment.

node scripts/deploy.mjs
