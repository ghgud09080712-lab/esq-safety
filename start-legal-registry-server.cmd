@echo off
cd /d "%~dp0"
node backend\server.js >> tmp-legal-server-out.log 2>> tmp-legal-server-err.log
