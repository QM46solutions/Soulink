// Moments tab on a profile.
//  Your own profile: every Moment you made (added to your Moments and/or sent to chats). Only you see this list.
//  Someone else's: their Moments that are live right now (24 h), if you're connected to them.
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, mediaUrl } from '../lib/api';
import { bgOf } from '../lib/moments';
import { confirm, notice } from '../lib/confirm';
import { Empty, Loading } from './ui';
import { colors, fonts, space } from '../lib/theme';

const when = (iso) => {
  const d = new Date(iso); const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

function Face({ m, big }) {
  if (m.mediaUrl) return <Image source={{ uri: mediaUrl(m.mediaUrl) }} style={{ flex: 1, backgroundColor: colors.card }} contentFit={big ? 'contain' : 'cover'} />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: big ? space.xl : 8 }}>
      <LinearGradient colors={bgOf(m.bg)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Text numberOfLines={big ? undefined : 7} style={{ color: '#fff', fontFamily: fonts.displayBold, fontSize: big ? 28 : 13, lineHeight: big ? 36 : 17, textAlign: 'center' }}>{m.text}</Text>
    </View>
  );
}

const Tag = ({ icon, text, color = '#fff' }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(8,7,13,0.7)', marginRight: 4, marginTop: 4 }}>
    <Ionicons name={icon} size={10} color={color} />
    <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 10, marginLeft: 3 }}>{text}</Text>
  </View>
);

export default function ProfileMoments({ userId, isMe, name }) {
  const [list, setList] = useState(null);
  const [locked, setLocked] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      if (isMe) setList((await api('/moments/archive')).moments);
      else setList((await api(`/moments/user/${userId}`)).moments);
      setLocked(false);
    } catch (e) { if (e.status === 403) setLocked(true); setList([]); }
  }, [isMe, userId]);
  useEffect(() => { load(); }, [load]);

  const remove = async (m) => {
    if (!(await confirm('Delete this Moment?', m.live ? 'It is removed from your Moments now. Chats it was sent to keep their copy.' : 'Chats it was sent to keep their copy.', { confirmText: 'Delete', destructive: true }))) return;
    try { await api(`/moments/${m.id}`, { method: 'DELETE' }); setOpen(null); setList((l) => l.filter((x) => x.id !== m.id)); } catch (e) { notice('Oops', e.message); }
  };

  if (!list) return <Loading />;
  if (locked) return <Empty icon="lock-closed-outline" title="Moments are for connections" text={`Connect with ${name} to see their Moments.`} />;
  if (!list.length) {
    return isMe ? (
      <Empty icon="sparkles-outline" title="No Moments yet" text="Moments you add or send to chats are kept here. Only you can see this tab.">
        <Text onPress={() => router.push('/moment/new')} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.aura, marginTop: space.md }}>Share a Moment</Text>
      </Empty>
    ) : <Empty icon="sparkles-outline" title="No Moments right now" text="Moments stay for 24 hours." />;
  }

  return (
    <View>
      {isMe ? <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>Only you can see this. Others see your Moments for 24 hours.</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {list.map((m) => (
          <Pressable key={m.id} onPress={() => (isMe ? setOpen(m) : router.push(`/moment/${userId}`))} style={{ width: '33.333%', aspectRatio: 0.54, padding: 1 }}>
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <Face m={m} />
              <View style={{ position: 'absolute', left: 4, bottom: 4, right: 4, flexDirection: 'row', flexWrap: 'wrap' }}>
                {isMe && m.live ? <Tag icon="ellipse" color={colors.mint} text="Live" /> : null}
                {isMe && m.isStory ? <Tag icon="eye" text={String(m.viewCount)} /> : null}
                {isMe && m.sentChats ? <Tag icon="paper-plane" text={String(m.sentChats)} /> : null}
                {!isMe && !m.seen ? <Tag icon="ellipse" color={colors.spark} text="New" /> : null}
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <Modal visible={!!open} animationType="fade" onRequestClose={() => setOpen(null)}>
        {open ? (
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Face m={open} big />
            <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg }}>
                <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 14 }}>{when(open.createdAt)}</Text>
                <Pressable onPress={() => setOpen(null)} hitSlop={12} accessibilityLabel="Close"><Ionicons name="close" size={28} color="#fff" /></Pressable>
              </View>
            </SafeAreaView>
            <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <Text style={{ flex: 1, color: '#fff', fontFamily: fonts.body, fontSize: 13, lineHeight: 18 }}>
                  {[open.isStory ? (open.live ? `In your Moments now · ${open.viewCount} ${open.viewCount === 1 ? 'view' : 'views'}` : `Was in your Moments · ${open.viewCount} ${open.viewCount === 1 ? 'view' : 'views'}`) : null,
                    open.sentChats ? `Sent to ${open.sentChats} ${open.sentChats === 1 ? 'chat' : 'chats'}` : null].filter(Boolean).join('\n')}
                </Text>
                {open.live ? (
                  <Pressable onPress={() => { setOpen(null); router.push(`/moment/${userId}`); }} style={{ marginRight: space.lg }} accessibilityLabel="Open in Moments">
                    <Ionicons name="play-circle" size={30} color="#fff" />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => remove(open)} accessibilityLabel="Delete Moment"><Ionicons name="trash-outline" size={26} color="#fff" /></Pressable>
              </View>
            </SafeAreaView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}
