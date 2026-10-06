import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import ProfileHeader, { ProfileAction } from '../../components/ProfileHeader';
import SoulScoreOrb from '../../components/SoulScoreOrb';
import { PostGrid } from '../../components/PostCard';
import ReportModal from '../../components/ReportModal';
import ActionSheet from '../../components/ActionSheet';
import { confirm, notice } from '../../lib/confirm';
import { Button, Empty, Loading, s } from '../../components/ui';
import { colors, space, fonts } from '../../lib/theme';

export default function UserProfile() {
  const { username } = useLocalSearchParams();
  const { user: me } = useAuth();
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [conn, setConn] = useState(null);
  const [posts, setPosts] = useState(null);
  const [anon, setAnon] = useState(null);
  const load = useCallback(async () => {
    try {
      const d = await api(`/users/u/${encodeURIComponent(username)}`);
      setData(d); setError(null);
      if (d.canViewContent) api(`/posts/user/${d.user.id}`).then((p) => setPosts(p.posts)).catch(() => {});
      if (d.user.id !== me.id) api(`/connections/status/${d.user.id}`).then(setConn).catch(() => {});
      if (d.user.id !== me.id) api(`/anon/can/${d.user.id}`).then(setAnon).catch(() => setAnon(null));
    } catch (e) { setError(e); }
  }, [username, me.id]);

  useFocusEffect(useCallback(() => { load(); }, [load])); // refresh after coming back from Connect / requests

  const target = data?.user;

  const openMenu = useCallback(() => setMenu(true), []);

  const block = async () => {
    const ok = await confirm(`Block ${target.username}?`, "They won't be able to find your profile or see your content. They won't be told you blocked them.", { confirmText: 'Block', destructive: true });
    if (!ok) return;
    try { await api(`/blocks/${target.id}`, { method: 'POST' }); router.back(); } catch (e) { notice('Oops', e.message); }
  };

  useEffect(() => {
    navigation.setOptions({
      title: username,
      headerRight: () => (target && target.id !== me.id ? (
        <Pressable onPress={openMenu} hitSlop={10} accessibilityLabel="More options"><Ionicons name="ellipsis-horizontal" size={22} color={colors.text} /></Pressable>
      ) : null),
    });
  }, [navigation, username, target, me.id, openMenu]);

  if (error) return <View style={s.screen}><Empty icon="person-remove-outline" title={error.status === 404 ? "This account isn't available" : 'Something went wrong'} text={error.status === 404 ? 'The link may be broken, or the profile may have been removed.' : error.message} /></View>;
  if (!data) return <Loading />;

  const rel = data.relationship;

  const act = async (fn) => { setBusy(true); try { await fn(); await load(); } catch (e) { notice('Oops', e.message); } finally { setBusy(false); } };
  // Connecting unlocks after Soul DNA is created
  const needSoul = () => { if (me.soulReady) return false; router.push('/soul'); return true; };
  const follow = () => { if (!needSoul()) act(() => api(`/users/${target.id}/follow`, { method: 'POST' })); };
  const unfollow = async () => {
    const ok = await confirm(
      rel.following === 'pending' ? 'Cancel follow request?' : `Unfollow ${target.username}?`,
      target.isPrivate && rel.following === 'accepted' ? "You'll need to request again to see their posts." : undefined,
      { confirmText: rel.following === 'pending' ? 'Cancel request' : 'Unfollow', cancelText: 'Keep', destructive: true },
    );
    if (ok) act(() => api(`/users/${target.id}/follow`, { method: 'DELETE' }));
  };

  const openChat = async () => {
    if (needSoul()) return;
    try {
      const r = await api('/conversations/direct', { method: 'POST', body: { userId: target.id } });
      router.push(`/chat/${r.conversation.id}`);
    } catch (e) { notice('Could not open chat', e.message); }
  };

  let followBtn;
  if (rel.isMe) followBtn = <ProfileAction title="Edit profile" onPress={() => router.push('/edit-profile')} />;
  else if (rel.following === 'accepted') followBtn = <ProfileAction title="Following" icon="chevron-down" onPress={unfollow} loading={busy} />;
  else if (rel.following === 'pending') followBtn = <ProfileAction title="Requested" onPress={unfollow} loading={busy} />;
  else followBtn = <ProfileAction title={rel.followsYou ? 'Follow back' : 'Follow'} onPress={follow} loading={busy} />;

  // Connect button: Connect → Requested → (they answer) → Message. Follow stays separate (for posts).
  const goConnect = () => { if (!needSoul()) router.push({ pathname: '/connect/[userId]', params: { userId: target.id, username: target.username } }); };
  let connectBtn;
  if (!conn) connectBtn = <ProfileAction primary title="Connect" onPress={goConnect} />;
  else if (conn.connected) connectBtn = <ProfileAction title="Message" onPress={openChat} />;
  else if (conn.request?.direction === 'incoming') connectBtn = <ProfileAction primary title="Respond" onPress={() => router.push('/connections/requests')} />;
  else if (conn.request) connectBtn = <ProfileAction title={conn.request.status === 'held' ? 'On hold' : 'Requested'} icon={conn.request.status === 'held' ? 'pause-outline' : 'time-outline'} onPress={() => router.push('/connections/requests')} />;
  else if (conn.cooldownUntil) connectBtn = <ProfileAction title={`Try again ${new Date(conn.cooldownUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`} disabled onPress={() => {}} />;
  else connectBtn = <ProfileAction primary title="Connect" onPress={goConnect} />;

  // Anonymous message: hidden for 7 days or until they Soul Connect (not offered once connected)
  const goAnon = () => {
    if (needSoul()) return;
    if (anon?.threadId) router.push(`/anon/${anon.threadId}`);
    else router.push({ pathname: '/anon/[id]', params: { id: 'new', userId: target.id, username: target.username, name: target.displayName || target.username } });
  };
  const anonBtn = !rel.isMe && anon?.allowed && !conn?.connected ? (
    <ProfileAction icon="eye-off-outline" onPress={goAnon} style={{ flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: 38 }} />
  ) : null;

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      {rel.requestedYou ? (
        <View style={{ backgroundColor: colors.glass, borderWidth: 1, borderColor: 'rgba(124,92,252,0.4)', margin: space.xl, marginBottom: 0, padding: space.md, borderRadius: 20 }}>
          <Text style={{ fontFamily: fonts.body, color: colors.text, marginBottom: space.sm }}>{target.username} wants to follow you</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <ProfileAction primary title="Confirm" onPress={() => act(() => api(`/users/me/follow-requests/${target.id}/accept`, { method: 'POST' }))} />
            <ProfileAction title="Delete" onPress={() => act(() => api(`/users/me/follow-requests/${target.id}/decline`, { method: 'POST' }))} />
          </View>
        </View>
      ) : null}
      <ProfileHeader
        user={target}
        counts={data.counts}
        canViewLists={data.canViewContent}
        isMe={rel.isMe}
        actions={<>
          {followBtn}
          {!rel.isMe ? connectBtn : null}
          {anonBtn}
        </>}
      />
      {conn?.connected ? (
        <Text style={{ fontFamily: fonts.semibold, color: colors.mint, fontSize: 13, textAlign: 'center', marginBottom: space.sm }}>Connected · {conn.connected.intentLabel}</Text>
      ) : null}
      {data.soulScore ? (
        <SoulScoreOrb score={data.soulScore} name={(target.displayName || target.username).split(' ')[0]} intent={conn?.connected?.intent || conn?.request?.acceptedIntent || conn?.request?.intent} />
      ) : !rel.isMe && !me.soulReady ? (
        <Text onPress={() => router.push('/soul')} style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13, textAlign: 'center', paddingHorizontal: space.xl, marginBottom: space.md }}>Create your Soul DNA to see your Soul Score →</Text>
      ) : null}
      {rel.followsYou && !rel.isMe ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: -space.sm, marginBottom: space.sm }}>Follows you</Text> : null}
      {data.canViewContent
        ? (posts?.length ? <PostGrid posts={posts} /> : <Empty icon="camera-outline" title="No posts yet" />)
        : <Empty icon="lock-closed-outline" title="This account is private" text="Follow this account to see their photos and Soul Connections." />}
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={target.username}
        options={[{ label: 'Report', onPress: () => setReporting(true) }, { label: 'Block', destructive: true, onPress: block }]}
      />
      <ReportModal visible={reporting} onClose={() => setReporting(false)} targetType="user" targetId={target.id} />
    </ScrollView>
  );
}
