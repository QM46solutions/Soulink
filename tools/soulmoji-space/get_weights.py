# Downloads LivePortrait's model files from Hugging Face while the Space builds (same as the laptop installer).
import sys
from huggingface_hub import snapshot_download
for repo in ['KlingTeam/LivePortrait', 'KwaiVGI/LivePortrait']:
    try:
        snapshot_download(repo, local_dir='LivePortrait/pretrained_weights', allow_patterns=['liveportrait/*', 'liveportrait/**', 'insightface/*', 'insightface/**'])
        print('downloaded from', repo); break
    except Exception as e:  # noqa: BLE001
        print('could not use', repo, '-', e)
else:
    sys.exit(1)

# voice translator: Whisper small (speech -> text) + Meta MMS-TTS voices for English, Hindi, Telugu, Bengali
import os
from huggingface_hub import list_repo_files
def get(repo, name):
    files = list_repo_files(repo)
    weights = ['*.safetensors'] if any(f.endswith('.safetensors') for f in files) else ['*.bin']
    snapshot_download(repo, local_dir=os.path.join('models', name), allow_patterns=['*.json', '*.txt', 'vocab*', 'merges*', '*.model'] + weights)
    print('downloaded', repo, flush=True)
get('openai/whisper-small', 'whisper-small')
for code in ['eng', 'hin', 'tel', 'ben']:
    get('facebook/mms-tts-' + code, 'mms-tts-' + code)
