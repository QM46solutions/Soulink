import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Avatar, Empty, ErrorText, s } from '../../components/ui';
import { colors, space, fonts } from '../../lib/theme';

const TEXT = {
  follow: 'started following you.',
  follow_request: 'requested to follow you.',
  follow_accept: 'accepted your follow request.',
  like: 'liked your post.',
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
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [n, r] = await Promise.all([api('/notifications'), api('/users/me/follow-requests')]);
      setItems(n.notifications); setRequests(r.requests); setError(null);
      if (n.unread) api('/notifications/read', { method: 'POST' }).catch(() => {});
    } catch (e) { setError(e.message); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <FlatList
      style={s.screen}
      data={items}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <View>
          <ErrorText>{error}</ErrorText>
          {requests.length ? (
            <Pressable onPress={() => router.push('/requests')} style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-add" size={20} color={colors.aura} />
              </View>
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>Follow requests</Text>
                <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13 }}>{requests[0].user.username}{requests.length > 1 ? ` + ${requests.length - 1} others` : ''}</Text>
              </View>
              <View style={{ backgroundColor: colors.spark, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontFamily: fonts.bold }}>{requests.length}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => item.actor && router.push(`/user/${item.actor.username}`)}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: item.read ? 'transparent' : 'rgba(124,92,252,0.07)' }}
        >
          <Avatar uri={item.actor?.avatarUrl} name={item.actor?.username} />
          <Text style={{ fontFamily: fonts.body, color: colors.text, flex: 1, marginLeft: space.md, lineHeight: 20 }}>
            {item.actor ? <Text style={{ fontFamily: fonts.bold }}>{item.actor.username} </Text> : null}
            {TEXT[item.type] || item.type}
            <Text style={{ fontFamily: fonts.body, color: colors.dim }}>  {ago(item.createdAt)}</Text>
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={!requests.length ? <Empty icon="heart-outline" title="No activity yet" text="Follows, requests and likes will show up here." /> : null}
    />
  );
}
