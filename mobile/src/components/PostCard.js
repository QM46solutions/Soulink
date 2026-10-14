// A post in the feed or on the post screen: author, photos (arrows + dots, no swiping), caption and
// the action row: 👌🏻 like, comment, share (in a chat or outside Soulink) and offense.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '../lib/api';
import { confirm, notice } from '../lib/confirm';
import ActionSheet from './ActionSheet';
import OffenseSheet from './OffenseSheet';
import { CommentsSheet, LikesSheet } from './PostSheets';
import { MusicChip, MusicSheet } from './PostMusic';
import { RevealBadge, RevealCover, useCountdown } from './PostReveal';
import PostVideo from './PostVideo';

export const isVideo = (u) => /\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(String(u || ''));
import { Avatar, VerifiedBadge } from './ui';
import { colors, fonts, space } from '../lib/theme';

export const LIKE_EMOJI = '👌🏻';
// long words / links wrap instead of running off the screen (web needs this explicitly)
const WRAP = Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'anywhere' } : {};
const ND = Platform.OS !== 'web';
// before you use an icon it's an outline; once used it turns into the solid icon in its colour:
// like = the 👌🏻 itself, comment = white, share = sky blue, offense = red
export const ACTIVE = { comment: '#ffffff', share: '#38bdf8', offense: '#ff4d4f' };

/**
 * Outline icon that becomes solid + coloured once you've used it, and plays its own move each time you use it:
 * shake = comment box wobbles, fly = paper plane flies off and comes back, stamp = offense slams down like a stamp.
 */
export function StateIcon({ name, on, color, size = 22, effect, tick = 0 }) {
  // rests at 1 (the end of every move = the normal icon); each use replays 0 → 1
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!tick) return;
    v.setValue(0);
    const dur = effect === 'fly' ? 900 : effect === 'stamp' ? 520 : 560;
    Animated.timing(v, { toValue: 1, duration: dur, easing: effect === 'stamp' ? Easing.out(Easing.quad) : Easing.linear, useNativeDriver: ND }).start();
  }, [tick, effect, v]);
  let transform = [];
  let opacity = 1;
  if (effect === 'shake') {
    transform = [
      { translateX: v.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], outputRange: [0, -5, 5, -4, 4, -2, 0] }) },
      { rotate: v.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 0.6, 1], outputRange: ['0deg', '-10deg', '10deg', '-7deg', '5deg', '0deg'] }) },
    ];
  } else if (effect === 'fly') {
    transform = [
      { translateX: v.interpolate({ inputRange: [0, 0.45, 0.46, 1], outputRange: [0, 30, -16, 0] }) },
      { translateY: v.interpolate({ inputRange: [0, 0.45, 0.46, 1], outputRange: [0, -30, 14, 0] }) },
      { rotate: v.interpolate({ inputRange: [0, 0.45, 0.46, 1], outputRange: ['0deg', '-12deg', '8deg', '0deg'] }) },
    ];
    opacity = v.interpolate({ inputRange: [0, 0.4, 0.46, 0.7, 1], outputRange: [1, 0, 0, 1, 1] });
  } else if (effect === 'stamp') {
    transform = [
      { scale: v.interpolate({ inputRange: [0, 0.55, 0.75, 1], outputRange: [2.4, 0.82, 1.08, 1] }) },
      { rotate: v.interpolate({ inputRange: [0, 0.55, 1], outputRange: ['-20deg', '4deg', '0deg'] }) },
    ];
    opacity = v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.2, 1, 1] });
  }
  return (
    <Animated.View style={{ opacity, transform }}>
      <Ionicons name={on ? name : `${name}-outline`} size={size} color={on ? color : colors.text} />
    </Animated.View>
  );
}

export function timeAgo(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Photos({ media, onDoubleTap, burst }) {
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
        {isVideo(media[i]) ? (
          <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }}><PostVideo key={media[i]} uri={mediaUrl(media[i])} /></View>
        ) : <Image source={{ uri: mediaUrl(media[i]) }} style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.card }} contentFit="cover" transition={150} />}
        {burst ? (
          <Animated.Text pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: '36%', fontSize: 96,
            opacity: burst.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ scale: burst.interpolate({ inputRange: [0, 0.2, 0.35, 1], outputRange: [0.3, 1.25, 1, 1.05] }) }] }}>{LIKE_EMOJI}</Animated.Text>
        ) : null}
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

