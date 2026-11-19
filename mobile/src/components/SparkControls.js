// YouTube-style controls drawn over a Spark video: a big play / pause in the middle with 10 s back / forward,
// and along the bottom a progress bar you can tap or drag, the time, sound on / off and full screen.
// They show while the video is paused and for a few seconds after a tap; the player hides them again.
import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts } from '../lib/theme';

const fmt = (s) => { const t = Math.max(0, Math.floor(s || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const web = Platform.OS === 'web';

function Seek({ cur, dur, onSeek, onScrub }) {
  const w = useRef(1);
  const [drag, setDrag] = useState(null); // 0..1 while dragging
  const at = (e) => Math.max(0, Math.min(1, (e.nativeEvent.locationX ?? 0) / w.current));
  const k = drag ?? (dur ? Math.min(1, cur / dur) : 0);
  return (
    <View onLayout={(e) => { w.current = Math.max(1, e.nativeEvent.layout.width); }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => { const x = at(e); setDrag(x); onScrub?.(true); }}
      onResponderMove={(e) => setDrag(at(e))}
      onResponderRelease={(e) => { const x = at(e); setDrag(null); onScrub?.(false); onSeek(x * dur); }}
      onResponderTerminate={() => { setDrag(null); onScrub?.(false); }}
      accessibilityRole="adjustable" accessibilityLabel="Video progress" accessibilityValue={{ min: 0, max: Math.round(dur || 0), now: Math.round(cur || 0) }}
      style={[{ height: 28, justifyContent: 'center' }, web ? { cursor: 'pointer' } : null]}>
      <View pointerEvents="none" style={{ height: drag != null ? 5 : 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }}>
        <View style={{ width: `${k * 100}%`, height: '100%', borderRadius: 3, backgroundColor: '#ff3b5c' }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: `${k * 100}%`, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#ff3b5c' }} />
    </View>
  );
}

export default function SparkControls({ visible, playing, cur, dur, muted, onPlayPause, onSkip, onSeek, onMute, onFullscreen, fullscreen, onScrub, bottomInset = 0 }) {
  if (!visible) return null;
  const Btn = ({ icon, label, onPress, size = 22, mci }) => (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}>
      {mci ? <MaterialCommunityIcons name={icon} size={size} color="#fff" /> : <Ionicons name={icon} size={size} color="#fff" />}
    </Pressable>
  );
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)' }} />
      {/* middle: 10 s back, play / pause, 10 s forward */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={() => onSkip(-10)} hitSlop={10} accessibilityLabel="Back 10 seconds" style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <MaterialCommunityIcons name="rewind-10" size={28} color="#fff" />
        </Pressable>
        <Pressable onPress={onPlayPause} hitSlop={10} accessibilityLabel={playing ? 'Pause' : 'Play'}
          style={{ width: 72, height: 72, borderRadius: 36, marginHorizontal: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Ionicons name={playing ? 'pause' : 'play'} size={38} color="#fff" style={playing ? null : { marginLeft: 4 }} />
        </Pressable>
        <Pressable onPress={() => onSkip(10)} hitSlop={10} accessibilityLabel="Forward 10 seconds" style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <MaterialCommunityIcons name="fast-forward-10" size={28} color="#fff" />
        </Pressable>
      </View>
      {/* bottom: progress, time, sound, full screen */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 10, right: 10, bottom: 6 + bottomInset }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: '#fff', fontVariant: ['tabular-nums'] }}>{fmt(cur)} / {fmt(dur)}</Text>
          <View style={{ flex: 1 }} />
          {onMute ? <Btn icon={muted ? 'volume-mute' : 'volume-high'} label={muted ? 'Turn sound on' : 'Turn sound off'} onPress={onMute} size={20} /> : null}
          {onFullscreen ? <Btn icon={fullscreen ? 'fullscreen-exit' : 'fullscreen'} label={fullscreen ? 'Exit full screen' : 'Full screen'} onPress={onFullscreen} size={24} mci /> : null}
        </View>
        <Seek cur={cur} dur={dur} onSeek={onSeek} onScrub={onScrub} />
      </View>
    </View>
  );
}
