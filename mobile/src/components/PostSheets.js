// Instagram-style sheets that open on top of a post (no page change):
//   LikesSheet    – who gave it a 👌🏻
//   CommentsSheet – all comments + a box to add yours
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CommentBox, CommentList, useComments } from './Comments';
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

export function CommentsSheet({ visible, postId, base, onClose, onCountChange, mine }) {
  const cm = useComments(postId, { onCount: onCountChange, base });
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  useEffect(() => { if (visible) { setReplyTo(null); cm.load(); } }, [visible, postId]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async (body, parentId) => {
    setSending(true);
    try { await cm.add(body, parentId); setReplyTo(null); return true; } catch (e) { cm.setError(e.message); return false; } finally { setSending(false); }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Comments" tall>
      {!cm.comments ? <View style={{ flex: 1, padding: space.xxl }}><ActivityIndicator color={colors.aura} /></View> : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: space.sm, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {cm.comments.length ? (
            <CommentList comments={cm.comments} onReply={(comment, to) => setReplyTo({ comment, to })} like={cm.like} offense={cm.offense} remove={cm.remove} closeFirst={onClose} />
          ) : (
            <View style={{ alignItems: 'center', padding: space.xl }}>
              <Text style={{ fontFamily: fonts.bold, color: colors.text, fontSize: 17 }}>{cm.off ? 'Commenting is turned off' : 'No comments yet'}</Text>
              <Text style={{ fontFamily: fonts.body, color: colors.muted, marginTop: 4, textAlign: 'center' }}>{cm.off ? (mine ? 'Turn it back on from the ⋯ menu to show comments again.' : 'The owner turned off comments on this post.') : 'Start the conversation.'}</Text>
            </View>
          )}
        </ScrollView>
      )}
      {cm.error ? <Text style={{ fontFamily: fonts.body, color: colors.danger, fontSize: 13, paddingHorizontal: space.lg }}>{cm.error}</Text> : null}
      {cm.off ? null : <CommentBox onSend={send} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} sending={sending} />}
    </BottomSheet>
  );
}
