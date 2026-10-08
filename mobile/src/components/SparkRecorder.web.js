// Record a Spark inside Soulink (web), like Reels: front/back camera, timer (3 s / 10 s), and clips —
// tap to record, tap to pause, record again to add another clip, up to 60 seconds in total.
// The acting prompt / script / casting lines / open-mic theme can be shown on screen while recording.
// Result: { uri, type, oneTake, seconds } — oneTake is true when it was filmed in a single clip.
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Overlay } from '../lib/portal';
import { colors, fonts, gradients } from '../lib/theme';

const MAX = 60;
const mimeFor = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
};

export default function SparkRecorder({ visible, onClose, onDone, cue }) {
  const preview = useRef(null);
  const stream = useRef(null); const rec = useRef(null); const chunks = useRef([]); const tick = useRef(null);
  const tenths = useRef(0); const clipMarks = useRef([]); const typeRef = useRef('');
  const [facing, setFacing] = useState('user');
  const [state, setState] = useState('idle'); // idle | countdown | recording | paused
  const [time, setTime] = useState(0); // seconds, 0.1 steps
  const [marks, setMarks] = useState([]); // where each clip ends (s)
  const [timer, setTimer] = useState(0); // 0 | 3 | 10
  const [count, setCount] = useState(0);
  const [showCue, setShowCue] = useState(true);
  const [error, setError] = useState(null);

  const stopStream = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => {
    if (!visible) { stopStream(); return undefined; }
    if (state === 'recording' || state === 'paused') return undefined; // don't switch cameras mid-Spark
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        stopStream();
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (preview.current) { preview.current.srcObject = s; preview.current.play().catch(() => {}); }
      } catch (e) { setError(e.name === 'NotAllowedError' ? 'Allow the camera and microphone for Soulink, then try again.' : "Couldn't open the camera."); }
    })();
    return () => { cancelled = true; };
  }, [visible, facing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { clearInterval(tick.current); stopStream(); }, []);
  useEffect(() => { if (!visible) { setState('idle'); setTime(0); setMarks([]); tenths.current = 0; clipMarks.current = []; } }, [visible]);

  const runClock = () => {
    clearInterval(tick.current);
    tick.current = setInterval(() => {
      tenths.current += 1; setTime(tenths.current / 10);
      if (tenths.current >= MAX * 10) finish();
    }, 100);
  };
  const begin = () => {
    if (!stream.current) return;
    if (rec.current && rec.current.state === 'paused') { rec.current.resume(); setState('recording'); runClock(); return; }
    const type = mimeFor();
    if (type === null) { setError("This browser can't record video. Choose one from your gallery instead."); return; }
    typeRef.current = type; chunks.current = [];
    const r = new MediaRecorder(stream.current, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 2_500_000 });
    r.ondataavailable = (ev) => { if (ev.data?.size) chunks.current.push(ev.data); };
    r.onstop = () => {
      const blob = new Blob(chunks.current, { type: (typeRef.current || 'video/webm').split(';')[0] });
      stopStream();
      onDone({ uri: URL.createObjectURL(blob), type: blob.type, oneTake: clipMarks.current.length <= 1, seconds: tenths.current / 10 });
    };
    rec.current = r; r.start(500); setState('recording'); runClock();
  };
  const startWithTimer = () => {
    if (!timer) { begin(); return; }
    setState('countdown'); setCount(timer);
    let n = timer;
    const id = setInterval(() => { n -= 1; setCount(n); if (n <= 0) { clearInterval(id); begin(); } }, 1000);
  };
  const pauseClip = () => {
    clearInterval(tick.current);
    if (rec.current?.state === 'recording') {
      if (typeof rec.current.pause === 'function') rec.current.pause(); else { finish(); return; }
    }
    clipMarks.current = [...clipMarks.current, tenths.current / 10]; setMarks(clipMarks.current); setState('paused');
  };
  function finish() {
    clearInterval(tick.current);
    if (!clipMarks.current.length || clipMarks.current[clipMarks.current.length - 1] !== tenths.current / 10) clipMarks.current = [...clipMarks.current, tenths.current / 10];
    setState('idle');
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  }
  const close = () => { clearInterval(tick.current); if (rec.current && rec.current.state !== 'inactive') { rec.current.onstop = null; rec.current.stop(); } stopStream(); onClose(); };

  if (!visible) return null;
  const pct = Math.min(100, (time / MAX) * 100);
  const rolling = state === 'recording';
  return (
    <Overlay onClose={close} animationType="fade">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <video ref={preview} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : 'none' }} />
        {/* progress bar with a tick where each clip ended */}
        <View style={{ position: 'absolute', top: 14, left: 14, right: 14, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct}%`, height: 5 }} />
          {marks.map((m, i) => <View key={i} style={{ position: 'absolute', left: `${(m / MAX) * 100}%`, width: 2, height: 5, backgroundColor: '#fff' }} />)}
        </View>
        {cue && showCue ? (
          <Pressable onPress={() => setShowCue(false)} style={{ position: 'absolute', top: 86, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, padding: 12 }}>
            <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, textAlign: 'center' }}>{cue}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 4 }}>Tap to hide</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={{ position: 'absolute', top: '45%', left: 24, right: 24, color: '#fff', textAlign: 'center', fontFamily: fonts.semibold }}>{error}</Text> : null}
        {state === 'countdown' ? <Text style={{ position: 'absolute', top: '38%', alignSelf: 'center', color: '#fff', fontFamily: fonts.display, fontSize: 96 }}>{count}</Text> : null}

        <Pressable onPress={close} hitSlop={12} style={{ position: 'absolute', top: 30, left: 16 }} accessibilityLabel="Close"><Ionicons name="close" size={30} color="#fff" /></Pressable>
        <Text style={{ position: 'absolute', top: 34, alignSelf: 'center', color: rolling ? colors.spark : '#fff', fontFamily: fonts.bold, fontSize: 16 }}>
          {state === 'idle' && !time ? 'Up to 60 s · record in clips' : `${rolling ? '● ' : ''}${time.toFixed(1)}s / ${MAX}s`}
        </Text>
        {/* side tools: flip camera, timer, show the cue again */}
        <View style={{ position: 'absolute', top: 30, right: 14, alignItems: 'center', gap: 18 }}>
          {state === 'idle' && !time ? (
            <Pressable onPress={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} hitSlop={10} accessibilityLabel="Flip camera"><Ionicons name="camera-reverse" size={30} color="#fff" /></Pressable>
          ) : null}
          <Pressable onPress={() => setTimer((t) => (t === 0 ? 3 : t === 3 ? 10 : 0))} hitSlop={10} accessibilityLabel="Timer" style={{ alignItems: 'center' }}>
            <Ionicons name="timer-outline" size={28} color={timer ? colors.gold : '#fff'} />
            <Text style={{ color: timer ? colors.gold : '#fff', fontFamily: fonts.bold, fontSize: 11 }}>{timer ? `${timer}s` : 'Off'}</Text>
          </Pressable>
          {cue && !showCue ? <Pressable onPress={() => setShowCue(true)} hitSlop={10} accessibilityLabel="Show the prompt"><Ionicons name="document-text-outline" size={27} color="#fff" /></Pressable> : null}
        </View>

        <View style={{ position: 'absolute', bottom: 44, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 90 }} />
          <Pressable onPress={rolling ? pauseClip : state === 'countdown' ? undefined : startWithTimer} accessibilityLabel={rolling ? 'Pause' : 'Record'}
            style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: rolling ? 30 : 64, height: rolling ? 30 : 64, borderRadius: rolling ? 8 : 32, backgroundColor: colors.spark }} />
          </Pressable>
          {/* done: use what you've recorded */}
          <View style={{ width: 90, alignItems: 'center' }}>
            {(state === 'paused' || (state === 'recording' && time > 1)) ? (
              <Pressable onPress={finish} accessibilityLabel="Done" style={{ width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <Ionicons name="checkmark" size={30} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        </View>
        {state === 'paused' ? <Text style={{ position: 'absolute', bottom: 18, alignSelf: 'center', color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 12 }}>Tap to add another clip · ✓ when you're done</Text> : null}
      </View>
    </Overlay>
  );
}
