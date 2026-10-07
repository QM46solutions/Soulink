// Music on a post: a song the owner picked from their phone. The post plays its first 30 seconds.
//   MusicChip  – "♪ Song name" under the author's name; tap to play / pause (one song at a time)
//   MusicSheet – owner: choose a song from the phone, rename it, or remove it
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { api, mediaUrl, uploadFile } from '../lib/api';
import { BottomSheet } from './PostSheets';
import { Button } from './ui';
import { colors, fonts, space } from '../lib/theme';

const CLIP_SECONDS = 30;
let playing = null; // only one post's music plays at a time

export function MusicChip({ music }) {
  const player = useAudioPlayer(music?.url ? { uri: mediaUrl(music.url) } : null, { updateInterval: 300 });
  const status = useAudioPlayerStatus(player);
  // stop after the 30-second clip
  useEffect(() => {
    if (status.playing && status.currentTime >= CLIP_SECONDS) { player.pause(); player.seekTo(0); }
  }, [status.currentTime, status.playing, player]);
  useEffect(() => () => { if (playing === player) playing = null; }, [player]);
  if (!music) return null;
  const toggle = () => {
    if (status.playing) { player.pause(); return; }
    if (playing && playing !== player) { try { playing.pause(); } catch { /* already gone */ } }
    playing = player;
    if (status.didJustFinish || status.currentTime >= CLIP_SECONDS) player.seekTo(0);
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

/** Web: open the phone's file picker for audio. Resolves { uri, name, type } or null. */
export function pickAudio() {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') { resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'audio/*';
    input.onchange = () => {
      const f = input.files?.[0];
      resolve(f ? { uri: URL.createObjectURL(f), name: f.name, type: f.type || 'audio/mpeg', size: f.size } : null);
    };
    input.click();
  });
}

export function MusicSheet({ visible, onClose, post, onChanged }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (visible) { setFile(null); setTitle(post.music?.title || ''); setError(null); } }, [visible, post.music]);

  const choose = async () => {
    setError(null);
    const f = await pickAudio();
    if (!f) { if (Platform.OS !== 'web') setError('Adding music works in the web version for now.'); return; }
    if (f.size > 15 * 1024 * 1024) { setError('That file is too big (15 MB max).'); return; }
    setFile(f);
    if (!title.trim() || title === post.music?.title) setTitle(f.name.replace(/\.[a-z0-9]{2,4}$/i, ''));
  };
  const save = async () => {
    setBusy(true); setError(null);
    try {
      let r;
      if (file) r = await uploadFile(`/posts/${post.id}/music`, file, 'audio', { title: title.trim() || 'Music' }, 120000);
      else r = null;
      if (r) onChanged(r.post);
      onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError(null);
    try { const r = await api(`/posts/${post.id}/music`, { method: 'DELETE' }); onChanged(r.post); onClose(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={post.music ? 'Change music' : 'Add music'}>
      <View style={{ padding: space.lg }}>
        {post.music && !file ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
            <Ionicons name="musical-notes" size={18} color={colors.aura} />
            <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, fontFamily: fonts.semibold, color: colors.text }}>Now: {post.music.title}</Text>
          </View>
        ) : null}
        <Pressable onPress={choose} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed',
          borderColor: hovered ? colors.aura : colors.border, backgroundColor: 'rgba(124,92,252,0.08)' })}>
          <Ionicons name={file ? 'checkmark-circle' : 'folder-open-outline'} size={22} color={file ? colors.mint : colors.aura} />
          <Text numberOfLines={1} style={{ flex: 1, marginLeft: 10, fontFamily: fonts.medium, color: colors.text }}>{file ? file.name : 'Choose a song from your phone'}</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 6 }}>Your post plays the first 30 seconds. Only use music you're allowed to share.</Text>
        {file ? (
          <TextInput value={title} onChangeText={setTitle} maxLength={150} placeholder="Song name · Artist" placeholderTextColor={colors.dim}
            style={{ marginTop: space.md, height: 44, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, fontFamily: fonts.body, fontSize: 15, outlineStyle: 'none' }} />
        ) : null}
        {error ? <Text style={{ fontFamily: fonts.body, color: colors.danger, fontSize: 13, marginTop: space.sm }}>{error}</Text> : null}
        {busy ? <ActivityIndicator color={colors.aura} style={{ marginTop: space.md }} /> : (
          <>
            {file ? <Button title={post.music ? 'Change music' : 'Add music'} onPress={save} style={{ marginTop: space.md }} /> : null}
            {post.music ? <Button variant="danger" small title="Remove music" onPress={remove} style={{ marginTop: space.sm }} /> : null}
          </>
        )}
      </View>
    </BottomSheet>
  );
}
