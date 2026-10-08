// WhatsApp-style "+" menu for chats: Photos, Location, Contact, Document, Poll — and how each shows in the chat.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, mediaUrl } from '../lib/api';
import { currentPosition } from '../lib/location';
import { notice } from '../lib/confirm';
import { BottomSheet } from './PostSheets';
import { Avatar } from './ui';
import { colors, fonts, gradients, space } from '../lib/theme';

const openUrl = (url) => { if (Platform.OS === 'web') window.open(url, '_blank', 'noopener'); else Linking.openURL(url); };

// ---------- the "+" sheet ----------
const ITEMS = [
  ['photos', 'Photos', 'image-multiple', ['#7c5cfc', '#b08fff']],
  ['location', 'Location', 'map-marker-radius', ['#42e8c0', '#2bb673']],
  ['contact', 'Contact', 'account-box', ['#3fa9f5', '#58a0e6']],
  ['document', 'Document', 'file-document', ['#ff9a5a', '#f5c842']],
  ['poll', 'Poll', 'poll', ['#ff6b9d', '#d6336c']],
];

export function AttachSheet({ visible, onClose, onPick, only }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Share">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: space.lg, paddingHorizontal: space.md }}>
        {ITEMS.filter(([k]) => !only || only.includes(k)).map(([k, label, icon, c]) => (
          <Pressable key={k} onPress={() => { onClose(); setTimeout(() => onPick(k), 180); }} accessibilityLabel={label}
            style={({ hovered, pressed }) => ({ width: '30%', alignItems: 'center', marginBottom: space.lg, transform: [{ scale: pressed ? 0.92 : hovered ? 1.06 : 1 }] })}>
            <View style={{ width: 58, height: 58, borderRadius: 29, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
              ...(Platform.OS === 'web' ? { boxShadow: `0 6px 16px ${c[0]}55` } : { shadowColor: c[0], shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }) }}>
              <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <LinearGradient colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <MaterialCommunityIcons name={icon} size={28} color="#fff" />
            </View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginTop: 8 }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

// ---------- location: your current spot ----------
export async function getMyLocation() {
  const c = await currentPosition();
  let label = null;
  try { label = (await api(`/places/near?lat=${c.latitude}&lon=${c.longitude}`)).place?.label || null; } catch { /* label is optional */ }
  return { lat: c.latitude, lon: c.longitude, ...(label ? { label } : {}) };
}

// ---------- contact: share one of your connections ----------
export function ContactPicker({ visible, onClose, onSend }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { if (visible) { setQ(''); api('/connections').then((r) => setList(r.connections || [])).catch(() => setList([])); } }, [visible]);
  const shown = (list || []).filter((u) => !q.trim() || `${u.displayName} ${u.username}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Share a contact" tall>
      <View style={{ padding: space.md }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search your connections" placeholderTextColor={colors.dim}
          style={{ height: 42, borderRadius: 21, paddingHorizontal: 16, backgroundColor: 'rgba(38,35,56,0.96)', color: colors.text, fontFamily: fonts.body, fontSize: 15, outlineStyle: 'none' }} />
      </View>
      {!list ? <ActivityIndicator color={colors.aura} style={{ marginTop: space.lg }} /> : (
        <ScrollView>
          {shown.map((u) => (
            <Pressable key={u.id} onPress={() => { onClose(); onSend(u); }} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10, backgroundColor: hovered ? 'rgba(255,255,255,0.04)' : 'transparent' })}>
              <Avatar uri={u.avatarUrl} size={40} name={u.displayName || u.username} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 14.5 }}>{u.displayName || u.username}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12.5 }}>@{u.username}</Text>
              </View>
              <Ionicons name="send" size={18} color={colors.aura} />
            </Pressable>
          ))}
          {!shown.length ? <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', padding: space.xl }}>{list.length ? 'No one matches that.' : 'Connect with people first, then you can share them here.'}</Text> : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

// ---------- document: a file from the phone (PDF, Word, Excel, PowerPoint, text, zip) ----------
const DOC_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip';
export function pickDocument() {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') { notice('Documents', 'Sending documents works in the Soulink web app for now.'); resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = DOC_TYPES;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) { resolve(null); return; }
      if (f.size > 25 * 1024 * 1024) { notice('Too big', 'Documents up to 25 MB.'); resolve(null); return; }
      resolve(f);
    };
    input.click();
  });
}

// ---------- poll: question + 2–6 options ----------
export function PollComposer({ visible, onClose, onSend }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  useEffect(() => { if (visible) { setQuestion(''); setOptions(['', '']); } }, [visible]);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ok = question.trim() && filled.length >= 2;
  const field = { minHeight: 44, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(38,35,56,0.96)', color: colors.text, fontFamily: fonts.body, fontSize: 15, outlineStyle: 'none' };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Create poll" tall>
      <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginBottom: 6 }}>QUESTION</Text>
        <TextInput value={question} onChangeText={setQuestion} placeholder="Ask a question" placeholderTextColor={colors.dim} maxLength={200} style={field} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: space.lg, marginBottom: 6 }}>OPTIONS</Text>
        {options.map((o, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <TextInput value={o} onChangeText={(t) => setOptions((c) => c.map((x, k) => (k === i ? t : x)))} placeholder={`Option ${i + 1}`} placeholderTextColor={colors.dim} maxLength={80} style={[field, { flex: 1 }]} />
            {options.length > 2 ? <Pressable onPress={() => setOptions((c) => c.filter((_, k) => k !== i))} hitSlop={8} style={{ marginLeft: 8 }} accessibilityLabel="Remove option"><Ionicons name="close-circle" size={22} color={colors.dim} /></Pressable> : null}
          </View>
        ))}
        {options.length < 6 ? (
          <Pressable onPress={() => setOptions((c) => [...c, ''])} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <Ionicons name="add-circle" size={20} color={colors.aura} /><Text style={{ marginLeft: 6, fontFamily: fonts.semibold, color: colors.aura }}>Add option</Text>
          </Pressable>
        ) : null}
        <Pressable disabled={!ok} onPress={() => { onSend({ question: question.trim(), options: filled }); onClose(); }}
          style={{ marginTop: space.lg, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: ok ? 1 : 0.45 }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>Send poll</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

// ---------- how they look in the chat (inside the normal bubble) ----------
const sub = (mine) => (mine ? 'rgba(255,255,255,0.82)' : colors.muted);

export function LocationContent({ loc, mine }) {
  const url = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`;
  return (
    <Pressable onPress={() => openUrl(url)} style={{ width: 230 }}>
      <View style={{ height: 110, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={['#1f6f5c', '#141221', '#3fa9f5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        {[20, 55, 90].map((t) => <View key={t} style={{ position: 'absolute', left: 0, right: 0, top: t, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />)}
        {[40, 115, 190].map((l) => <View key={l} style={{ position: 'absolute', top: 0, bottom: 0, left: l, width: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />)}
        <MaterialCommunityIcons name="map-marker" size={40} color="#ff6b9d" />
      </View>
      <Text numberOfLines={2} style={{ marginTop: 8, fontFamily: fonts.semibold, fontSize: 14, color: mine ? '#fff' : colors.text }}>{loc.label || 'My location'}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: sub(mine), marginTop: 2 }}>Tap to open in Maps</Text>
    </Pressable>
  );
}

export function ContactContent({ c, mine }) {
  return (
    <View style={{ width: 220 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar uri={c.avatarUrl} size={42} name={c.displayName || c.username} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: mine ? '#fff' : colors.text }}>{c.displayName || c.username}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12.5, color: sub(mine) }}>@{c.username}</Text>
        </View>
      </View>
      <Pressable onPress={() => router.push(`/user/${c.username}`)} style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: mine ? 'rgba(255,255,255,0.25)' : colors.border, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: mine ? '#fff' : colors.aura }}>View profile</Text>
      </Pressable>
    </View>
  );
}

const size = (n) => (!n ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
export function DocumentContent({ doc, url, mine }) {
  const ext = (doc.name.split('.').pop() || 'file').toUpperCase().slice(0, 4);
  return (
    <Pressable onPress={() => url && openUrl(mediaUrl(url))} style={{ width: 230, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 44, height: 52, borderRadius: 8, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : 'rgba(124,92,252,0.2)', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="file-document" size={24} color={mine ? '#fff' : colors.aura} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 8.5, color: mine ? '#fff' : colors.aura, marginTop: 1 }}>{ext}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 14, color: mine ? '#fff' : colors.text }}>{doc.name}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: sub(mine), marginTop: 2 }}>{[size(doc.size), url ? 'Tap to open' : 'Sending…'].filter(Boolean).join(' · ')}</Text>
      </View>
    </Pressable>
  );
}

