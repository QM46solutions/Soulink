// Music picker used everywhere you can add music (posts, Moments, Sparks).
// Tabs: JioSaavn (Indian songs, full) · Deezer (world hits, 30-second clips) · Free music (Creative Commons) · My phone.
// Tap ▶ to hear a song, tap it to choose it. Full songs then let you pick which part plays.
// onPick({ source, ref?, uri, name, title, start, cover?, type?, size? })
//   source 'file' = a song from the phone (uri is a local file); otherwise ref = 'saavn:<id>' etc. and uri streams it.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { api, mediaUrl } from '../lib/api';
import { BottomSheet } from './PostSheets';
import { Slider } from './Slider';
import { colors, fonts, gradients, space } from '../lib/theme';

const TABS = [
  { key: 'saavn', label: 'JioSaavn', icon: 'music-circle', chips: ['Telugu', 'Hindi', 'Tamil', 'Romantic', 'Party', 'Devotional', 'Lo-fi'] },
  { key: 'deezer', label: 'Deezer', icon: 'music-box-multiple', chips: ['Top hits', 'Bollywood', 'Pop', 'Hip hop', 'Chill', 'Workout'] },
  { key: 'free', label: 'Free music', icon: 'creative-commons', chips: ['Happy', 'Acoustic', 'Piano', 'Cinematic', 'Lo-fi', 'Travel'] },
  { key: 'file', label: 'My phone', icon: 'cellphone' },
];
export const playPath = (ref) => `/music/play/${ref}`;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// one preview at a time, on web a plain <audio>, on phones expo-audio
function usePreview() {
  const p = useRef(null);
  const [on, setOn] = useState(null); // key of what's playing
  const stop = () => { try { p.current?.pause(); } catch { /* gone */ } setOn(null); };
  const play = (key, url, at = 0) => {
    stop();
    if (Platform.OS === 'web') {
      const a = new Audio(url); a.currentTime = at; a.onended = () => setOn(null);
      a.play().catch(() => setOn(null)); p.current = a;
    } else {
      const a = createAudioPlayer({ uri: url }); a.seekTo(at); a.play(); p.current = a;
    }
    setOn(key);
  };
  useEffect(() => () => { try { p.current?.pause(); p.current?.remove?.(); } catch { /* gone */ } }, []);
  return { on, play, stop, el: p };
}

