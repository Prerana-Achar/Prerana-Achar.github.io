param([switch]$Setup, [string]$PythonPath = '', [int]$Port = 18765)
$ErrorActionPreference = 'Stop'
$practiceRoot = $PSScriptRoot
$practicePython = Join-Path $practiceRoot '.omr-venv\Scripts\python.exe'
if ($Setup) {
    if (-not (Test-Path -LiteralPath $practicePython)) {
        if (-not $PythonPath) { throw 'Pass -PythonPath with the full path to Python 3.12, or double-click Start PDF Reader.cmd.' }
        & $PythonPath -m venv (Join-Path $practiceRoot '.omr-venv')
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the PDF reader environment.' }
    }
    & $practicePython -m pip install --disable-pip-version-check --timeout 15 --retries 0 -r (Join-Path $practiceRoot 'recognizer\requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'PDF reader installation did not finish. Check the connection, then run -Setup again.' }
    & $practicePython -m pip freeze | Set-Content -LiteralPath (Join-Path $practiceRoot '.omr-installed.txt')
}
if (-not (Test-Path -LiteralPath $practicePython)) { throw 'Run this script with -Setup and -PythonPath first.' }
& $practicePython (Join-Path $practiceRoot 'recognizer\server.py') --port $Port
