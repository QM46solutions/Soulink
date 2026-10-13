---
title: Soulmoji AI
emoji: 💜
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
---

Soulink's free AI helpers, used only by the Soulink server:
- Soulmoji: changes the facial expression on a selfie with LivePortrait (MIT, https://github.com/KwaiVGI/LivePortrait)
- Voice translator: Whisper small (speech to text) + Meta MMS-TTS voices
- Argue referee: Llama 3.2 3B in Ollama

Set the secret **SOULMOJI_AI_TOKEN** in this Space's settings; the Soulink server sends the same value.
