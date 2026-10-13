// A video in a post (phone app build): videos play in the web version for now.
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../lib/theme';

export default function PostVideo({ thumb }) {
  return (
    <View style={{ flex: 1, minHeight: thumb ? 0 : 240, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="play-circle" size={thumb ? 28 : 54} color="#fff" />
      {thumb ? null : <Text style={{ color: colors.muted, fontFamily: fonts.body, marginTop: 6 }}>Open Soulink in the browser to play videos.</Text>}
    </View>
  );
}
