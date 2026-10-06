# One-time setup for the Soulink voice translator. Free, runs on this laptop.
#  - Speech to text: OpenAI Whisper small (MIT licence, ~1 GB)
#  - Text to speech: Meta MMS-TTS voices for English, Hindi, Telugu, Bengali (~150 MB each; CC-BY-NC = testing only, swap before launch)
# Shares the private Python already set up for Soulmoji AI / the chat translator. Run with INSTALL-VOICE-TRANSLATOR.bat.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Fail($t) { Write-Host ""; Write-Host "FAILED: $t" -ForegroundColor Red; Write-Host "Send a screenshot of this window to Claude."; exit 1 }

try {
  $uv = Join-Path $here 'uv\uv.exe'
  $py = Join-Path $here '.venv\Scripts\python.exe'
  if (-not (Test-Path $py) -or -not (Test-Path (Join-Path $here 'models\nllb-200-distilled-600M\config.json'))) {
    Fail "Install the chat translator first: run INSTALL-CHAT-TRANSLATOR.bat, then this file again."
  }

  Step "1/3  Installing audio libraries (PyAV for voice notes, uroman for voices)"
  & $uv pip install --python $py "av==12.3.0" uroman
  if ($LASTEXITCODE) { Fail "audio library install failed" }

  Step "2/3  Downloading Whisper (speech to text) and the 4 voices (~1.6 GB, one time)"
  $models = Join-Path $here 'models'
  $dl = @"
from huggingface_hub import list_repo_files, snapshot_download
import os
def get(repo, name):
    if os.path.exists(os.path.join(r'$models', name, 'config.json')) and any(f.endswith(('.safetensors', '.bin')) for f in os.listdir(os.path.join(r'$models', name))):
        print('already downloaded', repo, flush=True); return
    files = list_repo_files(repo)
    weights = ['model.safetensors'] if 'model.safetensors' in files else ['pytorch_model.bin']
    snapshot_download(repo, local_dir=os.path.join(r'$models', name), allow_patterns=['*.json', '*.txt', 'vocab*', 'merges*', '*.model'] + weights)
    print('downloaded', repo, flush=True)
get('openai/whisper-small', 'whisper-small')
for code in ['eng', 'hin', 'tel', 'ben']:
    get('facebook/mms-tts-' + code, 'mms-tts-' + code)
"@
  $dl | & $py -
  if ($LASTEXITCODE) { Fail "model download failed" }

  Step "3/3  Test: make a Telugu voice clip and read it back"
  $test = @"
import os, sys, time
sys.argv = ['x']
here = r'$here'
from transformers import AutoTokenizer, VitsModel, pipeline
import numpy as np, torch, wave
d = os.path.join(here, 'models', 'mms-tts-tel')
tok = AutoTokenizer.from_pretrained(d); m = VitsModel.from_pretrained(d).eval()
text = '\u0c28\u0c2e\u0c38\u0c4d\u0c15\u0c3e\u0c30\u0c02, \u0c2e\u0c40\u0c30\u0c41 \u0c0e\u0c32\u0c3e \u0c09\u0c28\u0c4d\u0c28\u0c3e\u0c30\u0c41?'  # Telugu, written as escapes so Windows PowerShell can't garble it
if getattr(tok, 'is_uroman', False):
    import uroman; text = uroman.Uroman().romanize_string(text)
enc = tok(text, return_tensors='pt')
assert enc['input_ids'].shape[-1] > 0, 'the Telugu voice got no letters to read'
with torch.no_grad():
    wav = m(input_ids=enc['input_ids'].long(), attention_mask=enc['attention_mask'].long()).waveform[0].numpy()
out = os.path.join(here, 'voice-test.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(m.config.sampling_rate); w.writeframes((np.clip(wav, -1, 1) * 32767).astype(np.int16).tobytes())
print('voice clip OK:', out)
import av
asr = pipeline('automatic-speech-recognition', model=os.path.join(here, 'models', 'whisper-small'), chunk_length_s=30)
t0 = time.time()
with av.open(out) as c:
    res = av.AudioResampler(format='flt', layout='mono', rate=16000)
    chunks = [f.to_ndarray().reshape(-1) for fr in c.decode(audio=0) for f in res.resample(fr)]
audio = np.concatenate(chunks).astype(np.float32)
print('heard:', asr({'raw': audio, 'sampling_rate': 16000}, generate_kwargs={'task': 'transcribe', 'language': 'telugu'})['text'], f'({time.time() - t0:.1f}s)')
"@
  $env:PYTHONIOENCODING = 'utf-8'
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
  $test | & $py - | Out-File -Encoding utf8 "$here\voice-test.txt"
  if ($LASTEXITCODE) { Fail "the voice test failed" }
  Get-Content "$here\voice-test.txt" -Encoding utf8
  Write-Host ""
  Write-Host "DONE. Voice translator is installed." -ForegroundColor Green
  Write-Host "Restart Soulink (close its windows, then START-SOULINK-WEB or START-SOULINK-PHONE)."
  Start-Process notepad.exe "$here\voice-test.txt" -ErrorAction SilentlyContinue
} catch {
  Fail $_.Exception.Message
}
