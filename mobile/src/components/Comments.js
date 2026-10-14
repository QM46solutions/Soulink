// Comments on a post (used by the post page and the comments sheet):
//   👌🏻 like a comment · Reply (one level, shown under the comment) · ❗ mark it as offensive · delete yours
//   useComments(postId) – loads and changes the list
//   CommentList          – the rows (replies indented under their comment)
//   CommentBox           – the text box, with "Replying to @name ✕" when replying
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { BottomSheet } from './PostSheets';
import { OFFENSE_REASONS } from './OffenseSheet';
import { Avatar } from './ui';
import { colors, fonts, space } from '../lib/theme';

const WRAP = Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'anywhere' } : {};
const LIKE = '👌🏻';
export function ago(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d`;
  return `${Math.round(d / 7)}w`;
}

export function useComments(postId, { onCount, base } = {}) {
  const root = base || `/posts/${postId}`; // Sparks use /sparks/:id
  const [comments, setComments] = useState(null);
  const [off, setOff] = useState(false);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try { const r = await api(`${root}/comments`); setOff(!!r.commentsOff); setComments(r.comments); setError(null); }
    catch (e) { setError(e.message); setComments([]); }
  }, [root]);
  const patch = (id, ch) => setComments((list) => list.map((c) => (c.id === id ? { ...c, ...ch } : c)));
  const add = async (body, parentId) => {
    const r = await api(`${root}/comments`, { method: 'POST', body: { body, ...(parentId ? { parentId } : {}) } });
    setComments((c) => { const n = [...(c || []), r.comment]; onCount?.(n.length, true); return n; });
    return r.comment;
  };
  const remove = async (cid) => {
    await api(`${root}/comments/${cid}`, { method: 'DELETE' });
    // its replies go too
    setComments((c) => { const n = c.filter((x) => x.id !== cid && x.parentId !== cid); onCount?.(n.length, false); return n; });
  };
  const like = async (c) => {
    patch(c.id, { liked: !c.liked, likeCount: c.likeCount + (c.liked ? -1 : 1) }); // feels instant; corrected below
    try { const r = await api(`${root}/comments/${c.id}/like`, { method: 'POST' }); patch(c.id, { liked: r.liked, likeCount: r.likeCount }); }
    catch (e) { patch(c.id, { liked: c.liked, likeCount: c.likeCount }); setError(e.message); }
  };
  const offense = async (c, reason) => {
    try {
      const r = await api(`${root}/comments/${c.id}/offense`, { method: 'POST', body: reason ? { reason } : {} });
      patch(c.id, { offended: r.offended, offenseCount: r.offenseCount, offenseReason: r.offended ? reason || null : null });
    } catch (e) { setError(e.message); }
  };
  return { comments, off, error, setError, load, add, remove, like, offense };
}

function ReasonSheet({ comment, onClose, onPick }) {
  return (
    <BottomSheet visible={!!comment} onClose={onClose} title={comment?.offended ? 'You marked this comment' : 'Why is this comment offensive?'}>
      <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingVertical: space.sm }}>
        {comment?.offended ? (
          <Pressable onPress={() => { onPick(null); onClose(); }} style={{ paddingHorizontal: space.lg, paddingVertical: 14 }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 15 }}>Take back my mark</Text>
          </Pressable>
        ) : OFFENSE_REASONS.map((r) => (
          <Pressable key={r.key} onPress={() => { onPick(r.key); onClose(); }}
            style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 13, backgroundColor: hovered ? 'rgba(255,255,255,0.04)' : 'transparent' })}>
            <Text style={{ flex: 1, fontFamily: fonts.medium, color: colors.text, fontSize: 15 }}>{r.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.dim} />
          </Pressable>
        ))}
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          They aren't told who marked it. A comment marked by more than 10 people is hidden.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

function Row({ c, reply, onReply, onLike, onOffense, onDelete, onUser }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: reply ? space.lg + 42 : space.lg, paddingRight: space.lg, paddingVertical: 7 }}>
      <Pressable onPress={() => onUser(c.author)}><Avatar uri={c.author.avatarUrl} name={c.author.displayName || c.author.username} size={reply ? 26 : 32} /></Pressable>
      <View style={{ flex: 1, minWidth: 0, marginHorizontal: space.sm }}>
        <Text style={{ fontFamily: fonts.body, color: colors.text, lineHeight: 20, ...WRAP }}>
          <Text onPress={() => onUser(c.author)} style={{ fontFamily: fonts.semibold }}>{c.author.username}  </Text>{c.body}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted }}>{ago(c.createdAt)}</Text>
          {c.likeCount ? <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted, marginLeft: 12 }}>{c.likeCount} {LIKE}</Text> : null}
          <Pressable onPress={() => onReply(c)} hitSlop={6} style={{ marginLeft: 12 }} accessibilityLabel={`Reply to ${c.author.username}`}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.aura }}>Reply</Text>
          </Pressable>
          {c.hidden ? <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.spark, marginLeft: 12 }}>Hidden from others</Text> : null}
          {c.canDelete ? (
            <Pressable onPress={() => onDelete(c)} hitSlop={6} style={{ marginLeft: 12 }} accessibilityLabel="Delete comment">
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.dim }}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        {!c.mine ? (
          <Pressable onPress={() => onOffense(c)} hitSlop={8} style={{ marginRight: 12 }} accessibilityLabel={c.offended ? 'Remove offense mark' : 'Mark comment as offensive'}>
            <Ionicons name={c.offended ? 'alert-circle' : 'alert-circle-outline'} size={17} color={c.offended ? colors.danger : colors.dim} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => onLike(c)} hitSlop={8} accessibilityLabel={c.liked ? 'Remove like' : 'Like comment'}
          style={{ alignItems: 'center', ...(Platform.OS === 'web' && !c.liked ? { filter: 'grayscale(1) brightness(1.5)' } : {}) }}>
          <Text style={{ fontSize: 17, opacity: c.liked ? 1 : 0.6 }}>{LIKE}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** All comments, replies under their comment. Pass the handlers from useComments. */
export function CommentList({ comments, onReply, like, offense, remove, closeFirst }) {
  const [reasonFor, setReasonFor] = useState(null);
  const top = (comments || []).filter((c) => !c.parentId);
  const repliesOf = (id) => comments.filter((c) => c.parentId === id);
  const onUser = (u) => { closeFirst?.(); router.push(`/user/${u.username}`); };
  return (
    <View>
      {top.map((c) => (
        <View key={c.id}>
          <Row c={c} onReply={onReply} onLike={like} onOffense={setReasonFor} onDelete={(x) => remove(x.id)} onUser={onUser} />
          {repliesOf(c.id).map((r) => <Row key={r.id} c={r} reply onReply={() => onReply(c, r)} onLike={like} onOffense={setReasonFor} onDelete={(x) => remove(x.id)} onUser={onUser} />)}
        </View>
      ))}
      <ReasonSheet comment={reasonFor} onClose={() => setReasonFor(null)} onPick={(reason) => offense(reasonFor, reason)} />
    </View>
  );
}

/** The comment box. replyTo = { comment, to } (to = the reply you're answering, for the @name). */
export function CommentBox({ onSend, replyTo, onCancelReply, sending }) {
  const [text, setText] = useState('');
  const [h, setH] = useState(44);
  const input = useRef(null);
  const who = replyTo ? (replyTo.to || replyTo.comment).author.username : null;
  useEffect(() => {
    if (!replyTo) return;
    setText((t) => (t.trim() ? t : `@${who} `));
    setTimeout(() => input.current?.focus(), 50);
  }, [replyTo, who]);
  const send = async () => {
    const body = text.trim(); if (!body || sending) return;
    setText(''); setH(44);
    const ok = await onSend(body, replyTo?.comment?.id);
    if (!ok) setText(body);
  };
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(8,7,13,0.92)' }}>
      {replyTo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: 8 }}>
          <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.muted }}>Replying to <Text style={{ fontFamily: fonts.semibold, color: colors.text }}>@{who}</Text></Text>
          <Pressable onPress={() => { onCancelReply(); setText(''); }} hitSlop={8} accessibilityLabel="Cancel reply"><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: space.md }}>
        <TextInput ref={input} value={text} onChangeText={setText} placeholder={replyTo ? `Reply to @${who}…` : 'Add a comment…'} placeholderTextColor={colors.dim} maxLength={2200} multiline
          onContentSizeChange={(e) => setH(e.nativeEvent.contentSize.height + (Platform.OS === 'web' ? 0 : 24))}
          onKeyPress={Platform.OS === 'web' ? (e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); send(); } } : undefined}
          style={{ flex: 1, minWidth: 0, height: Math.min(120, Math.max(44, h)), borderRadius: 22, paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 12, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.inputBg, color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, outlineStyle: 'none', ...WRAP }} />
        <Pressable onPress={send} disabled={!text.trim() || sending} hitSlop={8} style={{ marginLeft: space.sm, marginBottom: 11, opacity: text.trim() ? 1 : 0.4 }} accessibilityLabel="Post comment">
          {sending ? <ActivityIndicator color={colors.aura} size="small" /> : <Ionicons name="send" size={22} color={colors.aura} />}
        </Pressable>
      </View>
    </View>
  );
}
