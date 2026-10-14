// Share a post (or a Spark, ?kind=spark) into one or more chats: tap Send next to each person / group.
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ConversationAvatar } from '../components/chat';
import { Empty, ErrorText, Loading } from '../components/ui';
import { colors, fonts, gradients, space } from '../lib/theme';

export default function SharePost() {
  const { id, kind } = useLocalSearchParams();
  const base = kind === 'spark' ? 'sparks' : 'posts';
  const { user } = useAuth();
  const [chats, setChats] = useState(null);
  const [state, setState] = useState({}); // conversation id -> 'sending' | 'sent' | error text
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/conversations?box=inbox').then((r) => setChats(r.conversations.map((c) => ({ ...c, meId: user.id })))).catch((e) => { setError(e.message); setChats([]); });
  }, [user.id]);

  const send = async (c) => {
    setState((s) => ({ ...s, [c.id]: 'sending' }));
    try {
      await api(`/${base}/${id}/share`, { method: 'POST', body: { conversationIds: [c.id] } });
      setState((s) => ({ ...s, [c.id]: 'sent' }));
    } catch (e) { setState((s) => ({ ...s, [c.id]: e.message || 'Not sent' })); }
  };

  if (!chats) return <Loading />;
  return (
    <View style={{ flex: 1 }}>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingVertical: space.sm, flexGrow: 1 }}
        ListEmptyComponent={<Empty icon="paper-plane-outline" title="No chats yet" text="Connect with someone first, then you can send them posts." />}
        renderItem={({ item: c }) => {
          const st = state[c.id];
          const sent = st === 'sent';
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10 }}>
              <ConversationAvatar conversation={c} size={46} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>{c.title}</Text>
                {st && st !== 'sending' && !sent ? <Text numberOfLines={1} style={{ fontFamily: fonts.body, color: colors.danger, fontSize: 12 }}>{st}</Text>
                  : c.other?.username ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>@{c.other.username}</Text> : null}
              </View>
              <Pressable onPress={() => send(c)} disabled={st === 'sending' || sent}
                style={({ hovered }) => ({ paddingHorizontal: 18, height: 34, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', backgroundColor: sent ? 'rgba(255,255,255,0.1)' : 'transparent', transform: [{ scale: hovered && !sent ? 1.04 : 1 }] })}>
                {!sent ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
                <Text style={{ fontFamily: fonts.semibold, color: sent ? colors.text : '#fff', fontSize: 14 }}>{st === 'sending' ? '…' : sent ? 'Sent' : 'Send'}</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}
