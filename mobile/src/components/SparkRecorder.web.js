// Record a Spark inside Soulink (web): one take, up to 60 seconds, front or back camera.
// The acting prompt / script can be shown on screen while recording. Result: { uri, type, oneTake: true }.
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Overlay } from '../lib/portal';
import { colors, fonts } from '../lib/theme';

const MAX = 60;
const mimeFor = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
};

export default function SparkRecorder({ visible, onClose, onDone, cue }) {
  const preview = useRef(null);
  const stream = useRef(null); const rec = useRef(null); const chunks = useRef([]); const timer = useRef(null); const count = useRef(0);
  const [facing, setFacing] = useState('user');
  const [secs, setSecs] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);

  const stopStream = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => {
    if (!visible) { stopStream(); return undefined; }
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
  }, [visible, facing]);
  useEffect(() => () => { clearInterval(timer.current); stopStream(); }, []);

  const start = () => {
    if (!stream.current) return;
    const type = mimeFor();
    if (type === null) { setError("This browser can't record video. Choose one from your gallery instead."); return; }
    chunks.current = [];
    const r = new MediaRecorder(stream.current, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 2_500_000 });
    r.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data); };
    r.onstop = () => {
      const blob = new Blob(chunks.current, { type: (type || 'video/webm').split(';')[0] });
      stopStream();
      onDone({ uri: URL.createObjectURL(blob), type: blob.type, oneTake: true, seconds: count.current });
    };
    rec.current = r; r.start(500); setRecording(true); setSecs(0); count.current = 0;
    timer.current = setInterval(() => { count.current += 1; setSecs(count.current); if (count.current >= MAX) stop(); }, 1000);
  };
  function stop() { clearInterval(timer.current); setRecording(false); if (rec.current?.state === 'recording') rec.current.stop(); }

  if (!visible) return null;
  return (
    <Overlay onClose={onClose} animationType="fade">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <video ref={preview} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : 'none' }} />
        {cue ? (
          <View style={{ position: 'absolute', top: 70, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, padding: 12 }}>
            <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, textAlign: 'center' }}>{cue}</Text>
          </View>
        ) : null}
        {error ? <Text style={{ position: 'absolute', top: '45%', left: 24, right: 24, color: '#fff', textAlign: 'center', fontFamily: fonts.semibold }}>{error}</Text> : null}
        <Pressable onPress={() => { stop(); stopStream(); onClose(); }} hitSlop={12} style={{ position: 'absolute', top: 22, left: 18 }} accessibilityLabel="Close"><Ionicons name="close" size={30} color="#fff" /></Pressable>
        <Text style={{ position: 'absolute', top: 26, alignSelf: 'center', color: recording ? colors.spark : '#fff', fontFamily: fonts.bold, fontSize: 16 }}>
          {recording ? `● ${secs}s / ${MAX}s` : 'One take · up to 60 s'}
        </Text>
        {!recording ? (
          <Pressable onPress={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} hitSlop={12} style={{ position: 'absolute', top: 22, right: 18 }} accessibilityLabel="Flip camera">
            <Ionicons name="camera-reverse" size={30} color="#fff" />
          </Pressable>
        ) : null}
        <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' }}>
          <Pressable onPress={recording ? stop : start} accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
            style={{ width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: recording ? 32 : 62, height: recording ? 32 : 62, borderRadius: recording ? 8 : 31, backgroundColor: colors.spark }} />
          </Pressable>
        </View>
      </View>
    </Overlay>
  );
}
