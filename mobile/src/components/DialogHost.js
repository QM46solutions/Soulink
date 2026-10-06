// Draws confirm()/notice() dialogs inside the app on the web build (lib/confirm.js). Instagram-style card:
// title, message, then full-width buttons separated by thin lines.
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { registerDialogHost } from '../lib/confirm';
import { Overlay } from '../lib/portal';
import { colors, fonts, space } from '../lib/theme';

export default function DialogHost() {
  const [queue, setQueue] = useState([]);
  useEffect(() => (Platform.OS === 'web' ? registerDialogHost((d) => setQueue((q) => [...q, d])) : undefined), []);
  const d = queue[0];
  if (!d) return null;
  const close = (answer) => { setQueue((q) => q.slice(1)); d.resolve(answer); };
  const Btn = ({ label, onPress, color, bold, first }) => (
    <Pressable onPress={onPress} style={({ hovered }) => ({ paddingVertical: 14, alignItems: 'center', borderTopWidth: first ? 1 : 0, borderTopColor: colors.border,
      backgroundColor: hovered ? 'rgba(255,255,255,0.05)' : 'transparent', borderBottomWidth: first && d.cancelText ? 1 : 0, borderBottomColor: colors.border })}>
      <Text style={{ fontFamily: bold ? fonts.semibold : fonts.body, fontSize: 15, color: color || colors.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <Overlay onClose={() => close(false)} animationType="fade">
      <Pressable onPress={() => close(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', cursor: 'default' }} />
      <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <View style={{ width: '100%', maxWidth: 300, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1b1828', borderWidth: 1, borderColor: colors.border }}>
          <View style={{ padding: space.lg, paddingTop: space.xl, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.text, textAlign: 'center' }}>{d.title}</Text>
            {d.message ? <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.muted, textAlign: 'center', marginTop: 8 }}>{d.message}</Text> : null}
          </View>
          <Btn first label={d.confirmText || 'OK'} bold color={d.destructive ? colors.danger : colors.aura} onPress={() => close(true)} />
          {d.cancelText ? <Btn label={d.cancelText} onPress={() => close(false)} /> : null}
        </View>
      </View>
    </Overlay>
  );
}
