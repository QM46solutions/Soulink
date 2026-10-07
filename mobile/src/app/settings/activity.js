// Settings > Your activity: posts you liked, your comments, requests you sent.
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { api, mediaUrl } from '../../lib/api';
import { intentOf } from '../../lib/intents';
import { PostGrid } from '../../components/PostCard';
import { Avatar, Empty, Loading, UserRow, s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

const TABS = [['likes', 'Likes 👌🏻'], ['comments', 'Comments'], ['requests', 'Requests sent']];
const STATUS = { pending: ['Waiting', colors.aura], held: ['On hold', colors.gold], accepted: ['Accepted', colors.mint], rejected: ['Declined', colors.danger], suspended: ['Expired', colors.muted], withdrawn: ['Withdrawn', colors.muted] };
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function Activity() {
  const [tab, setTab] = useState('likes');
  const [data, setData] = useState({});
  useEffect(() => {
    if (data[tab]) return;
    api(`/account/activity?kind=${tab}`).then((r) => setData((d) => ({ ...d, [tab]: r[tab === 'likes' ? 'posts' : tab] }))).catch(() => setData((d) => ({ ...d, [tab]: [] })));
  }, [tab, data]);
  const list = data[tab];

  const header = (
    <View style={{ flexDirection: 'row', padding: space.md, gap: 8 }}>
      {TABS.map(([k, label]) => (
        <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 14, borderWidth: 1,
          borderColor: tab === k ? colors.soul : colors.border, backgroundColor: tab === k ? 'rgba(124,92,252,0.22)' : 'transparent' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: tab === k ? colors.text : colors.muted }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
  if (!list) return <View style={s.screen}>{header}<Loading /></View>;
  if (tab === 'likes') {
    return (
      <FlatList style={s.screen} data={[]} renderItem={null} ListHeaderComponent={<>{header}{list.length ? <PostGrid posts={list} /> : <Empty icon="heart-outline" title="No likes yet" text="Posts you give a 👌🏻 show up here." />}</>} />
    );
  }
  return (
    <FlatList style={s.screen} data={list} keyExtractor={(x) => x.id} ListHeaderComponent={header}
      renderItem={({ item }) => (tab === 'comments' ? (
        <Pressable onPress={() => router.push(`/post/${item.post.id}`)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm }}>
          <Avatar uri={item.author.avatarUrl} name={item.author.username} size={36} />
          <View style={{ flex: 1, marginHorizontal: space.md }}>
            <Text numberOfLines={2} style={{ fontFamily: fonts.body, color: colors.text, fontSize: 14 }}>You commented on <Text style={{ fontFamily: fonts.semibold }}>{item.author.username}</Text>'s post: "{item.body}"</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>{day(item.createdAt)}</Text>
          </View>
          {item.post.thumb ? <Image source={{ uri: mediaUrl(item.post.thumb) }} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="cover" /> : null}
        </Pressable>
      ) : (
        <UserRow user={item.user} nameFirst onPress={() => router.push(`/user/${item.user.username}`)}
          subtitle={`${intentOf(item.intent).emoji} ${item.intentLabel || intentOf(item.intent).label} · ${day(item.createdAt)}`}
          right={<Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: (STATUS[item.status] || [])[1] || colors.muted }}>{(STATUS[item.status] || [item.status])[0]}</Text>} />
      ))}
      ListEmptyComponent={<Empty icon={tab === 'comments' ? 'chatbubble-outline' : 'paper-plane-outline'} title={tab === 'comments' ? 'No comments yet' : 'No requests sent'} />} />
  );
}
