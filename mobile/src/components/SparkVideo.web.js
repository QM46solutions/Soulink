// Sparks video player (web): tap to play / pause, loops. With music added, the video is muted and the song plays in sync.
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediaUrl } from '../lib/api';

let current = null; // one Spark plays at a time

export default function SparkVideo({ uri, musicUri, height = 520, onFirstPlay, local }) {
  const video = useRef(null); const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const src = local ? uri : mediaUrl(uri);
  const music = musicUri ? (local ? musicUri : mediaUrl(musicUri)) : null;

  const pause = () => { video.current?.pause(); audio.current?.pause(); setPlaying(false); };
  const play = async () => {
    if (current && current !== pause) current();
    current = pause;
    try {
      await video.current?.play();
      if (audio.current) { audio.current.currentTime = video.current ? video.current.currentTime % (audio.current.duration || 1e9) : 0; await audio.current.play(); }
      setPlaying(true);
      if (!started.current) { started.current = true; onFirstPlay?.(); }
    } catch { setPlaying(false); }
  };
  useEffect(() => () => { if (current === pause) current = null; video.current?.pause(); audio.current?.pause(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Pressable onPress={() => (playing ? pause() : play())} style={{ height, backgroundColor: '#000', borderRadius: 20, overflow: 'hidden' }} accessibilityLabel={playing ? 'Pause' : 'Play'}>
      <video ref={video} src={src} playsInline loop muted={!!music} preload="metadata"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {music ? <audio ref={audio} src={music} loop preload="auto" /> : null}
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
