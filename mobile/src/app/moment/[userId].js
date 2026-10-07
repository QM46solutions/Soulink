// Watch someone's Moments: tap the right side for the next one, the left side to go back (no swiping).
// Others: reply or react (goes to your chat with them). Yours: see who viewed it, or delete it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, mediaUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirm, notice } from '../../lib/confirm';
import { bgOf } from '../../lib/moments';
import { BottomSheet } from '../../components/PostSheets';
import { Avatar, UserRow } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

const SHOW_MS = 5000;
const EMOJIS = ['😍', '😂', '🔥', '👌🏻', '😮', '🥺'];
const WRAP = Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'anywhere' } : {};
const ago = (iso) => { const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`; };

export default function MomentViewer() {
  const { userId } = useLocalSearchParams();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [i, setI] = useState(0);
  const [reply, setReply] = useState('');
  const [typing, setTyping] = useState(false);
  const [sentNote, setSentNote] = useState(null);
  const [viewers, setViewers] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef(null);

  useEffect(() => {
    api(`/moments/user/${userId === 'me' ? me.id : userId}`).then((d) => {
      if (!d.moments.length) { router.back(); return; }
      setData(d);
      const firstNew = d.moments.findIndex((m) => !m.seen);
      setI(firstNew > 0 ? firstNew : 0);
    }).catch((e) => { notice('Moments', e.message); router.back(); });
  }, [userId, me.id]);

  const moment = data?.moments[i];
  const next = useCallback(() => { if (!data) return; if (i + 1 < data.moments.length) setI(i + 1); else router.back(); }, [data, i]);
  const prev = () => { if (i > 0) setI(i - 1); else { progress.setValue(0); start(); } };

  const paused = typing || !!viewers;
  function start() {
    anim.current?.stop();
    anim.current = Animated.timing(progress, { toValue: 1, duration: SHOW_MS * (1 - progress.__getValue()), easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => { if (finished) next(); });
  }
  useEffect(() => {
    if (!moment) return undefined;
    progress.setValue(0); setSentNote(null);
    if (!data.mine && !moment.seen) api(`/moments/${moment.id}/view`, { method: 'POST' }).catch(() => {});
    return () => anim.current?.stop();
  }, [moment?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!moment) return; if (paused) anim.current?.stop(); else start(); }, [moment?.id, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (text) => {
    const t = (text ?? reply).trim(); if (!t) return;
    setReply(''); setTyping(false);
    try { await api(`/moments/${moment.id}/reply`, { method: 'POST', body: { text: t } }); setSentNote(`Sent ${t.length <= 4 ? t : 'reply'} ✓`); }
    catch (e) { notice('Not sent', e.message); }
  };
  const openViewers = async () => { setViewers([]); try { setViewers((await api(`/moments/${moment.id}/viewers`)).viewers); } catch { setViewers([]); } };
  const del = async () => {
    anim.current?.stop();
    if (await confirm('Delete this Moment?', undefined, { confirmText: 'Delete', destructive: true })) {
      await api(`/moments/${moment.id}`, { method: 'DELETE' }).catch(() => {});
      const rest = data.moments.filter((m) => m.id !== moment.id);
      if (!rest.length) { router.back(); return; }
      setData({ ...data, moments: rest }); setI(Math.min(i, rest.length - 1));
    } else start();
  };

  if (!data || !moment) return <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.aura} /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* the Moment */}
      {moment.mediaUrl ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Image source={{ uri: mediaUrl(moment.mediaUrl) }} style={{ flex: 1 }} resizeMode="contain" />
          {moment.text ? (
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: 130, alignItems: 'center' }}>
              <Text style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', fontFamily: fonts.semibold, fontSize: 16, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, overflow: 'hidden', textAlign: 'center', ...WRAP }}>{moment.text}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: space.xl }}>
          <LinearGradient colors={bgOf(moment.bg)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ color: '#fff', fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 36, textAlign: 'center', ...WRAP }}>{moment.text}</Text>
        </View>
      )}
      {/* tap zones: left = back, right = next */}
      <View style={{ position: 'absolute', top: 90, bottom: 120, left: 0, right: 0, flexDirection: 'row' }}>
        <Pressable style={{ flex: 1 }} onPress={prev} accessibilityLabel="Previous Moment" />
        <Pressable style={{ flex: 2 }} onPress={next} accessibilityLabel="Next Moment" />
      </View>

      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }} pointerEvents="box-none">
        <View style={{ paddingHorizontal: space.md, paddingTop: 6 }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {data.moments.map((m, k) => (
              <View key={m.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                <Animated.View style={{ height: 3, backgroundColor: '#fff', width: k < i ? '100%' : k > i ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Pressable onPress={() => { if (!data.mine) router.replace(`/user/${data.user.username}`); }} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Avatar uri={data.user.avatarUrl} name={data.user.username} size={34} />
              <Text style={{ marginLeft: 8, color: '#fff', fontFamily: fonts.semibold, fontSize: 14 }}>{data.mine ? 'Moments' : data.user.displayName || data.user.username}</Text>
              <Text style={{ marginLeft: 8, color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, fontSize: 13 }}>{ago(moment.createdAt)}</Text>
            </Pressable>
            {data.mine ? <Pressable onPress={del} hitSlop={10} style={{ marginRight: 14 }} accessibilityLabel="Delete Moment"><Ionicons name="trash-outline" size={22} color="#fff" /></Pressable> : null}
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close"><Ionicons name="close" size={28} color="#fff" /></Pressable>
          </View>
        </View>

        <View style={{ padding: space.md }} pointerEvents="box-none">
          {sentNote ? <Text style={{ alignSelf: 'center', color: '#fff', fontFamily: fonts.semibold, marginBottom: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' }}>{sentNote}</Text> : null}
          {data.mine ? (
            <Pressable onPress={openViewers} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18 }}>
              <Ionicons name="eye" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: fonts.semibold, marginLeft: 6 }}>{moment.viewCount || 0} {moment.viewCount === 1 ? 'view' : 'views'}</Text>
            </Pressable>
          ) : (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 }}>
                {EMOJIS.map((e) => <Pressable key={e} onPress={() => send(e)} hitSlop={6} accessibilityLabel={`React ${e}`}><Text style={{ fontSize: 30 }}>{e}</Text></Pressable>)}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput value={reply} onChangeText={setReply} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} placeholder={`Reply to ${data.user.username}…`} placeholderTextColor="rgba(255,255,255,0.7)" maxLength={1000}
                  onSubmitEditing={() => send()} returnKeyType="send"
                  style={{ flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 18, color: '#fff', fontFamily: fonts.body, fontSize: 15, outlineStyle: 'none' }} />
                <Pressable onPress={() => send()} disabled={!reply.trim()} hitSlop={8} style={{ marginLeft: 10, opacity: reply.trim() ? 1 : 0.5 }} accessibilityLabel="Send reply">
                  <Ionicons name="send" size={24} color="#fff" />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>

      <BottomSheet visible={!!viewers} onClose={() => setViewers(null)} title={`Viewed by ${viewers?.length || 0}`}>
        <FlatList data={viewers || []} keyExtractor={(u) => u.id} style={{ maxHeight: 420 }}
          ListEmptyComponent={<Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', padding: space.lg }}>No views yet.</Text>}
          renderItem={({ item }) => <UserRow user={item} nameFirst onPress={() => { setViewers(null); router.replace(`/user/${item.username}`); }} subtitle={`viewed ${ago(item.viewedAt)} ago`} />} />
      </BottomSheet>
    </View>
  );
}
