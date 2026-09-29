import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import ProfileHeader from '../../components/ProfileHeader';
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

  const load = useCallback(async () => {
    try { setData(await api(`/users/u/${encodeURIComponent(username)}`)); setError(null); } catch (e) { setError(e); }
  }, [username]);

  useEffect(() => { load(); }, [load]);

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
  if (rel.isMe) followBtn = <Button title="Edit profile" variant="secondary" style={{ flex: 1, height: 48 }} onPress={() => router.push('/edit-profile')} />;
  else if (rel.following === 'accepted') followBtn = <Button title="Following" icon="chevron-down" variant="secondary" style={{ flex: 1, height: 48 }} onPress={unfollow} loading={busy} />;
  else if (rel.following === 'pending') followBtn = <Button title="Requested" variant="secondary" style={{ flex: 1, height: 48 }} onPress={unfollow} loading={busy} />;
  else followBtn = <Button title={rel.followsYou ? 'Follow back' : 'Follow'} style={{ flex: 1, height: 48 }} onPress={follow} loading={busy} />;

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      {rel.requestedYou ? (
        <View style={{ backgroundColor: colors.glass, borderWidth: 1, borderColor: 'rgba(124,92,252,0.4)', margin: space.xl, marginBottom: 0, padding: space.md, borderRadius: 20 }}>
          <Text style={{ fontFamily: fonts.body, color: colors.text, marginBottom: space.sm }}>{target.username} wants to follow you</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Confirm" style={{ flex: 1, height: 48 }} onPress={() => act(() => api(`/users/me/follow-requests/${target.id}/accept`, { method: 'POST' }))} />
            <Button title="Delete" small variant="secondary" style={{ flex: 1 }} onPress={() => act(() => api(`/users/me/follow-requests/${target.id}/decline`, { method: 'POST' }))} />
          </View>
        </View>
      ) : null}
      <ProfileHeader
        user={target}
        counts={data.counts}
        canViewLists={data.canViewContent}
        actions={<>
          {followBtn}
          {!rel.isMe ? <Button title="Message" variant="secondary" style={{ flex: 1, height: 48 }} onPress={openChat} /> : null}
        </>}
      />
      {data.soulScore ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: space.md, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(176,143,255,0.45)', backgroundColor: 'rgba(124,92,252,0.12)' }}>
          <Ionicons name="sparkles" size={14} color={colors.aura} style={{ marginRight: 6 }} />
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>Soul Score {data.soulScore}%</Text>
        </View>
      ) : !rel.isMe && !me.soulReady ? (
        <Text onPress={() => router.push('/soul')} style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13, textAlign: 'center', paddingHorizontal: space.xl, marginBottom: space.md }}>Create your Soul DNA to see your Soul Score →</Text>
      ) : null}
      {rel.followsYou && !rel.isMe ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: -space.sm, marginBottom: space.sm }}>Follows you</Text> : null}
      {data.canViewContent
        ? <Empty icon="camera-outline" title="No posts yet" />
        : <Empty icon="lock-closed-outline" title="This account is private" text="Follow this account to see their photos and followers." />}
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
