// A video in a post (phone app). thumb = small muted preview for grids (first frame, no controls).
// Full videos show the phone's own controls, loop, and stop when you leave the screen or the app goes to the
// background. No download, no picture-in-picture.
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';

// pauses when the screen it's on loses focus (a separate piece so the shared-link preview, which has no
// screens, can leave it out)
function PauseOnBlur({ player }) {
  useFocusEffect(useCallback(() => () => { try { player.pause(); } catch { /* released */ } }, [player]));
  return null;
}

export default function PostVideo({ uri, thumb, style, standalone, active = true }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = !thumb; p.muted = !!thumb; });
  useEffect(() => { if (!active) try { player.pause(); } catch { /* released */ } }, [active, player]);
  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => { if (st !== 'active') try { player.pause(); } catch { /* released */ } });
    return () => s.remove();
  }, [player]);
  return (
    <>
      {!standalone && !thumb ? <PauseOnBlur player={player} /> : null}
      <VideoView player={player} nativeControls={!thumb} contentFit="cover" allowsPictureInPicture={false} allowsFullscreen={!thumb}
        style={[{ width: '100%', height: '100%', backgroundColor: '#000' }, style]} />
    </>
  );
}
