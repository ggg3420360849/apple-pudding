param(
    [int]$Port = 8000
)

$env:PYTHONPATH = "D:\apple-pudding-main\apple-pudding-main;D:\apple-pudding-main\apple-pudding-main\.codex_pydeps"
Set-Location "D:\apple-pudding-main\apple-pudding-main"
& "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m uvicorn main:app --host 127.0.0.1 --port $Port
