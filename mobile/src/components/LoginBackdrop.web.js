// Login page background (browser): the Soulink animation, looping, muted, behind everything.
// A soft dark wash on top keeps the text and buttons easy to read.
import { View } from 'react-native';

const asUrl = (m) => (typeof m === 'string' ? m : m?.uri || m?.default || '');
const VIDEO = asUrl(require('../../assets/login-bg.mp4'));
const POSTER = asUrl(require('../../assets/login-bg.jpg'));

export default function LoginBackdrop() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: '#08070d' }}>
      <video src={VIDEO} poster={POSTER} autoPlay muted loop playsInline preload="auto" aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,7,13,0.6) 0%, rgba(8,7,13,0.42) 35%, rgba(8,7,13,0.55) 60%, rgba(8,7,13,0.88) 100%)' }} />
    </View>
  );
}
