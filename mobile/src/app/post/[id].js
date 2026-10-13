// One post with all its comments (👌🏻 / Reply / ❗ on each) and a comment box.
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import PostCard from '../../components/PostCard';
import { CommentBox, CommentList, useComments } from '../../components/Comments';
import { Empty, Loading, s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

export default function PostScreen() {
  const { id } = useLocalSearchParams();
  const [post, setPost] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const cm = useComments(id);

  const load = useCallback(async () => {
    try { setPost((await api(`/posts/${id}`)).post); await cm.load(); } catch (e) { setLoadError(e.message); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const send = async (body, parentId) => {
    setSending(true);
    try { await cm.add(body, parentId); setReplyTo(null); setPost((p) => ({ ...p, commented: true })); return true; }
    catch (e) { cm.setError(e.message); return false; } finally { setSending(false); }
  };

  if (loadError && !post) return <View style={s.screen}><Empty icon="alert-circle-outline" title={loadError} /></View>;
  if (!post || !cm.comments) return <Loading />;
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: space.md }}>
          <PostCard post={{ ...post, commentCount: cm.off ? null : cm.comments.length }} showAllComments onDeleted={() => router.back()} onChanged={() => load()} />
        </View>
        {cm.comments.length ? (
          <CommentList comments={cm.comments} onReply={(comment, to) => setReplyTo({ comment, to })} like={cm.like} offense={cm.offense} remove={cm.remove} />
        ) : <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', marginTop: space.md }}>{cm.off ? 'Commenting is turned off for this post.' : 'No comments yet. Be the first.'}</Text>}
        {cm.error ? <Text style={{ fontFamily: fonts.body, color: colors.danger, fontSize: 13, paddingHorizontal: space.lg, marginTop: space.sm }}>{cm.error}</Text> : null}
      </ScrollView>
      {cm.off ? null : <CommentBox onSend={send} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} sending={sending} />}
    </KeyboardAvoidingView>
  );
}
