import { useCallback, useState } from 'react';
import { SoulRequestsList } from '../connections/requests';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useRealtime } from '../../lib/realtime';
import { Avatar, Empty, ErrorText, s } from '../../components/ui';
import { MaskAvatar } from '../../components/anon';
import { colors, space, fonts } from '../../lib/theme';

const intentLabel = (k) => ({ friendship: 'Friendship 🤝', dating: 'Dating 💘', situationship: 'Situationship 🌗', buddy: 'Study / Work buddy 📚', networking: 'Networking 💼', vibing: 'Just vibing ✨', unsure: 'Not sure yet 🤔' }[k] || k);
const holdText = (d) => (d === 1 ? '1 day' : d === 7 ? '1 week' : d === 14 ? '2 weeks' : d === 30 ? '1 month' : `${d} days`);
// Connect notifications need details (intent, hold length) from meta
const CONNECT_TEXT = {
  connect_request: (m) => `wants to connect for ${intentLabel(m?.intent)}${m?.soulScore ? ` · Soul Score ${m.soulScore}%` : ''}.`,
  connect_accepted: (m) => (m?.mutual
    ? (m?.acceptedIntent ? `accepted your request as ${intentLabel(m.acceptedIntent)}. You're Connections now, say hi!` : "accepted your request. You're Connections now, say hi!")
    : `accepted your request${m?.acceptedIntent ? ` as ${intentLabel(m.acceptedIntent)}` : ''}. You're connected to them.`),
  connect_back: () => "connected back with you. You're Connections now, say hi!",
  connect_rejected: () => 'rejected your connect request.',
  connect_held: (m) => `put your connect request on hold for ${holdText(m?.days)}.`,
  connect_hold_extended: (m) => `extended the hold on your request by ${holdText(m?.days)}.`,
  connect_hold_reminder: () => "'s request: your hold ends soon. Changed your mind?",
  connect_suspended: () => "didn't answer in time. Your connect request was suspended.",
  anon_message: (m) => `Someone sent you an anonymous message${m?.alias ? ` as "${m.alias}"` : ''}. You'll see who in 7 days.`,
  anon_reply: () => 'replied to your anonymous message.',
  anon_revealed: (m) => `was "${m?.alias || 'Anonymous'}". ${m?.reason === 'connected' ? "You Soul Connected, so now you know who wrote to you." : 'The 7 days are up: now you know who wrote to you.'}`,
  anon_revealed_sender: (m) => `can now see you were "${m?.alias || 'Anonymous'}".`,
  argue_invite: (m) => `invited you to settle an argument${m?.topic ? `: "${m.topic}"` : ''}. Give your side!`,
  argue_verdict: (m) => `The Referee's verdict is in${m?.topic ? ` for "${m.topic}"` : ''}. Tap to see who's right.`,
};

const TEXT = {
  follow: 'connected to you.',
  follow_request: 'wants to connect with you.',
  follow_accept: 'accepted your request.',
  like: 'liked your post.',
  post_like: 'gave your post a 👌🏻.',
  spark_reaction: 'reacted to your Spark 🎬',
  spark_tried: (m) => (m?.category === 'fitness' ? 'did your workout 💪' : `tried your recipe${m?.dish ? ` for ${m.dish}` : ''} 😋`),
  post_comment: 'commented on your post.',
  post_suspended: 'Your post was suspended: more than 75 people found it offensive. Only you can see it now.',
  comment: 'commented on your post.',
  message: 'sent you a message.',
  case_invite: 'invited you to share your side of an argument.',
  verdict: 'A verdict is ready.',
};

const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
};

export default function Activity() {
  const { refreshUnread } = useRealtime();
  const [items, setItems] = useState([]);
  const [reqCount, setReqCount] = useState(0); // pending Requests (same number as on your profile)
  const [tab, setTab] = useState('activity'); // activity | requests
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([api('/notifications'), api('/connections/requests?box=incoming')]);
      setItems(n.notifications); setReqCount(c.requests.length); setError(null);
      if (n.unread) api('/notifications/read', { method: 'POST' }).then(() => refreshUnread()).catch(() => {});
    } catch (e) { setError(e.message); }
  }, [refreshUnread]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // top switch: Notifications | Requests (n)
  const switcher = (
    <View style={{ flexDirection: 'row', margin: space.lg, marginBottom: space.sm, backgroundColor: colors.inputBg, borderRadius: 999, borderWidth: 1, borderColor: colors.border, padding: 4 }}>
      {[['activity', 'Notifications'], ['requests', `Requests${reqCount ? ` (${reqCount})` : ''}`]].map(([k, label]) => {
        const on = tab === k;
        return (
          <Pressable key={k} onPress={() => setTab(k)} style={({ hovered }) => ({ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center',
            backgroundColor: on ? 'rgba(124,92,252,0.28)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent' })}>
            <Text style={{ color: on ? colors.text : colors.muted, fontFamily: on ? fonts.semibold : fonts.medium }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (tab === 'requests') {
    return (
      <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: space.xxl }}>
        {switcher}
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
          {/* answering here updates the Requests count on your profile */}
          <SoulRequestsList onChanged={(n) => { setReqCount(n); refreshUnread(); }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={s.screen}
      data={items}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <View>
          {switcher}
          <ErrorText>{error}</ErrorText>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            if (item.type === 'connect_request' || item.type === 'connect_hold_reminder') setTab('requests');
            else if ((item.type === 'connect_accepted' || item.type === 'connect_back') && item.meta?.conversationId) router.push(`/chat/${item.meta.conversationId}`);
            else if (['post_like', 'post_comment', 'post_suspended'].includes(item.type) && item.entityId) router.push(`/post/${item.entityId}`);
            else if (item.type.startsWith('anon_') && item.entityId) router.push(`/anon/${item.entityId}`);
            else if (item.type.startsWith('spark_')) router.push('/sparks');
            else if ((item.type === 'argue_invite' || item.type === 'argue_verdict') && item.meta?.caseId) router.push(`/argue/${item.meta.caseId}`);
            else if (item.actor) router.push(`/user/${item.actor.username}`);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.md, backgroundColor: item.read ? 'transparent' : 'rgba(124,92,252,0.07)' }}
        >
          {item.type === 'anon_message' ? <MaskAvatar size={44} /> : <Avatar uri={item.actor?.avatarUrl} name={item.actor?.username} />}
          <Text style={{ fontFamily: fonts.body, color: colors.text, flex: 1, marginLeft: space.md, lineHeight: 20 }}>
            {item.actor ? <Text style={{ fontFamily: fonts.bold }}>{item.actor.username} </Text> : null}
            {CONNECT_TEXT[item.type] ? CONNECT_TEXT[item.type](item.meta) : (typeof TEXT[item.type] === 'function' ? TEXT[item.type](item.meta) : TEXT[item.type]) || item.type}
            <Text style={{ fontFamily: fonts.body, color: colors.dim }}>  {ago(item.createdAt)}</Text>
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={<Empty icon="notifications-outline" title="No notifications yet" text="Requests, connections and likes will show up here." />}
    />
  );
}
