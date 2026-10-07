// Instagram-style sheets that open on top of a post (no page change):
//   LikesSheet    – who gave it a 👌🏻
//   CommentsSheet – all comments + a box to add yours
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { Overlay } from '../lib/portal';
import { useSafeClose } from '../lib/safeClose';
import { Avatar, VerifiedBadge } from './ui';
import { colors, fonts, space } from '../lib/theme';

const WRAP = Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'anywhere' } : {};
function ago(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d`;
  return `${Math.round(d / 7)}w`;
}

/** Bottom sheet frame: dim background (tap to close), grab handle, title, content up to ~75% of the screen. */
export function BottomSheet({ visible, onClose, title, children, tall }) {
  const backdropClose = useSafeClose(visible, onClose);
  if (!visible) return null;
  return (
    <Overlay onClose={onClose}>
      <Pressable onPress={backdropClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', cursor: 'default' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ height: tall ? '75%' : undefined, maxHeight: '75%', backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <View style={{ alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.dim, marginBottom: space.md }} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.text }}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={{ position: 'absolute', right: space.lg, top: space.lg + 2 }}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
        {children}
      </KeyboardAvoidingView>
    </Overlay>
  );
}

function PersonRow({ u, onPress, right }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10, backgroundColor: hovered ? 'rgba(255,255,255,0.04)' : 'transparent' })}>
      <Avatar uri={u.avatarUrl} size={40} name={u.displayName || u.username} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 14.5 }}>{u.displayName || u.username}</Text>
          {u.verified ? <VerifiedBadge size={13} /> : null}
        </View>
        <Text numberOfLines={1} style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12.5 }}>@{u.username}</Text>
      </View>
      {right}
    </Pressable>
  );
}

export function LikesSheet({ visible, postId, onClose }) {
  const [users, setUsers] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setUsers(null);
    api(`/posts/${postId}/likes`).then((r) => setUsers(r.users)).catch(() => setUsers([]));
  }, [visible, postId]);
  const open = (u) => { onClose(); router.push(`/user/${u.username}`); };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="👌🏻 Likes">
      {!users ? <View style={{ padding: space.xxl }}><ActivityIndicator color={colors.aura} /></View> : (
        <FlatList data={users} keyExtractor={(u) => u.id} contentContainerStyle={{ paddingVertical: space.sm }}
          renderItem={({ item }) => <PersonRow u={item} onPress={() => open(item)} />}
          ListEmptyComponent={<Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', padding: space.xl }}>No 👌🏻 yet. Be the first.</Text>} />
      )}
    </BottomSheet>
  );
}

export function CommentsSheet({ visible, postId, onClose, onCountChange, mine }) {
  const [comments, setComments] = useState(null);
  const [off, setOff] = useState(false); // the owner turned commenting off
  const [text, setText] = useState('');
  const [inputH, setInputH] = useState(44);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setComments(null); setError(null);
    api(`/posts/${postId}/comments`).then((r) => { setOff(!!r.commentsOff); setComments(r.comments); }).catch((e) => { setError(e.message); setComments([]); });
  }, [visible, postId]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setText(''); setInputH(44);
    try {
      const r = await api(`/posts/${postId}/comments`, { method: 'POST', body: { body } });
      setComments((c) => { const n = [...(c || []), r.comment]; onCountChange?.(n.length, true); return n; });
    } catch (e) { setText(body); setError(e.message); } finally { setSending(false); }
  };
  const remove = async (cid) => {
    try {
      await api(`/posts/${postId}/comments/${cid}`, { method: 'DELETE' });
      setComments((c) => { const n = c.filter((x) => x.id !== cid); onCountChange?.(n.length, false); return n; });
    } catch (e) { setError(e.message); }
  };
  const openUser = (u) => { onClose(); router.push(`/user/${u.username}`); };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Comments" tall>
      {!comments ? <View style={{ flex: 1, padding: space.xxl }}><ActivityIndicator color={colors.aura} /></View> : (
        <FlatList style={{ flex: 1 }} data={comments} keyExtractor={(c) => c.id} contentContainerStyle={{ paddingVertical: space.sm, flexGrow: 1 }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space.lg, paddingVertical: space.sm }}>
              <Pressable onPress={() => openUser(item.author)}><Avatar uri={item.author.avatarUrl} name={item.author.displayName || item.author.username} size={34} /></Pressable>
              <View style={{ flex: 1, minWidth: 0, marginHorizontal: space.sm }}>
                <Text style={{ fontFamily: fonts.body, color: colors.text, lineHeight: 20, ...WRAP }}>
                  <Text onPress={() => openUser(item.author)} style={{ fontFamily: fonts.semibold }}>{item.author.username}  </Text>{item.body}
                </Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>{ago(item.createdAt)}</Text>
              </View>
              {item.canDelete ? <Pressable onPress={() => remove(item.id)} hitSlop={8} accessibilityLabel="Delete comment"><Ionicons name="trash" size={15} color={colors.dim} /></Pressable> : null}
            </View>
          )}
          ListEmptyComponent={(
            <View style={{ alignItems: 'center', padding: space.xl }}>
              <Text style={{ fontFamily: fonts.bold, color: colors.text, fontSize: 17 }}>{off ? 'Commenting is turned off' : 'No comments yet'}</Text>
              <Text style={{ fontFamily: fonts.body, color: colors.muted, marginTop: 4, textAlign: 'center' }}>{off ? (mine ? 'Turn it back on from the ⋯ menu to show comments again.' : 'The owner turned off comments on this post.') : 'Start the conversation.'}</Text>
            </View>
          )} />
      )}
      {error ? <Text style={{ fontFamily: fonts.body, color: colors.danger, fontSize: 13, paddingHorizontal: space.lg }}>{error}</Text> : null}
      {off ? null : (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: space.md, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput value={text} onChangeText={setText} placeholder="Add a comment…" placeholderTextColor={colors.dim} maxLength={2200} multiline
          onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height + (Platform.OS === 'web' ? 0 : 24))}
          onKeyPress={Platform.OS === 'web' ? (e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); send(); } } : undefined}
          style={{ flex: 1, minWidth: 0, height: Math.min(120, Math.max(44, inputH)), borderRadius: 22, paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 12, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.inputBg, color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, outlineStyle: 'none', ...WRAP }} />
        <Pressable onPress={send} disabled={!text.trim() || sending} hitSlop={8} style={{ marginLeft: space.sm, marginBottom: 11, opacity: text.trim() ? 1 : 0.4 }} accessibilityLabel="Post comment">
          {sending ? <ActivityIndicator color={colors.aura} size="small" /> : <Ionicons name="send" size={22} color={colors.aura} />}
        </Pressable>
      </View>
      )}
    </BottomSheet>
  );
}