/** Web: open the phone's file picker for audio. Resolves { uri, name, type, size } or null. */
export function pickAudioFile() {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') { resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'audio/*';
    input.onchange = () => { const f = input.files?.[0]; resolve(f ? { uri: URL.createObjectURL(f), name: f.name, type: f.type || 'audio/mpeg', size: f.size } : null); };
    input.click();
  });
}

function Cover({ uri, size = 48 }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 10, backgroundColor: colors.card }} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Ionicons name="musical-notes" size={size * 0.45} color="#fff" />
    </View>
  );
}

export default function MusicPicker({ visible, onClose, onPick, allowPhone = true, clip = 30, title = 'Add music' }) {
  const [tab, setTab] = useState('saavn');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [chosen, setChosen] = useState(null); // a full song: pick the part
  const [start, setStart] = useState(0);
  const startRef = useRef(0); startRef.current = start; // the slider keeps its first callbacks, so read the latest value here
  const pv = usePreview();
  const seq = useRef(0);
  const [on, setOn] = useState(null); // music sources the server has turned on (unlicensed ones are off in production)
  useEffect(() => {
    if (!visible || on) return;
    api('/music/sources').then((r) => { setOn(r.sources); if (!r.sources.includes(tab)) setTab(r.sources[0] || 'file'); }).catch(() => {});
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!visible) { pv.stop(); setChosen(null); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  // search (waits a moment after you stop typing)
  useEffect(() => {
    if (!visible || tab === 'file') return undefined;
    const n = ++seq.current; setError(null); setList(null);
    const t = setTimeout(async () => {
      try {
        const r = await api(`/music/search?source=${tab}&q=${encodeURIComponent(q.trim())}`);
        if (n === seq.current) setList(r.tracks);
      } catch (e) { if (n === seq.current) { setError(e.message); setList([]); } }
    }, q ? 450 : 0);
    return () => clearTimeout(t);
  }, [tab, q, visible]);

  const finish = (track, at) => {
    pv.stop();
    onPick({ source: track.source, ref: track.ref, uri: mediaUrl(playPath(track.ref)), name: [track.title, track.artist].filter(Boolean).join(' · '),
      title: [track.title, track.artist].filter(Boolean).join(' · ').slice(0, 150), start: Math.round(at || 0), cover: track.cover, full: track.full, duration: track.duration });
    onClose();
  };
  const choose = (t) => {
    if (t.full && t.duration && t.duration > clip + 5) { setChosen(t); setStart(Math.min(45, Math.max(0, t.duration - clip))); pv.stop(); }
    else finish(t, 0);
  };
  const fromPhone = async () => {
    pv.stop();
    const f = await pickAudioFile();
    if (!f) { setError(Platform.OS === 'web' ? null : 'Songs from your phone work in the web version for now.'); return; }
    if (f.size > 15 * 1024 * 1024) { setError('That file is too big (15 MB max).'); return; }
    onPick({ source: 'file', uri: f.uri, name: f.name, type: f.type, size: f.size, title: f.name.replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 150), start: 0 });
    onClose();
  };
  const tabs = TABS.filter((t) => (allowPhone || t.key !== 'file') && (t.key === 'file' || !on || on.includes(t.key)));
  const cur = TABS.find((t) => t.key === tab);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={chosen ? 'Pick the part' : title} tall>
      {chosen ? (
        <View style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Cover uri={chosen.cover} size={64} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.text }}>{chosen.title}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 }}>{chosen.artist}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text, marginTop: space.xl }}>{`Plays ${fmt(start)} – ${fmt(Math.min(chosen.duration, start + clip))}`}</Text>
          <Slider value={start} min={0} max={Math.max(1, chosen.duration - clip)} color={colors.spark}
            onChange={(n) => setStart(Math.round(n))} onDone={() => pv.play('part', chosen.previewUrl, startRef.current)} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.dim }}>0:00</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.dim }}>{fmt(chosen.duration)}</Text>
          </View>
          <View style={{ flexDirection: 'row', marginTop: space.xl }}>
            <Pressable onPress={() => (pv.on === 'part' ? pv.stop() : pv.play('part', chosen.previewUrl, start))}
              style={{ flex: 1, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: colors.aura, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginRight: 10 }}>
              <Ionicons name={pv.on === 'part' ? 'pause' : 'play'} size={18} color={colors.aura} />
              <Text style={{ fontFamily: fonts.semibold, color: colors.text, marginLeft: 6 }}>{pv.on === 'part' ? 'Pause' : 'Listen'}</Text>
            </Pressable>
            <Pressable onPress={() => finish(chosen, start)} style={{ flex: 1, height: 50, borderRadius: 25, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>Use this part</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => { pv.stop(); setChosen(null); }} style={{ alignSelf: 'center', marginTop: space.lg }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>Choose another song</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: space.md, paddingTop: space.md }}>
            {tabs.map((t) => {
              const on = t.key === tab;
              return (
                <Pressable key={t.key} onPress={() => { pv.stop(); setTab(t.key); setError(null); }} accessibilityRole="tab" accessibilityState={{ selected: on }}
                  style={{ flex: 1, height: 36, marginHorizontal: 3, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: on ? 0 : 1, borderColor: colors.border }}>
                  {on ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
                  <MaterialCommunityIcons name={t.icon} size={14} color={on ? '#fff' : colors.muted} />
                  <Text numberOfLines={1} style={{ marginLeft: 4, fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 12, color: on ? '#fff' : colors.muted }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {tab === 'file' ? (
            <View style={{ padding: space.lg }}>
              <Pressable onPress={fromPhone} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: hovered ? colors.aura : colors.border, backgroundColor: 'rgba(124,92,252,0.08)' })}>
                <MaterialCommunityIcons name="folder-music-outline" size={26} color={colors.aura} />
                <Text style={{ flex: 1, marginLeft: 12, fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>Choose a song from your phone</Text>
              </Pressable>
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 8 }}>Up to 15 MB. Only use music you're allowed to share.</Text>
              {error ? <Text style={{ fontFamily: fonts.body, color: colors.danger, fontSize: 13, marginTop: space.sm }}>{error}</Text> : null}
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: space.lg, marginTop: space.md, height: 42, borderRadius: 21, paddingHorizontal: 14, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="search" size={17} color={colors.muted} />
                <TextInput value={q} onChangeText={setQ} placeholder={tab === 'free' ? 'Search free music' : 'Search songs, artists, movies'} placeholderTextColor={colors.dim} maxLength={100}
                  style={{ flex: 1, marginLeft: 8, color: colors.text, fontFamily: fonts.body, fontSize: 15, outlineStyle: 'none' }} />
                {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Ionicons name="close-circle" size={17} color={colors.dim} /></Pressable> : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.sm }} contentContainerStyle={{ paddingHorizontal: space.lg }}>
                {cur.chips.map((c) => (
                  <Pressable key={c} onPress={() => setQ(c === 'Top hits' ? '' : c)}
                    style={{ paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', marginRight: 8, backgroundColor: q === c ? 'rgba(255,107,157,0.18)' : 'rgba(124,92,252,0.12)', borderWidth: 1, borderColor: q === c ? colors.spark : 'transparent' }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.text }}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {error ? <Text style={{ fontFamily: fonts.body, color: colors.danger, fontSize: 13, marginHorizontal: space.lg, marginTop: space.md }}>{error}</Text> : null}
              {!list ? <ActivityIndicator color={colors.aura} style={{ marginTop: space.xl }} /> : (
                <FlatList data={list} keyExtractor={(t) => t.ref} style={{ flex: 1, marginTop: space.sm }} keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={error ? null : <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', padding: space.lg }}>No songs found. Try another search.</Text>}
                  ListFooterComponent={tab === 'free' ? <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.dim, textAlign: 'center', padding: space.md }}>Free music from Openverse (Creative Commons). The artist is shown with the song.</Text> : <View style={{ height: 16 }} />}
                  renderItem={({ item: t }) => (
                    <Pressable onPress={() => choose(t)} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 8, backgroundColor: hovered ? 'rgba(255,255,255,0.04)' : 'transparent' })}>
                      <Cover uri={t.cover} />
                      <View style={{ flex: 1, marginLeft: space.md }}>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text }}>{t.title}</Text>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 1 }}>
                          {[t.artist, t.full ? (t.duration ? fmt(t.duration) : null) : '30s clip'].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Pressable onPress={() => (pv.on === t.ref ? pv.stop() : pv.play(t.ref, t.previewUrl, t.full && t.duration > 90 ? 45 : 0))} hitSlop={8} accessibilityLabel={pv.on === t.ref ? 'Pause' : `Listen to ${t.title}`}
                        style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: pv.on === t.ref ? colors.spark : 'rgba(124,92,252,0.18)' }}>
                        <Ionicons name={pv.on === t.ref ? 'pause' : 'play'} size={17} color="#fff" style={{ marginLeft: pv.on === t.ref ? 0 : 2 }} />
                      </Pressable>
                    </Pressable>
                  )} />
              )}
            </>
          )}
        </View>
      )}
    </BottomSheet>
  );
}
