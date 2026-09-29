import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { api } from '../lib/api';
import { colors, space, fonts } from '../lib/theme';
import { ErrorText } from './ui';

const REASONS = [
  ['spam', 'Spam'], ['fake_account', 'Fake account'], ['harassment', 'Bullying or harassment'],
  ['hate_speech', 'Hate speech'], ['nudity', 'Nudity or sexual content'], ['violence', 'Violence or threats'],
  ['scam', 'Scam or fraud'], ['underage', 'May be under 18'], ['other', 'Something else'],
];

export default function ReportModal({ visible, onClose, targetType, targetId }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const send = async (reason) => {
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason } });
      setDone(true);
    } catch (e) { setError(e.message); }
  };
  const close = () => { setDone(false); setError(null); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={close} />
      <View style={{ backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.lg, paddingBottom: space.xxl }}>
        {done ? (
          <View style={{ alignItems: 'center', padding: space.xl }}>
            <Text style={{ color: colors.text, fontSize: 18, fontFamily: fonts.bold }}>Thanks for reporting</Text>
            <Text style={{ fontFamily: fonts.body, color: colors.muted, marginTop: space.sm, textAlign: 'center' }}>We'll review it. You can also block this account from their profile menu.</Text>
            <Pressable onPress={close} style={{ marginTop: space.xl }}><Text style={{ color: colors.aura, fontFamily: fonts.semibold }}>Done</Text></Pressable>
          </View>
        ) : (
          <>
            <Text style={{ color: colors.text, fontSize: 17, fontFamily: fonts.bold, marginBottom: space.md }}>Why are you reporting this?</Text>
            <ErrorText>{error}</ErrorText>
            {REASONS.map(([v, l]) => (
              <Pressable key={v} onPress={() => send(v)} style={({ pressed }) => ({ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 15 }}>{l}</Text>
              </Pressable>
            ))}
          </>
        )}
      </View>
    </Modal>
  );
}
