# Downloads LivePortrait's model files from Hugging Face while the Space builds (same as the laptop installer).
import sys
from huggingface_hub import snapshot_download
for repo in ['KlingTeam/LivePortrait', 'KwaiVGI/LivePortrait']:
    try:
        snapshot_download(repo, local_dir='LivePortrait/pretrained_weights', allow_patterns=['liveportrait/*', 'liveportrait/**', 'insightface/*', 'insightface/**'])
        print('downloaded from', repo); sys.exit(0)
    except Exception as e:  # noqa: BLE001
        print('could not use', repo, '-', e)
sys.exit(1)
