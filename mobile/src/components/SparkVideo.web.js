// Sparks video player (web): tap to play / pause, loops. Plays the Spark with its studio edits:
// trim (start–end), speed, filter, text + stickers, music (from its start point) mixed with the video's own sound.
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediaUrl } from '../lib/api';
import { filterCss } from '../lib/sparkEdit';
import SparkOverlays from './SparkOverlays';

let current = null; // one Spark plays at a time

export default function SparkVideo({ uri, musicUri, height = 520, onFirstPlay, local, edit }) {
  const video = useRef(null); const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const src = local ? uri : mediaUrl(uri);
  const music = musicUri ? (local ? musicUri : mediaUrl(musicUri)) : null;
  const e = edit || {};
  const t0 = e.trim?.[0] || 0; const t1 = e.trim?.[1] || null;
  const rate = Number(e.speed || 1);
  const musicStart = e.musicStart || 0;

  const syncMusic = () => { const v = video.current; const a = audio.current; if (v && a) a.currentTime = musicStart + Math.max(0, v.currentTime - t0) / rate; };
  const pause = () => { video.current?.pause(); audio.current?.pause(); setPlaying(false); };
  const play = async () => {
    if (current && current !== pause) current();
    current = pause;
    try {
      const v = video.current;
      if (v && (v.currentTime < t0 || (t1 && v.currentTime >= t1))) v.currentTime = t0;
      await v?.play();
      if (audio.current) { syncMusic(); await audio.current.play(); }
      setPlaying(true);
      if (!started.current) { started.current = true; onFirstPlay?.(); }
    } catch { setPlaying(false); }
  };
  // apply speed, volumes, the cover frame before playing
  useEffect(() => {
    const v = video.current; if (!v) return;
    v.playbackRate = rate; v.defaultPlaybackRate = rate;
    v.volume = music ? (e.videoVolume ?? 0) : (e.videoVolume ?? 1);
    v.muted = music ? (e.videoVolume ?? 0) === 0 : false;
    if (audio.current) audio.current.volume = e.musicVolume ?? 1;
  }, [rate, music, e.videoVolume, e.musicVolume]);
  const onMeta = () => { const v = video.current; if (v && !playing) v.currentTime = e.cover ?? t0; };
  // stay inside the trim: loop back to the start (and the music with it)
  const onTime = () => { const v = video.current; if (v && t1 && v.currentTime >= t1) { v.currentTime = t0; syncMusic(); } };
  const onEnded = () => { const v = video.current; if (v) { v.currentTime = t0; v.play().catch(() => {}); syncMusic(); } };
  useEffect(() => () => { if (current === pause) current = null; video.current?.pause(); audio.current?.pause(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Pressable onPress={() => (playing ? pause() : play())} style={{ height, backgroundColor: '#000', borderRadius: 20, overflow: 'hidden' }} accessibilityLabel={playing ? 'Pause' : 'Play'}>
      <video ref={video} src={src} playsInline preload="metadata" onLoadedMetadata={onMeta} onTimeUpdate={onTime} onEnded={onEnded}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: filterCss(e.filter) }} />
      {music ? <audio ref={audio} src={music} loop preload="auto" /> : null}
      <SparkOverlays edit={e} />
      {!playing ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 4 }} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
