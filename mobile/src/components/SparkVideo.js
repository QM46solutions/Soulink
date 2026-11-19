// Sparks video player (phone app): tap to play / pause, loops. Plays the Spark with its studio edits:
// trim (start–end), speed, zoom / crop, fade in / out, timed text + stickers, music (from its start point) and a
// voiceover, mixed with the video's own sound. Colour filters show in the finished video once the server builds
// it (see docs/MOBILE-PLAN.md); until then the phone plays the original colours.
// One Spark plays at a time; it stops when you leave the screen, the app goes to the background, or `active`
// turns false (the list passes that when the Spark is scrolled off screen).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createAudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { mediaUrl } from '../lib/api';
import { fadeAt } from '../lib/sparkEdit';
import SparkOverlays from './SparkOverlays';
import SparkControls from './SparkControls';

let current = null; // the pause() of the Spark that is playing now

// fill: edge to edge, no rounded corners (the full-screen Sparks feed). The whole video always shows: a portrait
// video fills a phone screen, a landscape one plays full width as landscape (black above and below), never cropped. autoPlay: plays by itself while `active`.
// muted: no sound at all (the Sparks speaker button). onDoubleTap: a quick second tap (like ❤️ on Reels); a single tap
// still pauses / plays, just after a short wait to tell the two apart.
// controls: YouTube-style controls (a tap shows them: play / pause, 10 s back / forward, progress bar, time, sound,
// full screen); onControls(shown) tells the parent so it can step its own overlays aside.
export default function SparkVideo({ uri, musicUri, voiceUri, height = 520, onFirstPlay, local, edit, active = true, fill = false, autoPlay = false, muted = false, onDoubleTap,
  controls = false, onToggleMute, onFullscreen, fullscreen = false, onControls }) {
  const e = edit || {};
  const src = local ? uri : mediaUrl(uri);
  const music = musicUri ? (local ? musicUri : mediaUrl(musicUri)) : null;
  const vo = voiceUri ? (local ? voiceUri : mediaUrl(voiceUri)) : e.voice ? mediaUrl(e.voice) : null;
  const t0 = e.trim?.[0] || 0; const t1 = e.trim?.[1] || null;
  const rate = Number(e.speed || 1);
  const musicStart = e.musicStart || 0;
  const timedText = (e.texts || []).some((x) => x.from != null || x.to != null);
  const fading = !!(e.fade?.in || e.fade?.out);
  const vol = { video: music || vo ? (e.videoVolume ?? (music ? 0 : 1)) : (e.videoVolume ?? 1), music: e.musicVolume ?? 1, voice: e.voiceVolume ?? 1 };

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(null);
  const started = useRef(false);
  const shade = useRef(new Animated.Value(0)).current;
  const audio = useRef(null); const voice = useRef(null);
  const tapAt = useRef(0); const tapTimer = useRef(null);
  const [cur, setCur] = useState(0); const [dur, setDur] = useState(0);
  const [shown, setShown] = useState(false); const hideTimer = useRef(null); const scrubbing = useRef(false);

  const player = useVideoPlayer(src, (p) => {
    p.loop = false; p.timeUpdateEventInterval = 0.1; p.playbackRate = rate; p.preservesPitch = true;
    p.volume = Math.min(1, vol.video); p.muted = vol.video === 0;
    if (e.cover != null || t0) p.currentTime = e.cover ?? t0;
  });
  // music and voiceover play alongside
  useEffect(() => {
    audio.current = music ? createAudioPlayer({ uri: music }) : null;
    voice.current = vo ? createAudioPlayer({ uri: vo }) : null;
    if (audio.current) { audio.current.loop = true; audio.current.volume = vol.music; }
    if (voice.current) voice.current.volume = vol.voice;
    return () => { audio.current?.remove(); voice.current?.remove(); audio.current = null; voice.current = null; };
  }, [music, vo]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncAudio = () => {
    const rel = Math.max(0, (player.currentTime || 0) - t0) / rate;
    audio.current?.seekTo(musicStart + rel).catch?.(() => {});
    voice.current?.seekTo(rel).catch?.(() => {});
  };
  const pause = useCallback(() => {
    try { player.pause(); } catch { /* released */ }
    audio.current?.pause(); voice.current?.pause(); setPlaying(false);
  }, [player]);
  const play = () => {
    if (current && current !== pause) current();
    current = pause;
    const now = player.currentTime || 0;
    if (now < t0 || (t1 && now >= t1)) player.currentTime = t0;
    player.play(); syncAudio(); audio.current?.play(); voice.current?.play();
    setPlaying(true);
    if (!started.current) { started.current = true; onFirstPlay?.(); }
  };

  // keep inside the trim (loop back), the fade, and which texts are on screen
  useEffect(() => {
    const onTime = ({ currentTime: t }) => {
      if (t1 && t >= t1) { player.currentTime = t0; syncAudio(); return; }
      if (fading) {
        const k = fadeAt(e.fade, t, t0, t1 || player.duration);
        shade.setValue(k);
        const g = 1 - k;
        player.volume = Math.min(1, vol.video * g);
        if (audio.current) audio.current.volume = vol.music * g;
        if (voice.current) voice.current.volume = vol.voice * g;
      }
      if (timedText) setTime(t);
      if (controls) {
        const d = Math.max(0, (t1 || player.duration || 0) - t0); if (d && Math.abs(d - dur) > 0.05) setDur(d);
        if (!scrubbing.current) setCur((c) => (Math.abs(c - (t - t0)) >= 0.25 ? Math.max(0, t - t0) : c));
      }
    };
    const onEnd = () => { player.currentTime = t0; player.play(); syncAudio(); voice.current?.play(); };
    const onPlaying = ({ isPlaying }) => { if (!isPlaying && playing && player.currentTime < (player.duration || 1e9) - 0.2) { audio.current?.pause(); voice.current?.pause(); } };
    const a = player.addListener('timeUpdate', onTime);
    const b = player.addListener('playToEnd', onEnd);
    const c = player.addListener('playingChange', onPlaying);
    return () => { a.remove(); b.remove(); c.remove(); };
  }, [player, t0, t1, fading, timedText, playing, controls, dur]); // eslint-disable-line react-hooks/exhaustive-deps

  // stop when scrolled away, when another screen opens, or when the app goes to the background
  useEffect(() => { if (!active) pause(); else if (autoPlay) play(); }, [active, autoPlay, pause]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { if (autoPlay && active) play(); return () => pause(); }, [pause, autoPlay, active])); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => { if (st !== 'active') pause(); });
    return () => { s.remove(); if (current === pause) current = null; };
  }, [pause]);

  // sound off / on (the speaker button): the video, the music and the voiceover together
  useEffect(() => {
    try { player.muted = muted || vol.video === 0; } catch { /* released */ }
    if (audio.current) audio.current.volume = muted ? 0 : vol.music;
    if (voice.current) voice.current.volume = muted ? 0 : vol.voice;
  }, [muted, player, music, vo]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => (playing ? pause() : play());
  // controls: show for 3 s after a tap (they stay while paused)
  const flash = (keep) => {
    clearTimeout(hideTimer.current); setShown(true);
    if (!keep) hideTimer.current = setTimeout(() => { if (!scrubbing.current) setShown(false); }, 3000);
  };
  const ctlVisible = controls && (shown || !playing);
  useEffect(() => { onControls?.(ctlVisible); }, [ctlVisible]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  const seekTo = (t) => {
    const d = dur || Math.max(0, (t1 || player.duration || 0) - t0);
    const x = Math.max(0, isFinite(d) && d > 0 ? Math.min(d - 0.1, t) : t);
    try { player.currentTime = t0 + x; } catch { /* released */ }
    setCur(x); syncAudio(); flash();
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

  const z = e.zoom && e.zoom.s > 1.001 ? e.zoom : null;
  return (
    <Pressable onPress={onTap} style={{ height, backgroundColor: '#000', borderRadius: fill ? 0 : 20, overflow: 'hidden' }} accessibilityLabel={playing ? 'Pause' : 'Play'}>
      <View style={{ flex: 1, ...(z ? { transform: [{ translateX: (0.5 - z.x) * (z.s - 1) * 100 }, { translateY: (0.5 - z.y) * (z.s - 1) * 100 }, { scale: z.s }] } : {}) }}>
        <VideoView playsInline player={player} style={{ flex: 1, backgroundColor: '#000' }} contentFit="contain" nativeControls={false} allowsPictureInPicture={false} />
      </View>
      {fading ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: shade }} /> : null}
      <SparkOverlays edit={e} time={timedText ? time : null} />
      {controls ? (
        <SparkControls visible={ctlVisible} playing={playing} cur={cur} dur={dur} muted={muted} fullscreen={fullscreen}
          onPlayPause={() => { if (playing) { pause(); flash(true); } else { play(); flash(); } }}
          onSkip={(d) => seekTo(cur + d)} onSeek={seekTo} onScrub={(on) => { scrubbing.current = on; if (on) clearTimeout(hideTimer.current); }}
          onMute={onToggleMute} onFullscreen={onFullscreen} />
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
