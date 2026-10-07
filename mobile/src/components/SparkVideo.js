// Sparks video player (phone app build): shown in the web version for now.
import { Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

export default function SparkVideo({ height = 520 }) {
  return (
    <View style={{ height, borderRadius: 20, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.muted, fontFamily: fonts.body }}>Open Soulink in the browser to play Sparks.</Text>
    </View>
  );
}
