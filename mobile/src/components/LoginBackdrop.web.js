// Login page background (browser): the Soulink animation, looping, muted, behind everything.
// A soft dark wash on top keeps the text and buttons easy to read.
// iPhone Safari only autoplays a video that is muted *as an HTML attribute* and plays inline, and React doesn't
// write the muted attribute. So we set it ourselves, call play() straight away, and if the phone still refuses
// (Low Power Mode does that) we start it on the very first touch anywhere on the page.
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

const asUrl = (m) => (typeof m === 'string' ? m : m?.uri || m?.default || '');
const VIDEO = asUrl(require('../../assets/login-bg.mp4'));
const POSTER = asUrl(require('../../assets/login-bg.jpg'));

export default function LoginBackdrop() {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    const play = () => { const p = v.play(); if (p?.catch) p.catch(() => {}); };
    play();
    const onTouch = () => { if (v.paused) play(); };
    const onVisible = () => { if (document.visibilityState === 'visible' && v.paused) play(); };
    v.addEventListener('canplay', onTouch);
    document.addEventListener('touchstart', onTouch, { passive: true });
    document.addEventListener('pointerdown', onTouch);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      v.removeEventListener('canplay', onTouch);
      document.removeEventListener('touchstart', onTouch);
      document.removeEventListener('pointerdown', onTouch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: '#08070d' }}>
      <video ref={ref} src={VIDEO} poster={POSTER} autoPlay muted loop playsInline preload="auto" disablePictureInPicture disableRemotePlayback aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,7,13,0.6) 0%, rgba(8,7,13,0.42) 35%, rgba(8,7,13,0.55) 60%, rgba(8,7,13,0.88) 100%)' }} />
    </View>
  );
}
