// Phone app: keeps photos, videos and chats from being copied off the screen.
//  · Android: screenshots and screen recordings of Soulink come out black (the system's "secure screen" flag).
//  · iPhone: screen recordings are blocked; screenshots can't be blocked on iPhone, so the app covers itself
//    whenever it leaves the screen (app switcher, Control Centre), like banking apps do.
import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { colors, fonts } from '../lib/theme';

export default function PrivacyShield() {
  usePreventScreenCapture();
  const [away, setAway] = useState(AppState.currentState !== 'active');
  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => setAway(st !== 'active'));
    return () => s.remove();
  }, []);
  if (!away) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.void, alignItems: 'center', justifyContent: 'center', zIndex: 9999, elevation: 9999 }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 30, color: colors.text }}>Soulink</Text>
    </View>
  );
}
