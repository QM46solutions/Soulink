// A post in the feed or on the post screen: author, photos (arrows + dots, no swiping), like, comment, caption.
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '../lib/api';
import { confirm } from '../lib/confirm';
import { Avatar, VerifiedBadge } from './ui';
import { colors, fonts, space } from '../lib/theme';

export function timeAgo(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Photos({ media, onDoubleTap }) {
  const [i, setI] = useState(0);
  const last = useRef(0);
  if (!media?.length) return null;
  const tap = () => { const now = Date.now(); if (now - last.current < 300) onDoubleTap?.(); last.current = now; };
  const arrow = (side, to) => (
    <Pressable onPress={() => setI(to)} hitSlop={8} accessibilityLabel={side === 'left' ? 'Previous photo' : 'Next photo'}
      style={{ position: 'absolute', top: '50%', [side]: 10, marginTop: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(8,7,13,0.6)', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={side === 'left' ? 'chevron-back' : 'chevron-forward'} size={18} color="#fff" />
    </Pressable>
  );
  return (
    <View>
      <Pressable onPress={tap}>
        <Image source={{ uri: mediaUrl(media[i]) }} style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.card }} contentFit="cover" transition={150} />
      </Pressable>
      {media.length > 1 ? (
        <>
          {i > 0 ? arrow('left', i - 1) : null}
          {i < media.length - 1 ? arrow('right', i + 1) : null}
          <View style={{ position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(8,7,13,0.6)' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: '#fff' }}>{i + 1}/{media.length}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
            {media.map((_, k) => <View key={k} style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 3, marginHorizontal: 2, backgroundColor: k === i ? colors.aura : colors.border }} />)}
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function PostCard({ post, onDeleted, showAllComments }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likeCount);
  const openPost = () => { if (!showAllComments) router.push(`/post/${post.id}`); };
  const like = async (forceOn) => {
    if (forceOn && liked) return;
    setLiked(!liked); setLikes((n) => n + (liked ? -1 : 1));
    try { const r = await api(`/posts/${post.id}/like`, { method: 'POST' }); setLiked(r.liked); setLikes(r.likeCount); } catch { setLiked(liked); setLikes(post.likeCount); }
  };
  const del = async () => {
    if (await confirm('Delete this post?', 'It will be removed from your profile and everyone\'s feed.', { confirmText: 'Delete', destructive: true })) {
      await api(`/posts/${post.id}`, { method: 'DELETE' });
      onDeleted?.(post.id);
    }
  };
  const textOnly = !post.media?.length;

  return (
    <View style={{ marginBottom: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginBottom: space.sm }}>
        <Pressable onPress={() => router.push(`/user/${post.author.username}`)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Avatar uri={post.author.avatarUrl} name={post.author.displayName || post.author.username} size={36} />
          <View style={{ marginLeft: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.text }}>{post.author.username}</Text>
              {post.author.verified ? <VerifiedBadge /> : null}
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted }}>{timeAgo(post.createdAt)}{post.author.soulType ? ` · ${post.author.soulType}` : ''}</Text>
          </View>
        </Pressable>
        {post.mine ? (
          <Pressable onPress={del} hitSlop={10} accessibilityLabel="Delete post"><Ionicons name="trash-outline" size={19} color={colors.muted} /></Pressable>
        ) : null}
      </View>

      {textOnly ? (
        <Pressable onPress={openPost} style={{ marginHorizontal: space.lg, padding: space.xl, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(176,143,255,0.35)', backgroundColor: 'rgba(124,92,252,0.1)' }}>
          <Text style={{ fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 27, color: colors.text }}>{post.caption}</Text>
        </Pressable>
      ) : <Photos media={post.media} onDoubleTap={() => like(true)} />}

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginTop: space.sm }}>
        <Pressable onPress={() => like(false)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginRight: space.lg }} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? colors.spark : colors.text} />
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, marginLeft: 5 }}>{likes || ''}</Text>
        </Pressable>
        <Pressable onPress={openPost} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel="Comments">
          <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, marginLeft: 5 }}>{post.commentCount || ''}</Text>
        </Pressable>
      </View>
      {!textOnly && post.caption ? (
        <Text style={{ fontFamily: fonts.body, color: colors.text, paddingHorizontal: space.lg, marginTop: 6, lineHeight: 20 }}>
          <Text style={{ fontFamily: fonts.semibold }}>{post.author.username} </Text>{post.caption}
        </Text>
      ) : null}
      {!showAllComments && post.commentCount ? (
        <Text onPress={openPost} style={{ fontFamily: fonts.body, color: colors.muted, paddingHorizontal: space.lg, marginTop: 4, fontSize: 13 }}>
          View {post.commentCount === 1 ? '1 comment' : `all ${post.commentCount} comments`}
        </Text>
      ) : null}
    </View>
  );
}

/** 3-column photo grid for profiles. Text posts show as a tile with their first words. */
export function PostGrid({ posts }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 2 }}>
      {posts.map((p) => (
        <Pressable key={p.id} onPress={() => router.push(`/post/${p.id}`)} style={{ width: '33.333%', aspectRatio: 1, padding: 2 }}>
          {p.media?.length ? (
            <View style={{ flex: 1 }}>
              <Image source={{ uri: mediaUrl(p.media[0]) }} style={{ flex: 1, borderRadius: 6, backgroundColor: colors.card }} contentFit="cover" />
              {p.media.length > 1 ? <Ionicons name="copy" size={14} color="#fff" style={{ position: 'absolute', top: 6, right: 6 }} /> : null}
            </View>
          ) : (
            <View style={{ flex: 1, borderRadius: 6, padding: 8, backgroundColor: 'rgba(124,92,252,0.14)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.3)', justifyContent: 'center' }}>
              <Text numberOfLines={4} style={{ fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.text }}>{p.caption}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}
