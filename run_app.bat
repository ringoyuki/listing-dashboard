@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo Cross-Platform Product Finder
echo ========================================================
echo.

:INPUT_TITLE1
set "TITLE1="
set /p "TITLE1=Enter Title Suggestion 1 (Required): "
if "%TITLE1%"=="" goto INPUT_TITLE1

:INPUT_TITLE2
set "TITLE2="
set /p "TITLE2=Enter Title Suggestion 2 (Optional, press Enter to skip): "

:INPUT_MGMT
set "MGMT_NUM="
set /p "MGMT_NUM=Enter Management Number (Required): "
if "%MGMT_NUM%"=="" goto INPUT_MGMT

echo.
echo Searching for:
echo   Title 1: %TITLE1%
if not "%TITLE2%"=="" echo   Title 2: %TITLE2%
echo   Mgmt Num: %MGMT_NUM%
echo.

set "KEYWORDS=\"%TITLE1%\""
if not "%TITLE2%"=="" set "KEYWORDS=%KEYWORDS% \"%TITLE2%\""
set "KEYWORDS=%KEYWORDS% \"%MGMT_NUM%\""

echo Running search...
echo Command: product_finder\venv\Scripts\python.exe product_finder\main.py "%MGMT_NUM%" --keywords %KEYWORDS%
echo.

call product_finder\venv\Scripts\python.exe product_finder\main.py "%MGMT_NUM%" --keywords %KEYWORDS%

echo.
echo Search finished.
pause
