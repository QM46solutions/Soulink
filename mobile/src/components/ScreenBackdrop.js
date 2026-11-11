// Phones only: Android keeps the previous screen drawn underneath the one you open, so a see-through screen
// showed the screen behind it (Settings on top of Profile, two headers on top of each other).
// Every phone screen now gets its own galaxy sky behind it; the browser version is unchanged (one shared sky).
import { Platform, View } from 'react-native';
import GalaxyBackground from './GalaxyBackground';

export const SKY = '#07060c'; // the galaxy's base colour

export const screenLayout = Platform.OS === 'web'
  ? undefined
  : ({ children }) => (
    <View style={{ flex: 1, backgroundColor: SKY }}>
      <GalaxyBackground />
      {children}
    </View>
  );
