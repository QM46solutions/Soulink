// New Moment (Home "+"): take a photo, pick one, or write something; then add it to your Moments (24 h)
// and/or send it to chats (it opens once there, can be replayed once or saved). Not a profile post.
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { notice } from '../../lib/confirm';
import { MOMENT_BGS, bgOf, sendMoment } from '../../lib/moments';
import { ConversationAvatar } from '../../components/chat';
import { GradientText } from '../../components/brand';
import MusicPicker from '../../components/MusicPicker';
import { colors, fonts, gradients, space } from '../../lib/theme';

const WRAP = Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'anywhere' } : {};

function Start({ onCamera, onGallery, onWrite }) {
  const Opt = ({ icon, title, text, onPress, colors: c }) => (
    <Pressable onPress={onPress} style={({ hovered, pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: 22, marginBottom: space.md,
      borderWidth: 1.5, borderColor: hovered ? colors.aura : colors.border, backgroundColor: pressed ? 'rgba(124,92,252,0.15)' : colors.glass })}>
      <View style={{ width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <View style={{ marginLeft: space.md, flex: 1 }}>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 }}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.dim} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.xl }}>
      <GradientText style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 42, textAlign: 'center' }}>Share a Moment</GradientText>
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: space.xl }}>
        For your Moments (24 hours) or straight to your people. Not a profile post.
      </Text>
      <Opt icon="camera" title="Camera" text="Take a photo now" onPress={onCamera} colors={['#ff6b9d', '#ff9a5a']} />
      <Opt icon="images" title="Gallery" text="Pick a photo from your phone" onPress={onGallery} colors={['#7c5cfc', '#b08fff']} />
      <Opt icon="create" title="Write" text="Say something on a colour card" onPress={onWrite} colors={['#3fa9f5', '#42e8c0']} />
    </View>
  );
}

