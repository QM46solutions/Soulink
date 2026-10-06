import { Pressable, Text, View } from 'react-native';
import { Overlay } from '../lib/portal';
import { useOpenGuard, useSafeClose } from '../lib/safeClose';
import { colors, space, fonts } from '../lib/theme';

/** Bottom sheet menu. options: [{ label, onPress, destructive }] */
export default function ActionSheet({ visible, onClose, title, options }) {
  const backdropClose = useSafeClose(visible, onClose);
  const ready = useOpenGuard(visible);
  if (!visible) return null;
  return (
    <Overlay onClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', cursor: 'default' }} onPress={backdropClose} />
      <View style={{ backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.lg, paddingBottom: space.xxl }}>
        {title ? <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', marginBottom: space.md }}>{title}</Text> : null}
        {options.map((o) => (
          <Pressable
            key={o.label}
            onPress={() => { if (!ready()) return; onClose(); setTimeout(o.onPress, 250); }}
            style={({ pressed }) => ({ paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: o.destructive ? colors.danger : colors.text, fontSize: 16, textAlign: 'center', fontFamily: o.destructive ? fonts.semibold : fonts.body }}>{o.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={{ paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 16, textAlign: 'center' }}>Cancel</Text>
        </Pressable>
      </View>
    </Overlay>
  );
}
