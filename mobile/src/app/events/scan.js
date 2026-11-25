// Gate check-in for Soulink event staff: point the camera at a ticket's QR. Each ticket works once; a second scan
// shows "Already checked in" with the time. Pick the event so tickets for other events are caught too.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Button, Chip, Input } from '../../components/ui';
import { dayText, timeText } from '../../components/events';
import { colors, fonts, space } from '../../lib/theme';

const RES = {
  ok: { text: 'Welcome in', color: colors.mint, icon: 'checkmark-circle' },
  already: { text: 'Already checked in', color: colors.danger, icon: 'close-circle' },
  unpaid: { text: 'Not paid', color: colors.danger, icon: 'close-circle' },
  wrong_event: { text: 'Ticket for another event', color: colors.gold, icon: 'alert-circle' },
  invalid: { text: 'Not a Soulink ticket', color: colors.danger, icon: 'close-circle' },
};

export default function Scan() {
  const [perm, ask] = useCameraPermissions();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [list, setList] = useState(null);
  const [res, setRes] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    api('/events').then((r) => {
      const now = Date.now();
      const near = r.events.filter((e) => e.status !== 'cancelled' && Math.abs(new Date(e.startsAt) - now) < 3 * 86400_000);
      setEvents(near); if (near.length === 1) setEventId(near[0].id);
    }).catch(() => {});
  }, []);
  const loadList = useCallback(() => { if (eventId) api(`/events/${eventId}/attendees`).then(setList).catch(() => {}); else setList(null); }, [eventId]);
  useEffect(() => { loadList(); const t = setInterval(loadList, 15000); return () => clearInterval(t); }, [loadList]);

  const check = async (text) => {
    if (lock.current || !text) return;
    lock.current = true; setBusy(true);
    try { const r = await api('/events/check-in', { method: 'POST', body: { code: text, ...(eventId ? { eventId } : {}) } }); setRes(r); setCode(''); loadList(); }
    catch (e) { setRes({ result: 'error', message: e.message }); }
    finally { setBusy(false); setTimeout(() => { lock.current = false; }, 2500); }
  };

  const r = res ? (RES[res.result] || { text: res.message || 'Try again', color: colors.danger, icon: 'alert-circle' }) : null;
  const paid = list?.attendees?.filter((a) => a.status === 'paid') || [];
  const inside = paid.filter((a) => a.checkedInAt);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Gate check-in' }} />
      {events.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
          {events.map((e) => <Chip key={e.id} label={`${e.title} · ${dayText(e.startsAt)}`} selected={eventId === e.id} onPress={() => setEventId(eventId === e.id ? null : e.id)} />)}
        </View>
      ) : null}

      <View style={{ aspectRatio: 1, maxHeight: 420, width: '100%', alignSelf: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', borderWidth: 2, borderColor: r ? r.color : colors.border }}>
        {perm?.granted ? (
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : ({ data }) => check(data)} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
            <Ionicons name="camera" size={40} color={colors.muted} />
            <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', marginVertical: space.md }}>Allow the camera to scan tickets.</Text>
            <Button title="Allow camera" small onPress={ask} />
          </View>
        )}
        {busy ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}><ActivityIndicator color="#fff" size="large" /></View> : null}
      </View>

      {r ? (
        <View style={{ marginTop: space.md, padding: space.lg, borderRadius: 20, borderWidth: 1, borderColor: `${r.color}88`, backgroundColor: `${r.color}1f`, alignItems: 'center' }}>
          <Ionicons name={r.icon} size={40} color={r.color} />
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: r.color, marginTop: 4 }}>{r.text}</Text>
          {res.name ? <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.text, marginTop: 4 }}>{res.name}</Text> : null}
          {res.event ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2, textAlign: 'center' }}>{res.event}{res.idType ? ` · check their ${res.idType}` : ''}</Text> : null}
          {res.result === 'already' && res.checkedInAt ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 }}>at {timeText(res.checkedInAt)}{res.checkedInBy ? ` by ${res.checkedInBy}` : ''}</Text> : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: space.md }}>
        <Input label="Or type the code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="SL…" autoCapitalize="characters" autoCorrect={false} style={{ flex: 1, marginBottom: 0 }} inputStyle={{ fontFamily: fonts.mono }} />
        <Button title="Check" small disabled={code.trim().length < 6 || busy} onPress={() => { lock.current = false; check(code); }} style={{ marginLeft: 8, marginTop: 24 }} />
      </View>

      {list ? (
        <View style={{ marginTop: space.lg }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: colors.aura, marginBottom: space.sm }}>{inside.length} / {paid.length} INSIDE · {list.event.title.toUpperCase()}</Text>
          {paid.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Ionicons name={a.checkedInAt ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={a.checkedInAt ? colors.mint : colors.dim} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text, marginLeft: 8 }}>{a.name}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>{a.checkedInAt ? timeText(a.checkedInAt) : a.phone}</Text>
            </View>
          ))}
        </View>
      ) : events.length > 1 ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: space.md, textAlign: 'center' }}>Pick the event to see who's inside.</Text> : null}
    </ScrollView>
  );
}
