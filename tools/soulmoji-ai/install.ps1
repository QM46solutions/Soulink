# One-time setup for Soulmoji AI (free, runs on this laptop). Run with INSTALL-SOULMOJI-AI.bat.
# Downloads: uv (Python manager), Python 3.11, LivePortrait source (GitHub), PyTorch + helpers (PyPI),
# LivePortrait model files (Hugging Face). About 2-3 GB in total. Nothing is installed system-wide:
# everything lives in this folder (tools\soulmoji-ai). Delete the folder to remove it.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Fail($t) { Write-Host ""; Write-Host "FAILED: $t" -ForegroundColor Red; Write-Host "Send a screenshot of this window to Claude."; exit 1 }

try {
  Step "1/6  Getting uv (downloads Python for us, from github.com/astral-sh/uv)"
  $uv = Join-Path $here 'uv\uv.exe'
  if (-not (Test-Path $uv)) {
    Invoke-WebRequest 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip' -OutFile "$here\uv.zip" -UseBasicParsing
    Expand-Archive "$here\uv.zip" -DestinationPath "$here\uv" -Force
    Remove-Item "$here\uv.zip"
  }
  if (-not (Test-Path $uv)) { Fail "uv did not download" }

  Step "2/6  Getting LivePortrait source code (github.com/KwaiVGI/LivePortrait, MIT licence)"
  if (-not (Test-Path "$here\LivePortrait\src\live_portrait_wrapper.py")) {
    Invoke-WebRequest 'https://codeload.github.com/KwaiVGI/LivePortrait/zip/refs/heads/main' -OutFile "$here\lp.zip" -UseBasicParsing
    Expand-Archive "$here\lp.zip" -DestinationPath "$here\lp_tmp" -Force
    if (Test-Path "$here\LivePortrait") { Remove-Item "$here\LivePortrait" -Recurse -Force }
    Move-Item "$here\lp_tmp\LivePortrait-main" "$here\LivePortrait"
    Remove-Item "$here\lp_tmp" -Recurse -Force; Remove-Item "$here\lp.zip"
  }

  Step "3/6  Creating a private Python 3.11 just for Soulmoji AI"
  $py = Join-Path $here '.venv\Scripts\python.exe'
  if (-not (Test-Path $py)) { & $uv venv "$here\.venv" --python 3.11; if ($LASTEXITCODE) { Fail "could not create Python" } }

  $nvidia = @(Get-CimInstance Win32_VideoController | Where-Object { $_.Name -match 'NVIDIA' }).Count -gt 0
  if ($nvidia) {
    Step "4/6  Installing PyTorch for your NVIDIA graphics card (big download, ~2.5 GB)"
    & $uv pip install --python $py torch==2.3.1 --index-url https://download.pytorch.org/whl/cu121
  } else {
    Step "4/6  Installing PyTorch (CPU version, ~250 MB)"
    & $uv pip install --python $py torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu
  }
  if ($LASTEXITCODE) { Fail "PyTorch install failed" }
  & $uv pip install --python $py numpy==1.26.4 opencv-python==4.10.0.84 onnxruntime==1.18.0 onnx==1.16.1 pyyaml scipy==1.13.1 scikit-image==0.24.0 imageio==2.34.2 rich==13.7.1 tyro==0.8.5 tqdm pillow pykalman==0.9.7 requests huggingface_hub typing_extensions
  if ($LASTEXITCODE) { Fail "helper packages failed to install" }

  Step "5/6  Downloading LivePortrait model files from Hugging Face (~700 MB)"
  $weights = Join-Path $here 'LivePortrait\pretrained_weights'
  $dl = @"
from huggingface_hub import snapshot_download
import sys
for repo in ['KlingTeam/LivePortrait', 'KwaiVGI/LivePortrait']:
    try:
        snapshot_download(repo, local_dir=r'$weights', allow_patterns=['liveportrait/*', 'liveportrait/**', 'insightface/*', 'insightface/**'])
        print('downloaded from', repo); sys.exit(0)
    except Exception as e:
        print('could not use', repo, '-', e)
sys.exit(1)
"@
  $dl | & $py -
  if ($LASTEXITCODE) { Fail "model download failed" }
  if (-not (Test-Path "$weights\liveportrait\base_models\spade_generator.pth")) { Fail "model files missing after download" }

  Step "6/6  Test run on a sample face (first run is slow: it loads the models)"
  $sample = Get-ChildItem "$here\LivePortrait\assets\examples\source" -Filter *.jpg | Select-Object -First 1
  & $py "$here\soulmoji_ai.py" --selftest $sample.FullName "$here\selftest.jpg"
  if ($LASTEXITCODE) { Fail "the test run failed" }

  Write-Host ""
  Write-Host "DONE. Soulmoji AI is installed." -ForegroundColor Green
  Write-Host "Restart Soulink (close its windows, then START-SOULINK-WEB or START-SOULINK-PHONE)."
  Write-Host "Test pictures: tools\soulmoji-ai\selftest-happy.jpg and selftest-shocked.jpg"
  Start-Process "$here\selftest-happy.jpg" -ErrorAction SilentlyContinue
} catch {
  Fail $_.Exception.Message
}
