import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import ProfileHeader, { ProfileAction, ProfileTabs } from '../../components/ProfileHeader';
import ProfileSparks from '../../components/ProfileSparks';
import MatchPanel from '../../components/MatchPanel';
import ConnectSheet from '../../components/ConnectSheet';
import { Incoming } from '../connections/requests';
import PaidMessageSheet from '../../components/PaidMessageSheet';
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
  const [paidOpen, setPaidOpen] = useState(false); // Premium: one paid message
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef(null); const decideY = useRef(0); // the Accept · Hold · Reject card

  const [conn, setConn] = useState(null);
  const [posts, setPosts] = useState(null);
  const [anon, setAnon] = useState(null);
  const [tab, setTab] = useState('posts'); // posts | sparks | soul
  const [connectOpen, setConnectOpen] = useState(false);
  const [priv, setPriv] = useState(null); // what I've set for this person: restricted / muted / Moments hidden
  const setPerson = async (patch, title, text) => {
    try { setPriv(await api(`/privacy/people/${data.user.id}`, { method: 'PUT', body: patch })); notice(title, text || undefined); }
    catch (e) { notice("Couldn't change that", e.message); }
  };
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

  const openMenu = useCallback(() => {
    setMenu(true);
    if (data?.user?.id && !data.relationship?.isMe) api(`/privacy/people/${data.user.id}`).then(setPriv).catch(() => {});
  }, [data]);

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
    try { await api(`/connections/back/${target.id}`, { method: 'POST' }); await load(); } // Connections now; Message is on the profile
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

  // The row on someone's profile: Follow · Connect · a message icon (and the anonymous-note icon for Connections).
  // Connect is the main step on Soulink, so it carries the gradient whenever it's something you can do.
  // One Connect button for everything: Connect → Requested → (they accept) Connected → they connect back → Connections
  const goConnect = () => { if (!needSoul()) setConnectOpen(true); };
  let connectBtn = null;
  if (rel.isMe) connectBtn = <ProfileAction title="Edit profile" onPress={() => router.push('/edit-profile')} />;
  else if (conn?.connected) connectBtn = <ProfileAction title="Connected" icon="checkmark-done" onPress={disconnect} loading={busy} />;
  // they've asked to connect: the Accept · Hold · Reject card is right here on their profile (below the buttons)
  else if (conn?.request?.direction === 'incoming') connectBtn = <ProfileAction primary title={conn.request.status === 'held' ? 'On hold · decide' : 'Respond below'} icon="arrow-down" onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, decideY.current - 12), animated: true })} />;
  else if (conn?.theyConnect) connectBtn = <ProfileAction primary title="Connect back" onPress={connectBack} loading={busy} />;
  else if (conn?.iConnect) connectBtn = <ProfileAction title="Connected" icon="checkmark" onPress={disconnect} loading={busy} />;
  else if (conn?.request) connectBtn = <ProfileAction title={conn.request.status === 'held' ? 'On hold' : 'Requested'} icon={conn.request.status === 'held' ? 'pause-outline' : 'time-outline'} onPress={() => router.push('/activity')} />;
  else if (conn?.cooldownUntil) connectBtn = <ProfileAction title={`Try ${new Date(conn.cooldownUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`} disabled onPress={() => {}} />;
  else connectBtn = <ProfileAction primary title="Connect" onPress={goConnect} />;

  // Anonymous message: only to your Connections. You choose how long you stay hidden; then they see it was you.
  const goAnon = () => {
    if (needSoul()) return;
    if (anon?.threadId) router.push(`/anon/${anon.threadId}`);
    else router.push({ pathname: '/anon/[id]', params: { id: 'new', userId: target.id, username: target.username, name: target.displayName || target.username } });
  };
  // Message (an icon): Connections chat; a request on hold can chat until the hold ends; anyone else gets the
  // Premium one-message sheet (₹500), which explains itself. Blocked: no message icon.
  let messageBtn = null;
  if (!rel.isMe && (conn?.connected || conn?.request?.status === 'held')) messageBtn = <ProfileAction icon="chatbubble-ellipses-outline" label="Message" onPress={openChat} />;
  else if (!rel.isMe && !conn?.blocked) messageBtn = <ProfileAction icon="chatbubble-ellipses-outline" label="Send one Premium message" onPress={() => { if (!needSoul()) setPaidOpen(true); }} />;
  // Public profiles: Follow (see their posts and Sparks, no request, no chat) comes first. Private: Connect only.
  const following = rel.following === 'accepted' && rel.followKind === 'follow';
  const followBtn = !rel.isMe && !target.isPrivate && !conn?.connected && !conn?.iConnect ? (
    <ProfileAction title={following ? 'Following' : 'Follow'} icon={following ? 'checkmark' : 'add'} loading={busy}
      onPress={() => { if (!needSoul()) act(() => api(`/users/${target.id}/follow`, { method: following ? 'DELETE' : 'POST' })); }} />
  ) : null;
  const anonBtn = !rel.isMe && anon?.allowed && conn?.connected ? <ProfileAction icon="eye-off-outline" label="Send an anonymous note" onPress={goAnon} /> : null;

  return (
    <ScrollView ref={scrollRef} style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <ProfileHeader
        user={target}
        counts={data.counts}
        pulse={data.pulse}
        canViewLists={data.canViewContent}
        isMe={rel.isMe}
        actions={<>
          {followBtn}
          {connectBtn}
          {messageBtn}
          {anonBtn}
        </>}
      />
      {conn?.connected ? (
        <Text style={{ fontFamily: fonts.semibold, color: colors.mint, fontSize: 13, textAlign: 'center', marginBottom: space.sm }}>Connected · {conn.connected.intentLabel}</Text>
      ) : null}
      {!rel.isMe && conn?.request?.direction === 'incoming' && conn.request.user ? (
        <View onLayout={(e) => { decideY.current = e.nativeEvent.layout.y; }} style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
          <Incoming r={conn.request} onDone={load} />
        </View>
      ) : null}
      {conn?.theyConnect && !conn?.connected && !rel.isMe ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: -space.sm, marginBottom: space.sm }}>Connected to you · connect back to become Connections</Text> : null}
      {/* Posts · Sparks · Soul Score. The Soul Score tab shows before and after you're connected, even on private accounts */}
      {data.canViewContent || !rel.isMe ? <ProfileTabs tab={tab} onChange={setTab} items={rel.isMe ? undefined : [['posts', 'Posts'], ['sparks', 'Sparks'], ['soul', 'Soul Score']]} /> : null}
      {tab === 'soul' && !rel.isMe ? (
        <View style={{ paddingTop: space.lg }}>
          {data.match ? <MatchPanel match={data.match} userId={target.id} name={(target.displayName || target.username).split(' ')[0]} />
            : me.soulReady ? <Empty icon="sparkles-outline" title="No Soul Score yet" text={`Your Soul Score shows once ${(target.displayName || target.username).split(' ')[0]} takes the new Soul DNA.`} />
              : <View style={{ alignItems: 'center' }}>
                <Empty icon="sparkles-outline" title="See how you match" text="Create your Soul DNA to see your Soul Score with anyone." />
                <Button title="Create my Soul DNA" onPress={() => router.push('/soul')} style={{ marginTop: space.sm, alignSelf: 'center' }} />
              </View>}
        </View>
      ) : data.canViewContent
        ? (tab === 'sparks' ? <ProfileSparks userId={target.id} username={target.username} isMe={rel.isMe} name={(target.displayName || target.username).split(' ')[0]} />
          : posts?.length ? <PostGrid posts={posts} tall /> : <Empty icon="camera-outline" title="No posts yet" />)
        : <Empty icon="lock-closed-outline" title="This account is private" text="Connect with this account to see their photos and Connections." />}
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={target.username}
        options={[
          ...(priv ? [
            { label: priv.restricted ? 'Unrestrict' : 'Restrict', onPress: () => setPerson({ restricted: !priv.restricted }, priv.restricted ? 'Unrestricted' : 'Restricted', priv.restricted ? null : "Their new comments on your posts are seen only by them. They aren't told.") },
            { label: priv.mutePosts || priv.muteMoments ? 'Unmute' : 'Mute posts and Moments', onPress: () => { const on = !(priv.mutePosts || priv.muteMoments); setPerson({ mutePosts: on, muteMoments: on }, on ? 'Muted' : 'Unmuted', on ? "You won't see their posts or Moments in your feed. They aren't told." : null); } },
            { label: priv.momentsHidden ? 'Show my Moments to them' : 'Hide my Moments from them', onPress: () => setPerson({ momentsHidden: !priv.momentsHidden }, priv.momentsHidden ? 'Moments shown' : 'Moments hidden', priv.momentsHidden ? null : "They won't see your Moments. They aren't told.") },
          ] : []),
          { label: 'Report', onPress: () => setReporting(true) }, { label: 'Block', destructive: true, onPress: block },
        ]}
      />
      <PaidMessageSheet visible={paidOpen} onClose={() => setPaidOpen(false)} user={target} />
      <ConnectSheet visible={connectOpen} onClose={() => setConnectOpen(false)} user={target} onSent={load} />
      <ReportModal visible={reporting} onClose={() => setReporting(false)} targetType="user" targetId={target.id} />
    </ScrollView>
  );
}