/** One action: icon with its count underneath (Instagram style). */
export function Action({ onPress, label, children, count, color, disabled, onCountPress, countLabel }) {
  // count === null: hidden by the post's owner (like count) or commenting is off; keep the space so icons stay aligned
  const num = <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: color || colors.text, marginTop: 2, fontVariant: ['tabular-nums'] }}>{count === null ? ' ' : count || 0}</Text>;
  return (
    <View style={{ alignItems: 'center', minWidth: 40, marginRight: space.xl }}>
      <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityLabel={label}
        style={({ hovered, pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.6 : 1, transform: [{ scale: hovered && !disabled ? 1.08 : 1 }] })}>
        <View style={{ height: 26, justifyContent: 'center' }}>{children}</View>
        {onCountPress ? null : num}
      </Pressable>
      {/* the count can open its own list (e.g. who liked) */}
      {onCountPress ? (
        <Pressable onPress={onCountPress} hitSlop={6} accessibilityLabel={countLabel}
          style={({ hovered }) => ({ paddingHorizontal: 4, borderRadius: 6, backgroundColor: hovered ? 'rgba(255,255,255,0.08)' : 'transparent' })}>{num}</Pressable>
      ) : null}
    </View>
  );
}

export default function PostCard({ post, onDeleted, showAllComments, onChanged }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likeCount);
  const [offended, setOffended] = useState(post.offended);
  const [offenses, setOffenses] = useState(post.offenseCount || 0);
  const [myReason, setMyReason] = useState(post.offenseReason || null);
  const [reportOpen, setReportOpen] = useState(false);
  const [shares, setShares] = useState(post.shareCount || 0);
  const [shared, setShared] = useState(!!post.shared);
  const [shareMenu, setShareMenu] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption || '');
  const [saving, setSaving] = useState(false);
  const [hideLikes, setHideLikes] = useState(!!post.hideLikes);
  const [commentsOff, setCommentsOff] = useState(!!post.commentsOff);
  const [music, setMusic] = useState(post.music || null);
  const [musicOpen, setMusicOpen] = useState(false);
  // scheduled reveal: others get the blurred cover until the time, then the real photos load
  const [view, setView] = useState({ media: post.media, reveal: post.reveal || null });
  useEffect(() => { setView({ media: post.media, reveal: post.reveal || null }); }, [post.id, post.media, post.reveal]);
  const refreshReveal = useCallback(() => {
    setTimeout(async () => {
      try { const p = (await api(`/posts/${post.id}`)).post; setView({ media: p.media, reveal: p.reveal || null }); onChanged?.(p); } catch { /* try again on next load */ }
    }, 1500);
  }, [post.id, onChanged]);
  useEffect(() => { setHideLikes(!!post.hideLikes); setCommentsOff(!!post.commentsOff); setMusic(post.music || null); }, [post.id, post.hideLikes, post.commentsOff, post.music]);
  const applyPost = (p) => { setHideLikes(!!p.hideLikes); setCommentsOff(!!p.commentsOff); setMusic(p.music || null); setLikes(p.likeCount); setComments(p.commentCount ?? 0); onChanged?.(p); };
  const setOption = async (body) => {
    try { applyPost((await api(`/posts/${post.id}`, { method: 'PATCH', body })).post); } catch (e) { notice('Not saved', e.message); }
  };
  // when fresh data arrives (feed reloads, someone else liked it), show the new numbers
  useEffect(() => { setLiked(post.liked); setLikes(post.likeCount); }, [post.id, post.liked, post.likeCount]);
  useEffect(() => { setOffended(post.offended); setOffenses(post.offenseCount || 0); setMyReason(post.offenseReason || null); }, [post.id, post.offended, post.offenseCount, post.offenseReason]);
  useEffect(() => { setShares(post.shareCount || 0); setShared(!!post.shared); }, [post.id, post.shareCount, post.shared]);
  useEffect(() => { setCaption(post.caption); }, [post.id, post.caption]);
  const pop = useRef(new Animated.Value(1)).current;
  const wave = useRef(new Animated.Value(0)).current; // 👌🏻 waves when you give it
  const [ticks, setTicks] = useState({ comment: 0, share: 0, offense: 0 });
  const bump = (k) => setTicks((t) => ({ ...t, [k]: t[k] + 1 }));
  const burst = useRef(new Animated.Value(0)).current;
  // likes and comments open on top of the post, like Instagram (no page change)
  const [likesOpen, setLikesOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(post.commentCount || 0);
  const [commented, setCommented] = useState(!!post.commented);
  useEffect(() => { setComments(post.commentCount || 0); setCommented(!!post.commented); }, [post.id, post.commentCount, post.commented]);
  const openPost = () => setCommentsOpen(true);
  const like = async (forceOn) => {
    if (forceOn) { // double tap: big 👌🏻 over the photo
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start();
      if (liked) return;
    }
    if (!liked) {
      wave.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pop, { toValue: 1.3, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
          Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: ND }),
        ]),
        Animated.timing(wave, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: ND }),
      ]).start();
    }
    setLiked(!liked); setLikes((n) => (n === null ? null : n + (liked ? -1 : 1)));
    try { const r = await api(`/posts/${post.id}/like`, { method: 'POST' }); setLiked(r.liked); setLikes(r.likeCount); } catch { setLiked(liked); setLikes(post.likeCount); }
  };
  // ❗ opens the Instagram-style report sheet (in the app, no browser pop-ups)
  const offense = () => setReportOpen(true);
  const toggleOffense = async (reason) => {
    const r = await api(`/posts/${post.id}/offense`, { method: 'POST', body: reason ? { reason } : {} });
    setOffended(r.offended); setOffenses(r.offenseCount); setMyReason(r.offended ? reason : null);
    if (r.offended) bump('offense');
    if (r.suspended) setTimeout(() => onDeleted?.(post.id), 1800); // enough marks: it disappears for everyone else
  };
  const shareOutside = async () => {
    const message = `${post.author.username} on Soulink${post.caption ? `: "${post.caption.slice(0, 120)}"` : ''}`;
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) await navigator.share({ title: 'Soulink', text: message });
        else { await navigator.clipboard.writeText(message); notice('Copied', 'Paste it anywhere to share.'); }
      } else await Share.share({ message });
      const r = await api(`/posts/${post.id}/share`, { method: 'POST', body: {} });
      setShares(r.shareCount); setShared(true); bump('share');
    } catch { /* cancelled */ }
  };
  const del = async () => {
    if (await confirm('Delete this post?', 'It will be removed from your profile and everyone\'s feed.', { confirmText: 'Delete', destructive: true })) {
      await api(`/posts/${post.id}`, { method: 'DELETE' });
      onDeleted?.(post.id);
    }
  };
  const saveCaption = async () => {
    setSaving(true);
    try { const r = await api(`/posts/${post.id}`, { method: 'PATCH', body: { caption: draft } }); setCaption(r.post.caption); setEditing(false); }
    catch (e) { notice('Not saved', e.message); } finally { setSaving(false); }
  };
  const copyText = async () => {
    try { if (Platform.OS === 'web') await navigator.clipboard.writeText(caption || ''); else await Share.share({ message: caption || '' }); } catch { /* cancelled */ }
  };
  // Instagram-style ⋯ menu: your own post vs someone else's
  const options = post.mine
    ? [
      { label: 'Edit', onPress: () => { setDraft(caption || ''); setEditing(true); } },
      { label: hideLikes ? 'Show like count' : 'Hide like count', onPress: () => setOption({ hideLikes: !hideLikes }) },
      { label: commentsOff ? 'Turn on commenting' : 'Turn off commenting', onPress: () => setOption({ commentsOff: !commentsOff }) },
      { label: music ? 'Change music' : 'Add music', onPress: () => setMusicOpen(true) },
      { label: 'Delete', destructive: true, onPress: del },
    ]
    : [
      { label: offended ? 'Remove offense mark' : 'Mark as offensive', destructive: !offended, onPress: offense },
      { label: 'Share', onPress: () => setShareMenu(true) },
      ...(caption ? [{ label: 'Copy text', onPress: copyText }] : []),
      { label: 'About this account', onPress: () => router.push(`/user/${post.author.username}`) },
    ];
  const textOnly = !view.media?.length && !view.reveal;

  return (
    <View style={{ marginBottom: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginBottom: space.sm }}>
        <Pressable onPress={() => router.push(`/user/${post.author.username}`)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Avatar uri={post.author.avatarUrl} name={post.author.displayName || post.author.username} size={36} />
          <View style={{ marginLeft: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.text }}>{post.author.displayName || post.author.username}</Text>
              {post.author.verified ? <VerifiedBadge /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
              <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted }}>{timeAgo(post.createdAt)}</Text>
              {post.place ? (<>
                <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted }}>  ·  </Text>
                <Ionicons name="location" size={11} color={colors.aura} style={{ marginRight: 2 }} />
                <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.text, flexShrink: 1 }}>{post.place}</Text>
              </>) : null}
            </View>
            {music ? <MusicChip key={music.url} music={music} /> : null}
          </View>
        </Pressable>
        <Pressable onPress={() => setOptionsOpen(true)} hitSlop={10} accessibilityLabel="Post options"
          style={({ hovered }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? 'rgba(255,255,255,0.08)' : 'transparent' })}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Pressable>
      </View>

      {post.suspended && post.mine ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: space.lg, marginBottom: space.sm, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,107,157,0.5)', backgroundColor: 'rgba(255,107,157,0.1)' }}>
          <Ionicons name="eye-off-outline" size={17} color={colors.spark} style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={{ flex: 1, fontFamily: fonts.body, color: colors.text, fontSize: 13, lineHeight: 18 }}>
            <Text style={{ fontFamily: fonts.semibold }}>Suspended. </Text>More than 75 people found this post offensive, so it's hidden from everyone. Only you can see it.
          </Text>
        </View>
      ) : null}
      {textOnly ? (
        <Pressable onPress={openPost} style={{ marginHorizontal: space.lg, padding: space.xl, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(176,143,255,0.35)', backgroundColor: 'rgba(124,92,252,0.1)' }}>
          <Text style={{ fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 27, color: colors.text, ...WRAP }}>{caption}</Text>
        </Pressable>
      ) : view.reveal?.locked ? <RevealCover reveal={view.reveal} onRevealed={refreshReveal} /> : (
        <View>
          <Photos media={view.media} onDoubleTap={() => like(true)} burst={burst} />
          {view.reveal ? <RevealBadge reveal={view.reveal} onRevealed={refreshReveal} /> : null}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space.lg, marginTop: space.sm }}>
        <Action onPress={() => like(false)} label={liked ? 'Remove 👌🏻' : 'Like with 👌🏻'} count={likes} color={liked ? '#f2c38b' : undefined}
          onCountPress={() => setLikesOpen(true)} countLabel="See who gave this a 👌🏻">
          <Animated.Text style={{ fontSize: 22, opacity: liked ? 1 : Platform.OS === 'web' ? 0.85 : 0.55, transformOrigin: 'bottom center', transform: [{ scale: pop }, { rotate: wave.interpolate({ inputRange: [0, 0.15, 0.32, 0.5, 0.68, 0.85, 1], outputRange: ['0deg', '-28deg', '22deg', '-20deg', '14deg', '-6deg', '0deg'] }) }], ...(Platform.OS === 'web' && !liked ? { filter: 'grayscale(1) brightness(1.6)' } : null) }}>{LIKE_EMOJI}</Animated.Text>
        </Action>
        {/* each icon takes its own colour once you've used it, like the 👌🏻 */}
        <Action onPress={openPost} label={commentsOff ? 'Commenting is off' : 'Comments'} count={commentsOff ? null : comments} color={commented ? ACTIVE.comment : undefined}>
          <StateIcon name="chatbubble" on={commented} color={ACTIVE.comment} effect="shake" tick={ticks.comment} />
        </Action>
        <Action onPress={() => setShareMenu(true)} label="Share" count={shares} color={shared ? ACTIVE.share : undefined}>
          <StateIcon name="paper-plane" on={shared} color={ACTIVE.share} effect="fly" tick={ticks.share} />
        </Action>
        {/* Offense ❗: others tap it to report (Instagram-style sheet); on your own post it shows how many marked it and why */}
        <Action onPress={offense} count={offenses} color={offended ? ACTIVE.offense : undefined}
          label={post.mine ? `${offenses} offense marks on your post` : offended ? 'Remove offense mark' : 'Mark as offensive'}>
          <StateIcon name="alert-circle" on={offended} color={ACTIVE.offense} size={24} effect="stamp" tick={ticks.offense} />
        </Action>
      </View>
      <LikesSheet visible={likesOpen} postId={post.id} onClose={() => setLikesOpen(false)} />
      <CommentsSheet visible={commentsOpen} postId={post.id} onClose={() => setCommentsOpen(false)} mine={post.mine}
        onCountChange={(n, mine) => { setComments(n); if (mine) { setCommented(true); bump('comment'); } }} />
      <OffenseSheet visible={reportOpen} offended={offended} reason={myReason} owner={post.mine} postId={post.id} onClose={() => setReportOpen(false)}
        onMark={(reason) => toggleOffense(reason)} onUnmark={() => toggleOffense(null)} />
      {post.mine ? <MusicSheet visible={musicOpen} onClose={() => setMusicOpen(false)} post={{ id: post.id, music }} onChanged={applyPost} /> : null}
      <ActionSheet visible={optionsOpen} onClose={() => setOptionsOpen(false)} title={post.mine ? 'Your post' : post.author.username} options={options} />
      <ActionSheet
        visible={shareMenu}
        onClose={() => setShareMenu(false)}
        title="Share this post"
        options={[
          { label: 'Send in a chat', onPress: () => { bump('share'); router.push({ pathname: '/share-post', params: { id: post.id } }); } },
          { label: 'Share outside Soulink', onPress: shareOutside },
        ]}
      />
      {likes === null && post.likedBy && !editing ? (
        <Text onPress={() => setLikesOpen(true)} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.text, paddingHorizontal: space.lg, marginTop: 6 }}>
          {LIKE_EMOJI} Liked by <Text style={{ fontFamily: fonts.semibold }}>{post.likedBy}</Text> and <Text style={{ fontFamily: fonts.semibold }}>others</Text>
        </Text>
      ) : null}
      {likes > 0 && !editing ? (
        <Text onPress={() => setLikesOpen(true)} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.text, paddingHorizontal: space.lg, marginTop: 6 }}>
          {LIKE_EMOJI} {liked && (likes === 1 || !post.likedBy)
            ? (likes === 1 ? <Text style={{ fontFamily: fonts.semibold }}>You</Text> : <>Liked by <Text style={{ fontFamily: fonts.semibold }}>you</Text> and <Text style={{ fontFamily: fonts.semibold }}>{likes - 1} {likes - 1 === 1 ? 'other' : 'others'}</Text></>)
            : <>Liked by <Text style={{ fontFamily: fonts.semibold }}>{post.likedBy || 'someone'}</Text>{likes > 1 ? <> and <Text style={{ fontFamily: fonts.semibold }}>{likes - 1} {likes - 1 === 1 ? 'other' : 'others'}</Text></> : null}</>}
        </Text>
      ) : null}
      {editing ? (
        <View style={{ paddingHorizontal: space.lg, marginTop: 8 }}>
          <TextInput value={draft} onChangeText={setDraft} multiline autoFocus maxLength={2200} placeholder="Write a caption…" placeholderTextColor={colors.dim}
            style={{ minHeight: 44, maxHeight: 140, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.aura, backgroundColor: colors.inputBg, color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, outlineStyle: 'none', ...WRAP }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
            <Pressable onPress={() => setEditing(false)} style={{ paddingHorizontal: 14, height: 32, justifyContent: 'center' }}><Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>Cancel</Text></Pressable>
            <Pressable onPress={saveCaption} disabled={saving} style={{ paddingHorizontal: 16, height: 32, borderRadius: 10, justifyContent: 'center', backgroundColor: colors.soul }}>
              <Text style={{ fontFamily: fonts.semibold, color: '#fff' }}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      ) : !textOnly && caption ? (
        <Text style={{ fontFamily: fonts.body, color: colors.text, paddingHorizontal: space.lg, marginTop: 6, lineHeight: 20, ...WRAP }}>
          <Text style={{ fontFamily: fonts.semibold }}>{post.author.displayName || post.author.username} </Text>{caption}
        </Text>
      ) : null}
      {!showAllComments && comments ? (
        <Text onPress={openPost} style={{ fontFamily: fonts.body, color: colors.muted, paddingHorizontal: space.lg, marginTop: 4, fontSize: 13 }}>
          View {comments === 1 ? '1 comment' : `all ${comments} comments`}
        </Text>
      ) : null}
    </View>
  );
}

