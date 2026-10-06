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
  // Connect back with someone who is connected to you → you're Connections, chat opens
  const connectBack = async () => {
    if (needSoul()) return;
    setBusy(true);
    try { const r = await api(`/connections/back/${target.id}`, { method: 'POST' }); await load(); if (r.conversationId) router.push(`/chat/${r.conversationId}`); }
    catch (e) { notice('Oops', e.message); } finally { setBusy(false); }
  };
  const disconnect = async () => {
    const mutual = !!conn?.connected;
    const ok = await confirm(`Disconnect from ${target.displayName || target.username}?`,
      mutual ? `You'll no longer be Connections. ${target.displayName?.split(' ')[0] || target.username} stays connected to you as a Follower until they disconnect too.` : undefined,
      { confirmText: 'Disconnect', cancelText: 'Keep', destructive: true });
    if (ok) act(() => api(`/connections/with/${target.id}`, { method: 'DELETE' }));
  };

  const openChat = async () => {
    if (needSoul()) return;
    try {
      const r = await api('/conversations/direct', { method: 'POST', body: { userId: target.id } });
      router.push(`/chat/${r.conversation.id}`);
    } catch (e) { notice('Could not open chat', e.message); }
  };

  // One button for everything: Connect → Requested → (they accept) Connected → they connect back → Connections
  const goConnect = () => { if (!needSoul()) router.push({ pathname: '/connect/[userId]', params: { userId: target.id, username: target.username } }); };
  let connectBtn = null;
  let messageBtn = null;
  if (rel.isMe) connectBtn = <ProfileAction title="Edit profile" onPress={() => router.push('/edit-profile')} />;
  else if (conn?.connected) {
    connectBtn = <ProfileAction title="Connected" icon="checkmark-done" onPress={disconnect} loading={busy} />;
    messageBtn = <ProfileAction primary title="Message" onPress={openChat} />;
  } else if (conn?.request?.direction === 'incoming') connectBtn = <ProfileAction primary title="Respond" onPress={() => router.push('/activity')} />;
  else if (conn?.theyConnect) connectBtn = <ProfileAction primary title="Connect back" icon="person-add" onPress={connectBack} loading={busy} />;
  else if (conn?.iConnect) connectBtn = <ProfileAction title="Connected" icon="checkmark" onPress={disconnect} loading={busy} />;
  else if (conn?.request) connectBtn = <ProfileAction title={conn.request.status === 'held' ? 'On hold' : 'Requested'} icon={conn.request.status === 'held' ? 'pause-outline' : 'time-outline'} onPress={() => router.push('/activity')} />;
  else if (conn?.cooldownUntil) connectBtn = <ProfileAction title={`Try again ${new Date(conn.cooldownUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`} disabled onPress={() => {}} />;
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
      <ProfileHeader
        user={target}
        counts={data.counts}
        pulse={data.pulse}
        canViewLists={data.canViewContent}
        isMe={rel.isMe}
        actions={<>
          {connectBtn}
          {messageBtn}
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
      {conn?.theyConnect && !conn?.connected && !rel.isMe ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: -space.sm, marginBottom: space.sm }}>Connected to you · connect back to become Connections</Text> : null}
      {data.canViewContent
        ? (posts?.length ? <PostGrid posts={posts} /> : <Empty icon="camera-outline" title="No posts yet" />)
        : <Empty icon="lock-closed-outline" title="This account is private" text="Connect with this account to see their photos and Connections." />}
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
