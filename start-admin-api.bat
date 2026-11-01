@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Khong tim thay Python environment tai .venv\Scripts\python.exe.
  echo Hay tao environment va cai cac goi trong requirements.txt truoc.
  pause
  exit /b 1
)

set "ADMIN_UID=tqwlmVOxlyWXZMDYH7OJDKhRVRI3"
rem Set this to a Firebase Admin service-account JSON outside the project folder.
rem Keep the key private and never commit it.
set "GOOGLE_APPLICATION_CREDENTIALS=C:\Users\Tu\firebase-secrets\catsocial-admin.json.json"
".venv\Scripts\python.exe" main.py
pause
