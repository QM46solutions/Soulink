# Downloads LivePortrait's model files (~630 MB) from Hugging Face while the image is built.
# Same files the laptop installer uses.
import sys
from huggingface_hub import snapshot_download

for repo in ['KwaiVGI/LivePortrait', 'KlingTeam/LivePortrait']:
    try:
        snapshot_download(repo, local_dir='LivePortrait/pretrained_weights',
                          allow_patterns=['liveportrait/*', 'liveportrait/**', 'insightface/*', 'insightface/**'])
        print('downloaded from', repo)
        break
    except Exception as e:  # noqa: BLE001
        print('could not use', repo, '-', e)
else:
    sys.exit(1)
