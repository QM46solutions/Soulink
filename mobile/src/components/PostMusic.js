// Music on a post: a song from JioSaavn / Deezer / free music, or one from the phone. The post plays a 30-second part.
//   MusicChip  – "♪ Song name" under the author's name; tap to play / pause (one song at a time)
//   MusicSheet – owner: pick a song (search or from the phone), or remove it
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { api, mediaUrl, uploadFile } from '../lib/api';
import { BottomSheet } from './PostSheets';
import MusicPicker, { pickAudioFile } from './MusicPicker';
import { Button } from './ui';
import { colors, fonts, space } from '../lib/theme';

const CLIP_SECONDS = 30;
let playing = null; // only one post's music plays at a time

export const pickAudio = pickAudioFile;

export function MusicChip({ music }) {
  const player = useAudioPlayer(music?.url ? { uri: mediaUrl(music.url) } : null, { updateInterval: 300 });
  const status = useAudioPlayerStatus(player);
  const from = music?.start || 0;
  // stop after the 30-second part
  useEffect(() => {
    if (status.playing && status.currentTime >= from + CLIP_SECONDS) { player.pause(); player.seekTo(from); }
  }, [status.currentTime, status.playing, player, from]);
  useEffect(() => () => { if (playing === player) playing = null; }, [player]);
  if (!music) return null;
  const toggle = () => {
    if (status.playing) { player.pause(); return; }
    if (playing && playing !== player) { try { playing.pause(); } catch { /* already gone */ } }
    playing = player;
    if (status.didJustFinish || status.currentTime < from || status.currentTime >= from + CLIP_SECONDS) player.seekTo(from);
    player.play();
  };
  return (
    <Pressable onPress={toggle} hitSlop={6} accessibilityLabel={status.playing ? 'Pause music' : `Play ${music.title}`}
      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, maxWidth: 230 }}>
      <Ionicons name={status.playing ? 'pause' : 'musical-notes'} size={12} color={colors.aura} style={{ marginRight: 4 }} />
      <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.aura, flexShrink: 1 }}>{music.title}</Text>
    </Pressable>
  );
}

/** Save a picked song on a post (after the post exists). Returns the updated post. */
export async function saveMusicOnPost(postId, m) {
  if (m.source === 'file') return (await uploadFile(`/posts/${postId}/music`, m, 'audio', { title: m.title || 'Music' }, 120000)).post;
  return (await api(`/posts/${postId}/music/stream`, { method: 'POST', body: { ref: m.ref, title: m.title, start: m.start || 0 } })).post;
}

export function MusicSheet({ visible, onClose, post, onChanged }) {
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (visible) { setError(null); if (!post.music) setPicker(true); } else setPicker(false); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const picked = async (m) => {
    setBusy(true); setError(null);
    try { onChanged(await saveMusicOnPost(post.id, m)); onClose(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError(null);
    try { const r = await api(`/posts/${post.id}/music`, { method: 'DELETE' }); onChanged(r.post); onClose(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (picker) return <MusicPicker visible onClose={() => setPicker(false)} onPick={picked} />;
  return (
    <BottomSheet visible={visible} onClose={onClose} title={post.music ? 'Music' : 'Add music'}>
      <View style={{ padding: space.lg }}>
        {post.music ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
            <Ionicons name="musical-notes" size={18} color={colors.aura} />
            <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, fontFamily: fonts.semibold, color: colors.text }}>Now: {post.music.title}</Text>
          </View>
        ) : null}
        {error ? <Text style={{ fontFamily: fonts.body, color: colors.danger, fontSize: 13, marginBottom: space.sm }}>{error}</Text> : null}
        {busy ? <ActivityIndicator color={colors.aura} style={{ marginTop: space.md }} /> : (
          <>
            <Button title={post.music ? 'Change music' : 'Choose a song'} onPress={() => setPicker(true)} />
            {post.music ? <Button variant="danger" small title="Remove music" onPress={remove} style={{ marginTop: space.sm }} /> : null}
          </>
        )}
      </View>
    </BottomSheet>
  );
}
