// A faint "@username" over photos and videos: anyone who screenshots one shows who they are. (A website can't block
// screenshots; on the web this is the deterrent. The phone apps can also block them on Android.)
import { Text, View } from 'react-native';
import { useAuth } from '../lib/auth';

export default function Watermark({ label }) {
  const user = useAuth()?.user; // none on the shared-link preview (no login)
  const text = label || (user?.username ? `@${user.username}` : 'Soulink');
  const spots = [{ top: '18%', left: '8%' }, { top: '52%', right: '8%' }, { bottom: '14%', left: '22%' }];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {spots.map((p, i) => (
        <Text key={i} selectable={false} style={{ position: 'absolute', ...p, transform: [{ rotate: '-22deg' }], color: 'rgba(255,255,255,0.16)', fontSize: 15, fontWeight: '700', letterSpacing: 1 }}>{text}</Text>
      ))}
    </View>
  );
}
