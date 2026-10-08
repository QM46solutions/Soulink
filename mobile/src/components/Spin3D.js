// A real 3D turntable: each product was rendered from 36 angles into one sprite sheet (6 × 6).
// We show one frame at a time, so the product turns smoothly and looks solid from every side.
import { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';

export default function Spin3D({ sheet, size = 260, frames = 36, cols = 6, msPerFrame = 85, paused = false, frame: fixed }) {
  const [i, setI] = useState(fixed ?? 0);
  const timer = useRef(null);
  useEffect(() => {
    if (paused || fixed != null) return undefined;
    timer.current = setInterval(() => setI((n) => (n + 1) % frames), msPerFrame);
    return () => clearInterval(timer.current);
  }, [paused, fixed, frames, msPerFrame]);
  const f = fixed ?? i;
  const rows = Math.ceil(frames / cols);
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }} pointerEvents="none">
      <Image source={sheet} fadeDuration={0}
        style={{ position: 'absolute', width: size * cols, height: size * rows, left: -(f % cols) * size, top: -Math.floor(f / cols) * size }} />
    </View>
  );
}
