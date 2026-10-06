// Create a post: add up to 10 photos (gallery or camera) and/or write something, then Share.
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
import { Button, ErrorText, s } from '../components/ui';
import { colors, fonts, space } from '../lib/theme';

const MAX = 10;

export default function CreatePost() {
  const { pick } = useLocalSearchParams();
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const gallery = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Allow photo access to add photos'); return; }
    const left = MAX - photos.length;
    if (left <= 0) { setError(`Up to ${MAX} photos per post`); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: left, quality: 0.8 });
    if (!r.canceled && r.assets?.length) setPhotos((c) => [...c, ...r.assets.map((a) => a.uri)].slice(0, MAX));
  };
  const camera = async () => {
    setError(null);
    if (photos.length >= MAX) { setError(`Up to ${MAX} photos per post`); return; }
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setError('Allow camera access to take a photo'); return; }
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setPhotos((c) => [...c, r.assets[0].uri].slice(0, MAX));
  };

  useEffect(() => { if (pick === 'gallery') gallery(); else if (pick === 'camera') camera(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (i, d) => setPhotos((c) => { const n = [...c]; const j = i + d; if (j < 0 || j >= n.length) return c; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const canShare = (photos.length || caption.trim()) && !busy;

  const share = async () => {
    setBusy(true); setError(null);
    try { await createPost({ caption: caption.trim(), uris: photos }); router.back(); } catch (e) { setError(e.message); setBusy(false); }
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
              <View key={`${u}${i}`} style={{ width: '33.333%', aspectRatio: 1, padding: 4 }}>
                <Image source={{ uri: u }} style={{ flex: 1, borderRadius: 14, backgroundColor: colors.card }} contentFit="cover" />
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
          {photos.length ? `${photos.length}/${MAX} photos · first photo is the cover` : `Add up to ${MAX} photos, or just write something`}
        </Text>
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
        <Button title={busy ? 'Sharing…' : 'Share'} icon="paper-plane" onPress={share} loading={busy} disabled={!canShare} />
      </View>
    </View>
  );
}
