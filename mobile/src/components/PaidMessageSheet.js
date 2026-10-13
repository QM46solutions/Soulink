// Premium: one message to someone you're not connected with, ₹500. It lands in their Requests;
// they reply by connecting with you. (Real payments open once a payment gateway is set up.)
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { BottomSheet } from './PostSheets';
import { colors, fonts, gradients, space } from '../lib/theme';

export default function PaidMessageSheet({ visible, onClose, user }) {
  const [info, setInfo] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setError(null); setText('');
    api('/conversations/paid-message').then(setInfo).catch(() => setInfo({ priceInr: 500, available: false }));
  }, [visible]);
  const first = user?.displayName?.split(' ')[0] || user?.username;
  const send = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api('/conversations/paid-message', { method: 'POST', body: { userId: user.id, body: text.trim() } });
      onClose();
      router.push(`/chat/${r.conversation.id}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const price = info?.priceInr ?? 500;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Send one message">
      <View style={{ padding: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={['#f5c842', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Ionicons name="diamond" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.text }}>Premium message · ₹{price}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 }}>
              You're not connected with {first}. One message goes to their Requests; they can reply by connecting with you.
            </Text>
          </View>
        </View>
        <TextInput value={text} onChangeText={setText} maxLength={500} multiline placeholder={`Write to ${first}…`} placeholderTextColor={colors.dim}
          style={{ minHeight: 110, borderRadius: 16, padding: space.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, textAlignVertical: 'top', outlineStyle: 'none' }} />
        <Text style={{ alignSelf: 'flex-end', fontFamily: fonts.mono, fontSize: 10.5, color: colors.dim, marginTop: 4 }}>{text.length}/500</Text>
        {info && !info.available ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.gold, marginTop: space.sm, textAlign: 'center' }}>Paid messages are coming soon: payments aren't switched on yet.</Text>
        ) : null}
        {info?.test ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: space.sm, textAlign: 'center' }}>Test mode on this laptop: no money is taken.</Text> : null}
        {error ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.danger, marginTop: space.sm, textAlign: 'center' }}>{error}</Text> : null}
        <Pressable onPress={send} disabled={busy || !text.trim() || !info?.available}
          style={{ marginTop: space.lg, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: busy || !text.trim() || !info?.available ? 0.5 : 1 }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          {busy ? <ActivityIndicator color="#fff" /> : (<>
            <Ionicons name="diamond" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>{info?.test ? 'Send (test, free)' : `Pay ₹${price} & send`}</Text>
          </>)}
        </Pressable>
      </View>
    </BottomSheet>
  );
}
