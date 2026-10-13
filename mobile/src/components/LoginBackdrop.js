// Login page background (phone app build): a still frame of the Soulink animation.
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginBackdrop() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#08070d' }}>
      <Image source={require('../../assets/login-bg.jpg')} contentFit="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <LinearGradient colors={['rgba(8,7,13,0.55)', 'rgba(8,7,13,0.25)', 'rgba(8,7,13,0.85)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
    </View>
  );
}
