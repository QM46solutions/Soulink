// A video in a post (browser). thumb = small muted preview for grids.
// Stops by itself when scrolled away, when another screen or tab opens, or when the app goes to the background.
import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

// pauses when the screen it's on loses focus (a separate piece so the shared-link preview, which has no
// screens, can leave it out)
function PauseOnBlur({ video }) {
  useFocusEffect(useCallback(() => () => { video.current?.pause(); }, [video]));
  return null;
}

export default function PostVideo({ uri, thumb, style, standalone }) {
  const v = useRef(null);
  useEffect(() => {
    const el = v.current;
    if (!el || thumb || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([en]) => { if (!en.isIntersecting || en.intersectionRatio < 0.5) el.pause(); }, { threshold: [0, 0.5] });
    io.observe(el);
    const hide = () => { if (document.visibilityState === 'hidden') el.pause(); };
    document.addEventListener('visibilitychange', hide);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', hide); el.pause(); };
  }, [uri, thumb]);
  return (
    <>
    {!standalone ? <PauseOnBlur video={v} /> : null}
    <video ref={v} src={uri} playsInline controls={!thumb} muted={!!thumb} preload="metadata" loop={!thumb}
      controlsList="nodownload noremoteplayback noplaybackrate" disablePictureInPicture onContextMenu={(e) => e.preventDefault()}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', backgroundColor: '#000', ...(style || {}) }} />
    </>
  );
}