/** A grid tile of a post that hasn't revealed yet: blurred, with a small countdown. */
function GridLocked({ p, tall }) {
  const c = useCountdown(p.reveal.at);
  return (
    <View style={{ flex: 1, borderRadius: tall ? 0 : 6, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
      {p.reveal.teaser ? (
        <Image source={{ uri: mediaUrl(p.reveal.teaser) }} blurRadius={30} contentFit="cover"
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, Platform.OS === 'web' ? { filter: 'blur(14px)', transform: [{ scale: 1.3 }] } : null]} />
      ) : null}
      <Ionicons name="lock-closed" size={18} color="#fff" />
      <Text style={{ fontFamily: fonts.monoBold, fontSize: 11, color: '#fff', marginTop: 4 }}>{c.done ? 'Now' : c.text}</Text>
    </View>
  );
}

/** 3-column photo grid for profiles. Text posts show as a tile with their first words. */
/** 3-column grid. tall = profile style (portrait tiles, edge to edge, like Snapchat) */
export function PostGrid({ posts, tall }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: tall ? 0 : 2 }}>
      {posts.map((p) => (
        <Pressable key={p.id} onPress={() => router.push(`/post/${p.id}`)} style={{ width: '33.333%', aspectRatio: tall ? 0.54 : 1, padding: tall ? 1 : 2 }}>
          {p.reveal?.locked ? <GridLocked p={p} tall={tall} /> : p.media?.length ? (
            <View style={{ flex: 1 }}>
              {isVideo(p.media[0]) ? (
                <View style={{ flex: 1, borderRadius: tall ? 0 : 6, overflow: 'hidden' }}><PostVideo uri={mediaUrl(p.media[0])} thumb /></View>
              ) : <Image source={{ uri: mediaUrl(p.media[0]) }} style={{ flex: 1, borderRadius: tall ? 0 : 6, backgroundColor: colors.card }} contentFit="cover" />}
              {isVideo(p.media[0]) ? <Ionicons name="videocam" size={14} color="#fff" style={{ position: 'absolute', top: 6, left: 6 }} /> : null}
              {p.reveal ? <View style={{ position: 'absolute', left: 4, top: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,7,13,0.75)' }}><Ionicons name="time" size={13} color={colors.spark} /></View> : null}
              {p.media.length > 1 ? <Ionicons name="copy" size={14} color="#fff" style={{ position: 'absolute', top: 6, right: 6 }} /> : null}
              {p.suspended ? <View style={{ position: 'absolute', left: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(8,7,13,0.75)' }}><Ionicons name="eye-off" size={11} color={colors.spark} /><Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: '#fff', marginLeft: 3 }}>Suspended</Text></View> : null}
            </View>
          ) : (
            <View style={{ flex: 1, borderRadius: tall ? 0 : 6, padding: 8, backgroundColor: 'rgba(124,92,252,0.14)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.3)', justifyContent: 'center' }}>
              <Text numberOfLines={tall ? 8 : 4} style={{ fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.text }}>{p.caption}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}
