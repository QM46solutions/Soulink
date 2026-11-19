// Sparks video player (web): tap to play / pause, loops. Plays the Spark with its studio edits:
// trim (start–end), speed, filter + adjustments, zoom / crop, fade in / out, timed text + stickers,
// music (from its start point) and a voiceover, mixed with the video's own sound.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediaUrl } from '../lib/api';
import { fadeAt, videoCss, zoomCss } from '../lib/sparkEdit';
import SparkOverlays from './SparkOverlays';
import SparkControls from './SparkControls';

let current = null; // { owner, pause } of the Spark playing now: one Spark plays at a time

// fill: edge to edge, no rounded corners (the full-screen Sparks feed). The whole video always shows: a portrait
// video fills a phone screen, a landscape one plays full width as landscape (black above and below), never cropped. autoPlay: plays by itself while `active`;
// if the browser won't play sound without a tap first, it plays muted with a "Tap for sound" button (like Instagram).
// muted: no sound (the Sparks speaker button). onAutoMuted: the browser made autoplay start without sound.
// onDoubleTap: a quick second tap (like ❤️ on Reels); a single tap still pauses / plays after a short wait.
// controls: YouTube-style controls (a tap shows them: play / pause, 10 s back / forward, progress bar, time, sound,
// full screen); onControls(shown) tells the parent so it can step its own overlays aside.
export default function SparkVideo({ uri, musicUri, voiceUri, height = 520, onFirstPlay, local, edit, active = true, fill = false, autoPlay = false, muted = false, onAutoMuted, onDoubleTap,
  controls = false, onToggleMute, onFullscreen, fullscreen = false, onControls }) {
  const video = useRef(null); const audio = useRef(null); const voice = useRef(null); const shade = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [soundOff, setSoundOff] = useState(false); // autoplay had to start muted
  const [time, setTime] = useState(null);
  const started = useRef(false);
  const tapAt = useRef(0); const tapTimer = useRef(null);
  const [cur, setCur] = useState(0); const [dur, setDur] = useState(0);
  const [shown, setShown] = useState(false); const hideTimer = useRef(null); const scrubbing = useRef(false);
  const self = useRef({}); // identifies this player (pause() is a new function every render)
  const src = local ? uri : mediaUrl(uri);
  const music = musicUri ? (local ? musicUri : mediaUrl(musicUri)) : null;
  const e = edit || {};
  const vo = voiceUri ? (local ? voiceUri : mediaUrl(voiceUri)) : e.voice ? mediaUrl(e.voice) : null;
  const t0 = e.trim?.[0] || 0; const t1 = e.trim?.[1] || null;
  const rate = Number(e.speed || 1);
  const musicStart = e.musicStart || 0;
  const timedText = (e.texts || []).some((x) => x.from != null || x.to != null);
  const fading = !!(e.fade?.in || e.fade?.out);
  const base = useRef({}); // the volumes before fading
  base.current = {
    video: music || vo ? (e.videoVolume ?? (music ? 0 : 1)) : (e.videoVolume ?? 1),
    music: e.musicVolume ?? 1, voice: e.voiceVolume ?? 1,
  };

  const syncAudio = () => {
    const v = video.current; if (!v) return;
    const rel = Math.max(0, v.currentTime - t0) / rate;
    if (audio.current) audio.current.currentTime = musicStart + rel;
    if (voice.current) voice.current.currentTime = rel;
  };
  const pause = () => { video.current?.pause(); audio.current?.pause(); voice.current?.pause(); setPlaying(false); };
  const play = async () => {
    if (current && current.owner !== self.current) current.pause();
    current = { owner: self.current, pause };
    try {
      const v = video.current;
      if (v && (v.currentTime < t0 || (t1 && v.currentTime >= t1))) v.currentTime = t0;
      try { await v?.play(); } catch (err) {
        // the browser blocks sound until the person taps the page once: start muted instead
        if (!autoPlay || !v || err?.name !== 'NotAllowedError') throw err;
        v.muted = true; await v.play(); setSoundOff(true); onAutoMuted?.();
        setPlaying(true); if (!started.current) { started.current = true; onFirstPlay?.(); }
        return;
      }
      syncAudio();
      if (audio.current) await audio.current.play().catch(() => {});
      if (voice.current) await voice.current.play().catch(() => {});
      setPlaying(true);
      if (!started.current) { started.current = true; onFirstPlay?.(); }
    } catch { setPlaying(false); }
  };
  // apply speed, volumes, the cover frame before playing
  useEffect(() => {
    const v = video.current; if (!v) return;
    v.playbackRate = rate; v.defaultPlaybackRate = rate;
    v.volume = Math.min(1, base.current.video);
    v.muted = base.current.video === 0;
    if (audio.current) audio.current.volume = base.current.music;
    if (voice.current) voice.current.volume = base.current.voice;
  }, [rate, music, vo, e.videoVolume, e.musicVolume, e.voiceVolume]);
  // while playing: the fade (picture and sound) and which texts are on screen
  useEffect(() => {
    if (!playing || (!fading && !timedText)) return undefined;
    let raf; let lastT = -1;
    const tick = () => {
      const v = video.current;
      if (v) {
        if (fading) {
          const k = fadeAt(e.fade, v.currentTime, t0, t1 || v.duration);
          if (shade.current) shade.current.style.opacity = String(k);
          const g = 1 - k; const b = base.current;
          v.volume = Math.min(1, b.video * g);
          if (audio.current) audio.current.volume = b.music * g;
          if (voice.current) voice.current.volume = b.voice * g;
        }
        if (timedText && Math.abs(v.currentTime - lastT) > 0.12) { lastT = v.currentTime; setTime(v.currentTime); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, fading, timedText]); // eslint-disable-line react-hooks/exhaustive-deps
  const onMeta = () => { const v = video.current; if (v && v.duration && isFinite(v.duration)) setDur(Math.max(0, (t1 || v.duration) - t0)); if (v && !playing) { v.currentTime = e.cover ?? t0; if (timedText) setTime(v.currentTime); } };
  // stay inside the trim: loop back to the start (and the music / voice with it)
  const onTime = () => {
    const v = video.current; if (!v) return;
    if (t1 && v.currentTime >= t1) { v.currentTime = t0; syncAudio(); }
    if (controls && !scrubbing.current) setCur(Math.max(0, v.currentTime - t0));
  };
  // the end: loop back to the start (it's still playing, so the play button stays hidden)
  const onEnded = () => { const v = video.current; if (v) { v.currentTime = t0; v.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); syncAudio(); voice.current?.play().catch(() => {}); } };
  useEffect(() => () => { if (current?.owner === self.current) current = null; video.current?.pause(); audio.current?.pause(); voice.current?.pause(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // stop when it's scrolled away (less than half on screen), when you open another screen or tab, or when the
  // app goes to the background. Screens stay open underneath, so leaving one doesn't stop its video by itself.
  useEffect(() => {
    const v = video.current;
    if (!v || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([en]) => { if (!en.isIntersecting || en.intersectionRatio < 0.5) pause(); }, { threshold: [0, 0.5] });
    io.observe(v);
    const hide = () => { if (document.visibilityState === 'hidden') pause(); };
    document.addEventListener('visibilitychange', hide);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', hide); };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { if (autoPlay && active) play(); return () => pause(); }, [autoPlay, active])); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!active) pause(); else if (autoPlay) play(); }, [active, autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps
  // tap while it's playing muted: turn the sound on (instead of pausing)
  const soundOn = () => {
    const v = video.current; if (!v) return;
    v.muted = base.current.video === 0; setSoundOff(false); syncAudio();
    audio.current?.play().catch(() => {}); voice.current?.play().catch(() => {});
  };

  // sound off / on (the speaker button): the video, the music and the voiceover together
  useEffect(() => {
    const v = video.current; if (!v) return;
    if (muted) { v.muted = true; if (audio.current) audio.current.muted = true; if (voice.current) voice.current.muted = true; return; }
    if (audio.current) audio.current.muted = false; if (voice.current) voice.current.muted = false;
    if (soundOff) { if (playing) soundOn(); } else v.muted = base.current.video === 0;
  }, [muted]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => (soundOff && playing && !onAutoMuted ? soundOn() : playing ? pause() : play());
  // controls: show for 3 s after a tap (they stay while paused)
  const flash = (keep) => {
    clearTimeout(hideTimer.current); setShown(true);
    if (!keep) hideTimer.current = setTimeout(() => { if (!scrubbing.current) setShown(false); }, 3000);
  };
  const ctlVisible = controls && (shown || !playing);
  useEffect(() => { onControls?.(ctlVisible); }, [ctlVisible]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  const seekTo = (t) => {
    const v = video.current; if (!v) return;
    const d = dur || Math.max(0, (t1 || v.duration || 0) - t0);
    const x = Math.max(0, isFinite(d) && d > 0 ? Math.min(d - 0.1, t) : t);
    v.currentTime = t0 + x; setCur(x); syncAudio(); flash();
  };
  const single = () => {
    if (!controls) { toggle(); return; }
    if (ctlVisible && playing) { clearTimeout(hideTimer.current); setShown(false); } else flash();
  };
  const onTap = () => {
    if (!onDoubleTap) { single(); return; }
    const now = Date.now();
    if (now - tapAt.current < 280) { clearTimeout(tapTimer.current); tapAt.current = 0; onDoubleTap(); return; }
    tapAt.current = now;
    clearTimeout(tapTimer.current); tapTimer.current = setTimeout(single, 280);
  };
  useEffect(() => () => clearTimeout(tapTimer.current), []);
  return (
    <Pressable onPress={onTap} style={{ height, backgroundColor: '#000', borderRadius: fill ? 0 : 20, overflow: 'hidden' }} accessibilityLabel={soundOff ? 'Turn sound on' : playing ? 'Pause' : 'Play'}>
      <video ref={video} src={src} playsInline preload="metadata" onLoadedMetadata={onMeta} onTimeUpdate={onTime} onEnded={onEnded}
        onPause={() => { const v = video.current; if (!v?.paused || v.ended) return; audio.current?.pause(); voice.current?.pause(); setPlaying(false); }}
        style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000', display: 'block', filter: videoCss(e), ...zoomCss(e.zoom) }} />
      {music ? <audio ref={audio} src={music} loop preload="auto" /> : null}
      {vo ? <audio ref={voice} src={vo} preload="auto" /> : null}
      {fading ? <div ref={shade} style={{ position: 'absolute', inset: 0, background: '#000', opacity: playing ? 0 : 0, pointerEvents: 'none' }} /> : null}
      <SparkOverlays edit={e} time={timedText ? time : null} />
      {controls ? (
        <SparkControls visible={ctlVisible} playing={playing} cur={cur} dur={dur} muted={muted || (soundOff && !onAutoMuted)} fullscreen={fullscreen}
          onPlayPause={() => { if (playing) { pause(); flash(true); } else { play(); flash(); } }}
          onSkip={(d) => seekTo(cur + d)} onSeek={seekTo} onScrub={(on) => { scrubbing.current = on; if (on) clearTimeout(hideTimer.current); }}
          onMute={onToggleMute || (soundOff ? soundOn : null)} onFullscreen={onFullscreen} />
      ) : null}
      {soundOff && playing && !onAutoMuted ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: fill ? 58 : 12, right: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <Ionicons name="volume-mute" size={15} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>Tap for sound</Text>
        </View>
      ) : null}
      {!playing && !controls ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 4 }} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