export function PollContent({ poll, mine, onVote }) {
  const total = poll.total || 0;
  return (
    <View style={{ width: 240 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <MaterialCommunityIcons name="poll" size={16} color={mine ? '#fff' : colors.aura} style={{ marginRight: 6 }} />
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: mine ? '#fff' : colors.text }}>{poll.question}</Text>
      </View>
      {poll.options.map((o, i) => {
        const n = poll.counts?.[i] || 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const picked = poll.myVote === i;
        return (
          <Pressable key={i} onPress={() => onVote?.(i)} disabled={!onVote} style={({ hovered }) => ({ marginBottom: 8, opacity: hovered ? 0.9 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={picked ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={picked ? (mine ? '#fff' : colors.mint) : sub(mine)} />
              <Text style={{ flex: 1, marginLeft: 8, fontFamily: picked ? fonts.semibold : fonts.body, fontSize: 14, color: mine ? '#fff' : colors.text }}>{o}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: sub(mine) }}>{n}</Text>
            </View>
            <View style={{ height: 5, borderRadius: 3, marginTop: 5, marginLeft: 28, backgroundColor: mine ? 'rgba(255,255,255,0.25)' : colors.border, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: 5, borderRadius: 3, backgroundColor: mine ? '#fff' : colors.mint }} />
            </View>
          </Pressable>
        );
      })}
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: sub(mine), marginTop: 2 }}>{total === 1 ? '1 vote' : `${total} votes`} · tap to vote</Text>
    </View>
  );
}
