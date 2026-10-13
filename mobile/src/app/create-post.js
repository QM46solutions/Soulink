// Create a post: add up to 10 photos or videos (gallery or camera) and/or write something, then Share now
// or Schedule a reveal (it goes up now, blurred with a countdown, and shows clearly at the time you pick).
// Opened from Home ("Photo" opens the gallery straight away, "Post" starts with writing).
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createPost } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AuraAvatar } from '../components/ProfileHeader';
import CityField from '../components/CityField';
import MusicPicker from '../components/MusicPicker';
import { saveMusicOnPost } from '../components/PostMusic';
import { ScheduleSheet } from '../components/PostReveal';
import PostVideo from '../components/PostVideo';
import { Button, ErrorText, s } from '../components/ui';
import { colors, fonts, space } from '../lib/theme';

const MAX = 10;

export default function CreatePost() {
  const { pick } = useLocalSearchParams();
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [music, setMusic] = useState(null); // song picked from JioSaavn / Deezer / free music / the phone
  const [musicOpen, setMusicOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const gallery = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Allow photo access to add photos'); return; }
    const left = MAX - photos.length;
    if (left <= 0) { setError(`Up to ${MAX} photos per post`); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: left, quality: 0.8, videoMaxDuration: 180 });
    if (!r.canceled && r.assets?.length) {
      const big = r.assets.find((a) => a.type === 'video' && a.fileSize && a.fileSize > 40 * 1024 * 1024);
      if (big) setError('A video can be up to 40 MB. Pick a shorter one.');
      const add = r.assets.filter((a) => a !== big).map((a) => ({ uri: a.uri, video: a.type === 'video' || /^video\//.test(a.mimeType || ''), type: a.mimeType }));
      setPhotos((c) => [...c, ...add].slice(0, MAX));
    }
  };
  const camera = async () => {
    setError(null);
    if (photos.length >= MAX) { setError(`Up to ${MAX} photos per post`); return; }
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setError('Allow camera access to take a photo'); return; }
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setPhotos((c) => [...c, { uri: r.assets[0].uri }].slice(0, MAX));
  };

  useEffect(() => { if (pick === 'gallery') gallery(); else if (pick === 'camera') camera(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (i, d) => setPhotos((c) => { const n = [...c]; const j = i + d; if (j < 0 || j >= n.length) return c; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const canShare = (photos.length || caption.trim()) && !busy;

  const share = async (revealAt) => {
    setBusy(true); setError(null);
    let made = null;
    try { made = await createPost({ caption: caption.trim(), items: photos, place: place.trim() || undefined, revealAt }); } catch (e) { setError(e.message); setBusy(false); return; }
    // the post is up; adding its music is a second step (if it fails, the post stays and music can be added from its ⋯ menu)
    if (music && made?.post?.id) await saveMusicOnPost(made.post.id, music).catch(() => {});
    router.back();
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <AuraAvatar user={user} size={48} />
          <TextInput
            value={caption} onChangeText={setCaption} multiline maxLength={2200} autoFocus={!pick}
            placeholder={photos.length ? 'Write a caption…' : `What's on your soul today, ${user.displayName?.split(' ')[0] || user.username}?`}
            placeholderTextColor={colors.dim}
            style={{ flex: 1, marginLeft: space.md, minHeight: 110, fontFamily: photos.length ? fonts.body : fonts.displaySemi, fontSize: photos.length ? 16 : 20, lineHeight: photos.length ? 22 : 28, color: colors.text, textAlignVertical: 'top', outlineStyle: 'none' }}
          />
        </View>
        <Text style={{ alignSelf: 'flex-end', fontFamily: fonts.mono, fontSize: 10.5, color: colors.dim, marginBottom: space.md }}>{caption.length}/2200</Text>

        {photos.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: space.md }}>
            {photos.map((u, i) => (
              <View key={`${u.uri}${i}`} style={{ width: '33.333%', aspectRatio: 1, padding: 4 }}>
                {u.video ? (
                  <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }}><PostVideo uri={u.uri} thumb /></View>
                ) : <Image source={{ uri: u.uri }} style={{ flex: 1, borderRadius: 14, backgroundColor: colors.card }} contentFit="cover" />}
                {u.video ? <Ionicons name="videocam" size={15} color="#fff" style={{ position: 'absolute', right: 10, bottom: 34 }} /> : null}
                {i === 0 ? <View style={{ position: 'absolute', left: 10, top: 10, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.soul }}><Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>COVER</Text></View> : null}
                <Pressable onPress={() => setPhotos((c) => c.filter((_, k) => k !== i))} hitSlop={6} accessibilityLabel="Remove photo"
                  style={{ position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(8,7,13,0.75)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={15} color="#fff" />
                </Pressable>
                {photos.length > 1 ? (
                  <View style={{ position: 'absolute', bottom: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                    {i > 0 ? <Pressable onPress={() => move(i, -1)} hitSlop={6} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(8,7,13,0.75)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={14} color="#fff" /></Pressable> : <View />}
                    {i < photos.length - 1 ? <Pressable onPress={() => move(i, 1)} hitSlop={6} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(8,7,13,0.75)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-forward" size={14} color="#fff" /></Pressable> : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row' }}>
          {[['images', 'Gallery', gallery], ['camera', 'Camera', camera]].map(([icon, label, fn]) => (
            <Pressable key={label} onPress={fn} style={({ hovered }) => ({ flex: 1, height: 56, borderRadius: 999, marginRight: label === 'Gallery' ? space.sm : 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: hovered ? colors.aura : colors.border, backgroundColor: colors.glass })}>
              <Ionicons name={icon} size={19} color={colors.aura} style={{ marginRight: 8 }} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: space.md }}>
          {photos.length ? `${photos.length}/${MAX} · the first one is the cover` : `Add up to ${MAX} photos or videos, or just write something`}
        </Text>
        <Pressable onPress={() => setMusicOpen(true)} style={({ hovered }) => ({ marginTop: space.lg, height: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, borderWidth: 1, borderColor: hovered || music ? colors.aura : colors.border, backgroundColor: colors.glass })}>
          <Ionicons name="musical-notes" size={19} color={music ? colors.spark : colors.aura} style={{ marginRight: 10 }} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{music ? music.title : '🎵 Add music (optional)'}</Text>
          {music ? <Pressable onPress={() => setMusic(null)} hitSlop={10} accessibilityLabel="Remove music"><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable> : <Ionicons name="chevron-forward" size={18} color={colors.dim} />}
        </Pressable>
        <MusicPicker visible={musicOpen} onClose={() => setMusicOpen(false)} onPick={setMusic} />
        <View style={{ marginTop: space.lg }}><CityField value={place} onChange={setPlace} autoLocate={false} label="📍 Add location (optional)" /></View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, textAlign: 'center', marginTop: 4 }}>Seen by your Connections and Followers{user.settings?.isPrivate ? '' : ' and anyone who visits your profile'}</Text>
        {/* community rule, told to the person posting (not to people who mark posts) */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: space.lg, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(26,24,40,0.7)' }}>
          <Ionicons name="alert-circle" size={17} color={colors.aura} style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.text }}>Keep it kind. </Text>
            People can mark a post as offensive with ❗. If more than 75 people mark yours, it's hidden from everyone except you.
          </Text>
        </View>
        <ErrorText>{error}</ErrorText>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingBottom: space.xl, backgroundColor: 'rgba(8,7,13,0.92)', borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flexDirection: 'row' }}>
          {/* Schedule: needs a photo or video (that's what gets blurred until the reveal) */}
          <Pressable onPress={() => setScheduleOpen(true)} disabled={!canShare || !photos.length} accessibilityLabel="Schedule the reveal"
            style={({ hovered }) => ({ flex: 1, height: 52, borderRadius: 26, marginRight: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
              borderColor: hovered ? colors.spark : colors.aura, opacity: !canShare || !photos.length ? 0.45 : 1 })}>
            <Ionicons name="time-outline" size={19} color={colors.aura} style={{ marginRight: 6 }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>Schedule</Text>
          </Pressable>
          <View style={{ flex: 1 }}><Button title={busy ? 'Sharing…' : 'Share now'} icon="paper-plane" onPress={() => share()} loading={busy} disabled={!canShare} /></View>
        </View>
        <ScheduleSheet visible={scheduleOpen} onClose={() => setScheduleOpen(false)} onPick={(at) => share(at)} />
      </View>
    </View>
  );
}
