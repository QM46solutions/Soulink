# One-time setup for the Soulink chat translator (English, Hindi, Telugu, Bengali). Free, runs on this laptop.
# Uses Meta's NLLB-200 (distilled 600M) translation model from Hugging Face (~2.5 GB download).
# Shares the private Python already set up for Soulmoji AI (this folder). Run with INSTALL-CHAT-TRANSLATOR.bat.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Fail($t) { Write-Host ""; Write-Host "FAILED: $t" -ForegroundColor Red; Write-Host "Send a screenshot of this window to Claude."; exit 1 }

try {
  $uv = Join-Path $here 'uv\uv.exe'
  $py = Join-Path $here '.venv\Scripts\python.exe'
  if (-not (Test-Path $uv)) {
    Step "Getting uv (Python manager)"
    Invoke-WebRequest 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip' -OutFile "$here\uv.zip" -UseBasicParsing
    Expand-Archive "$here\uv.zip" -DestinationPath "$here\uv" -Force; Remove-Item "$here\uv.zip"
  }
  if (-not (Test-Path $py)) {
    Step "Creating a private Python 3.11"
    & $uv venv "$here\.venv" --python 3.11; if ($LASTEXITCODE) { Fail "could not create Python" }
    & $uv pip install --python $py torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu; if ($LASTEXITCODE) { Fail "PyTorch install failed" }
    & $uv pip install --python $py numpy==1.26.4 huggingface_hub; if ($LASTEXITCODE) { Fail "helper packages failed" }
  }

  Step "1/3  Installing the translation library (transformers)"
  & $uv pip install --python $py "transformers==4.44.2" sentencepiece protobuf huggingface_hub
  if ($LASTEXITCODE) { Fail "transformers install failed" }

  Step "2/3  Downloading the NLLB-200 translation model (~2.5 GB, one time)"
  $dest = Join-Path $here 'models\nllb-200-distilled-600M'
  $dl = @"
from huggingface_hub import snapshot_download
snapshot_download('facebook/nllb-200-distilled-600M', local_dir=r'$dest', allow_patterns=['*.json', '*.model', '*.bin'])
print('downloaded')
"@
  $dl | & $py -
  if ($LASTEXITCODE) { Fail "model download failed" }

  Step "3/3  Test translation"
  $test = @"
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
tok = AutoTokenizer.from_pretrained(r'$dest', src_lang='eng_Latn')
m = AutoModelForSeq2SeqLM.from_pretrained(r'$dest').eval()
for code in ['hin_Deva', 'tel_Telu', 'ben_Beng']:
    out = m.generate(**tok('How are you? Shall we meet tomorrow?', return_tensors='pt'), forced_bos_token_id=tok.convert_tokens_to_ids(code), max_new_tokens=60)
    print(code, tok.batch_decode(out, skip_special_tokens=True)[0])
"@
  $env:PYTHONIOENCODING = 'utf-8'
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $test | & $py - | Out-File -Encoding utf8 "$here\translator-test.txt"
  if ($LASTEXITCODE) { Fail "the test translation failed" }
  Get-Content "$here\translator-test.txt" -Encoding utf8
  Write-Host ""
  Write-Host "DONE. Chat translator is installed." -ForegroundColor Green
  Write-Host "Restart Soulink (close its windows, then START-SOULINK-WEB or START-SOULINK-PHONE)."
  Start-Process notepad.exe "$here\translator-test.txt" -ErrorAction SilentlyContinue
} catch {
  Fail $_.Exception.Message
}
