// One post with all its comments and a comment box.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import PostCard, { timeAgo } from '../../components/PostCard';
import { Avatar, Empty, Loading, s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

// long words / links wrap instead of running off the screen (web needs this explicitly)
const WRAP = Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'anywhere' } : {};

export default function PostScreen() {
  const { id } = useLocalSearchParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [inputH, setInputH] = useState(44); // comment box grows with the text
  const [error, setError] = useState(null);
  const [off, setOff] = useState(false); // commenting turned off by the owner

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api(`/posts/${id}`), api(`/posts/${id}/comments`)]);
      setPost(p.post); setComments(c.comments); setOff(!!c.commentsOff);
    } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const body = text.trim(); if (!body) return;
    setText(''); setInputH(44);
    try { const r = await api(`/posts/${id}/comments`, { method: 'POST', body: { body } }); setComments((c) => [...c, r.comment]); setPost((p) => ({ ...p, commented: true })); } catch (e) { setText(body); setError(e.message); }
  };
  const remove = async (cid) => { await api(`/posts/${id}/comments/${cid}`, { method: 'DELETE' }); setComments((c) => c.filter((x) => x.id !== cid)); };

  if (error && !post) return <View style={s.screen}><Empty icon="alert-circle-outline" title={error} /></View>;
  if (!post) return <Loading />;
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={<View style={{ paddingTop: space.md }}><PostCard post={{ ...post, commentCount: off ? null : comments.length }} showAllComments onDeleted={() => router.back()} onChanged={() => load()} /></View>}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space.lg, paddingVertical: space.sm }}>
            <Pressable onPress={() => router.push(`/user/${item.author.username}`)}><Avatar uri={item.author.avatarUrl} name={item.author.displayName || item.author.username} size={32} /></Pressable>
            <View style={{ flex: 1, minWidth: 0, marginLeft: space.sm, marginRight: space.sm }}>
              <Text style={{ fontFamily: fonts.body, color: colors.text, lineHeight: 20, flexShrink: 1, ...WRAP }}><Text style={{ fontFamily: fonts.semibold }}>{item.author.username} </Text>{item.body}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>{timeAgo(item.createdAt)}</Text>
            </View>
            {item.canDelete ? <Pressable onPress={() => remove(item.id)} hitSlop={8}><Ionicons name="trash-outline" size={16} color={colors.dim} /></Pressable> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', marginTop: space.md }}>{off ? 'Commenting is turned off for this post.' : 'No comments yet. Be the first.'}</Text>}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      {off ? null : (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(8,7,13,0.92)' }}>
        {/* grows onto more lines as you type (up to ~5), so long comments stay inside the screen */}
        <TextInput value={text} onChangeText={setText} placeholder="Add a comment…" placeholderTextColor={colors.dim} maxLength={2200} multiline
          onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height + (Platform.OS === 'web' ? 0 : 24))}
          onKeyPress={Platform.OS === 'web' ? (e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); send(); } } : undefined}
          style={{ flex: 1, minWidth: 0, height: Math.min(120, Math.max(44, inputH)), borderRadius: 22, paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, outlineStyle: 'none', ...WRAP }} />
        <Pressable onPress={send} disabled={!text.trim()} hitSlop={8} style={{ marginLeft: space.sm, marginBottom: 11, opacity: text.trim() ? 1 : 0.4 }}>
          <Ionicons name="send" size={22} color={colors.aura} />
        </Pressable>
      </View>
      )}
    </KeyboardAvoidingView>
  );
}