export default function NewMoment() {
  const { mode } = useLocalSearchParams();
  const { user } = useAuth();
  const [step, setStep] = useState('start'); // start | edit | share
  const [photo, setPhoto] = useState(null);
  const [text, setText] = useState('');
  const [bg, setBg] = useState('aurora');
  const [story, setStory] = useState(true);
  const [chats, setChats] = useState(null);
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState(false);
  const [music, setMusic] = useState(null); // a song from JioSaavn / Deezer / free music
  const [musicOpen, setMusicOpen] = useState(false);

  const camera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted && Platform.OS !== 'web') { notice('Camera', 'Allow the camera for Soulink in your phone settings.'); return; }
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (!r.canceled && r.assets?.[0]) { setPhoto(r.assets[0].uri); setStep('edit'); }
    } catch (e) { notice('Camera', e.message); }
  };
  const gallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!r.canceled && r.assets?.[0]) { setPhoto(r.assets[0].uri); setStep('edit'); }
  };
  const write = () => { setPhoto(null); setStep('edit'); };
  useEffect(() => { if (mode === 'camera') camera(); else if (mode === 'gallery') gallery(); else if (mode === 'write') write(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toShare = () => {
    if (!photo && !text.trim()) { notice('Moment', 'Write something first.'); return; }
    setStep('share');
    if (!chats) api('/conversations?box=inbox').then((r) => setChats(r.conversations.map((c) => ({ ...c, meId: user.id })))).catch(() => setChats([]));
  };
  const ids = Object.keys(picked).filter((k) => picked[k]);
  const share = async () => {
    if (!story && !ids.length) { notice('Moment', 'Add it to your Moments or pick at least one chat.'); return; }
    setBusy(true);
    try {
      const r = await sendMoment({ photoUri: photo, text, bg, story, conversationIds: ids, music });
      if (r.failed?.length) notice('Some chats were skipped', r.failed.map((f) => f.reason).join('\n'));
      router.back();
    } catch (e) { notice('Not shared', e.message); } finally { setBusy(false); }
  };

  const close = () => (step === 'start' ? router.back() : step === 'share' ? setStep('edit') : (setStep('start'), setPhoto(null), setText(''), setMusic(null)));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel={step === 'start' ? 'Close' : 'Back'}>
          <Ionicons name={step === 'start' ? 'close' : 'arrow-back'} size={26} color={colors.text} />
        </Pressable>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>{step === 'share' ? 'Share to' : 'New Moment'}</Text>
        {step === 'edit' ? (
          <Pressable onPress={toShare} hitSlop={10}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.aura }}>Next</Text></Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      {step === 'start' ? <Start onCamera={camera} onGallery={gallery} onWrite={write} /> : null}

      {step === 'edit' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, padding: space.lg }}>
          {/* music for the Moment (plays while people watch it) */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: space.md }}>
            <Pressable onPress={() => setMusicOpen(true)} accessibilityLabel={music ? 'Change music' : 'Add music'}
              style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', maxWidth: '92%', height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: hovered || music ? colors.spark : colors.border, backgroundColor: music ? 'rgba(255,107,157,0.14)' : colors.glass })}>
              <Ionicons name="musical-notes" size={16} color={music ? colors.spark : colors.aura} />
              <Text numberOfLines={1} style={{ marginLeft: 6, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, flexShrink: 1 }}>{music ? music.title : 'Add music'}</Text>
              {music ? <Pressable onPress={() => setMusic(null)} hitSlop={10} style={{ marginLeft: 8 }} accessibilityLabel="Remove music"><Ionicons name="close-circle" size={17} color={colors.muted} /></Pressable> : null}
            </Pressable>
          </View>
          <MusicPicker visible={musicOpen} onClose={() => setMusicOpen(false)} onPick={setMusic} allowPhone={false} clip={15} title="Music for your Moment" />
          {photo ? (
            <View style={{ flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' }}>
              <Image source={{ uri: photo }} style={{ flex: 1 }} resizeMode="contain" />
              <TextInput value={text} onChangeText={setText} maxLength={200} placeholder="Add a caption…" placeholderTextColor="rgba(255,255,255,0.7)"
                style={{ position: 'absolute', left: 12, right: 12, bottom: 14, minHeight: 44, borderRadius: 16, paddingHorizontal: 14, backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff', fontFamily: fonts.semibold, fontSize: 15, outlineStyle: 'none' }} />
            </View>
          ) : (
            <>
              <View style={{ flex: 1, borderRadius: 24, overflow: 'hidden', justifyContent: 'center', padding: space.xl }}>
                <LinearGradient colors={bgOf(bg)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <TextInput value={text} onChangeText={setText} maxLength={500} multiline autoFocus placeholder="What's on your mind?" placeholderTextColor="rgba(255,255,255,0.7)"
                  style={{ color: '#fff', fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 34, textAlign: 'center', outlineStyle: 'none', minHeight: 120, ...WRAP }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.md, gap: 12 }}>
                {Object.keys(MOMENT_BGS).map((k) => (
                  <Pressable key={k} onPress={() => setBg(k)} accessibilityLabel={`${k} background`}
                    style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: bg === k ? 3 : 1, borderColor: bg === k ? '#fff' : colors.border }}>
                    <LinearGradient colors={MOMENT_BGS[k]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      ) : null}

      {step === 'share' ? (
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => setStory((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Ionicons name="sparkles" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>Your Moments</Text>
              <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>Your Connections and Followers see it for 24 hours</Text>
            </View>
            <Ionicons name={story ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={story ? colors.mint : colors.dim} />
          </Pressable>
          <Text style={{ color: colors.dim, fontSize: 12, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
            Send to chats · opens once, one replay, or they save it
          </Text>
          {!chats ? <ActivityIndicator color={colors.aura} style={{ marginTop: space.lg }} /> : (
            <FlatList data={chats} keyExtractor={(c) => c.id} style={{ flex: 1 }}
              ListEmptyComponent={<Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', padding: space.lg }}>No chats yet. Connect with someone first.</Text>}
              renderItem={({ item: c }) => (
                <Pressable onPress={() => setPicked((p) => ({ ...p, [c.id]: !p[c.id] }))} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 9 }}>
                  <ConversationAvatar conversation={c} size={44} />
                  <Text numberOfLines={1} style={{ flex: 1, marginLeft: space.md, fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>{c.title}</Text>
                  <Ionicons name={picked[c.id] ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={picked[c.id] ? colors.aura : colors.dim} />
                </Pressable>
              )} />
          )}
          <View style={{ padding: space.lg }}>
            <Pressable onPress={share} disabled={busy || (!story && !ids.length)}
              style={({ hovered }) => ({ height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: !story && !ids.length ? 0.5 : 1, transform: [{ scale: hovered ? 1.01 : 1 }] })}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 16 }}>
                  {story && ids.length ? `Share to Moments + ${ids.length} chat${ids.length > 1 ? 's' : ''}` : story ? 'Add to my Moments' : `Send to ${ids.length} chat${ids.length > 1 ? 's' : ''}`}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
