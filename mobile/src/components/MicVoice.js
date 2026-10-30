// An Open Mic Spark that is just a voice (for people who'd rather not show their face): a calm card with a big
// play button, how far it has played, and what it's about. Plays on phones and on the web (expo-audio).
import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { mediaUrl } from '../lib/api';
import { micTopicOf } from '../lib/sparks';
import { colors, fonts, space } from '../lib/theme';

let current = null; // one voice plays at a time
const mmss = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;

export default function MicVoice({ uri, topic, caption, height = 300, onFirstPlay }) {
  const player = useAudioPlayer(uri ? { uri: mediaUrl(uri) } : null, { updateInterval: 250 });
  const st = useAudioPlayerStatus(player);
  const played = useRef(false);
  useEffect(() => () => { if (current === player) current = null; }, [player]);
  const t = micTopicOf(topic);
  const toggle = () => {
    if (st.playing) { player.pause(); return; }
    if (current && current !== player) { try { current.pause(); } catch { /* gone */ } }
    current = player;
    if (st.didJustFinish || (st.duration && st.currentTime >= st.duration - 0.2)) player.seekTo(0);
    player.play();
    if (!played.current) { played.current = true; onFirstPlay?.(); }
  };
  const pct = st.duration ? Math.min(1, st.currentTime / st.duration) : 0;
  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={st.playing ? 'Pause' : 'Play voice'}
      style={{ height, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
      <LinearGradient colors={['#2a1f4a', '#4a1f3c', '#1d1830']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <MaterialCommunityIcons name="microphone-variant" size={140} color="rgba(255,255,255,0.05)" style={{ position: 'absolute', right: -20, bottom: -10 }} />
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.gold }}>{`${t.emoji}  ${t.label.toUpperCase()}`}</Text>
      {caption ? <Text numberOfLines={3} style={{ fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 26, color: colors.text, textAlign: 'center', marginTop: space.md }}>{caption}</Text> : null}
      <View style={{ width: 76, height: 76, borderRadius: 38, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: space.lg }}>
        <LinearGradient colors={['#f5c842', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Ionicons name={st.playing ? 'pause' : 'play'} size={34} color="#fff" style={{ marginLeft: st.playing ? 0 : 4 }} />
      </View>
      <View style={{ width: '80%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: space.lg, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: 4, backgroundColor: colors.gold }} />
      </View>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginTop: 6 }}>{`${mmss(st.currentTime)} / ${mmss(st.duration)} · voice only`}</Text>
    </Pressable>
  );
}
