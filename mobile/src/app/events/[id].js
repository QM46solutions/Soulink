// One Soul Event: details, and the registration form. Name and phone come from the Soulink account (phone can't be
// changed here), the address is typed (remembered for next time), and a government ID is uploaded (photo or PDF).
// Then payment (Razorpay page, or test mode) and the QR ticket.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { api, mediaUrl, uploadFile } from '../../lib/api';
import { notice } from '../../lib/confirm';
import { Button, Chip, ErrorText, Input, s as ui } from '../../components/ui';
import { dayText, kindOf, rupees, startPayment, timeText } from '../../components/events';
import { colors, fonts, space } from '../../lib/theme';

export default function EventPage() {
  const { id } = useLocalSearchParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [f, setF] = useState({ fullName: '', address: '', idType: '' });
  const [file, setFile] = useState(null); // { uri, name, type }
  const [agree, setAgree] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [opened, setOpened] = useState(false); // shows "I've paid: check now"
  const waiting = useRef(false); // the payment page is open
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const load = useCallback(async () => {
    try {
      const r = await api(`/events/${id}`);
      setD(r); setError(null);
      setF((x) => (x.fullName || x.address ? x : { fullName: r.registration?.fullName || r.prefill.fullName, address: r.registration?.address || r.prefill.address, idType: r.registration?.idType || '' }));
      return r;
    } catch (e) { setError(e.message); return null; }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const checkPaid = useCallback(async () => {
    const reg = d?.registration; if (!reg) return;
    try {
      const r = await api(`/events/registrations/${reg.id}/refresh`, { method: 'POST' });
      if (r.registration.status === 'paid') { waiting.current = false; router.replace(`/events/ticket/${reg.id}`); } else load();
    } catch { /* try again next time */ }
  }, [d, load]);
  // back from the payment page (phone): see whether it went through
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active' && waiting.current) checkPaid(); });
    return () => sub.remove();
  }, [checkPaid]);

  const pay = async (reg) => {
    setBusy(true); setFormError(null);
    try {
      const out = await startPayment(reg);
      if (out === 'paid') router.replace(`/events/ticket/${reg.id}`);
      else if (out === 'opened') { waiting.current = true; setOpened(true); }
    } catch (e) { setFormError(e.message); load(); } finally { setBusy(false); }
  };

  const pickPhoto = async (camera) => {
    if (camera) { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) return notice('Camera needed', 'Allow the camera in Settings to take a photo of your ID, or pick one from your gallery.'); }
    const r = camera ? await ImagePicker.launchCameraAsync({ quality: 0.7 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setFile({ uri: a.uri, name: a.fileName || 'id.jpg', type: a.mimeType || 'image/jpeg', image: true });
  };
  const pickPdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if (a.size && a.size > 8 * 1024 * 1024) return notice('File too big', 'Use a file under 8 MB.');
    setFile({ uri: a.uri, name: a.name || 'id.pdf', type: a.mimeType || 'application/pdf', image: (a.mimeType || '').startsWith('image/') });
  };

  const register = async () => {
    setBusy(true); setFormError(null);
    try {
      const fields = { fullName: f.fullName.trim(), address: f.address.trim(), idType: f.idType };
      const r = file ? await uploadFile(`/events/${id}/register`, file, 'idProof', fields)
        : await api(`/events/${id}/register`, { method: 'POST', body: fields });
      setEditing(false); setFile(null);
      if (r.registration.status === 'paid') { router.replace(`/events/ticket/${r.registration.id}`); return; }
      setD((x) => ({ ...x, registration: r.registration }));
      if (r.payMode === 'off') { notice('Registered', "Your details are saved. Payments open very soon: we'll let you know, then come back here to pay."); load(); return; }
      setBusy(false);
      await pay(r.registration);
    } catch (e) { setFormError(e.message); } finally { setBusy(false); }
  };

  if (error && !d) return <Center><Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center' }}>{error}</Text><Button title="Try again" variant="secondary" small onPress={load} style={{ marginTop: space.md }} /></Center>;
  if (!d) return <Center><ActivityIndicator color={colors.aura} /></Center>;
  const e = d.event; const reg = d.registration; const k = kindOf(e.kind);
  const phone = d.prefill.phone;
  const showForm = e.open && (!reg || (reg.status === 'pending' && editing));
  const ready = f.fullName.trim().length >= 2 && f.address.trim().length >= 10 && f.idType && (file || reg?.hasIdProof) && agree && phone;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '' }} />
      <View style={{ aspectRatio: 1.9, backgroundColor: colors.deep }}>
        {e.coverUrl ? <Image source={{ uri: mediaUrl(e.coverUrl) }} style={{ flex: 1 }} contentFit="cover" />
          : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: `${k.color}22` }}><Ionicons name={k.icon} size={64} color={k.color} /></View>}
      </View>
      <View style={{ padding: space.xl }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: k.color }}>{k.label.toUpperCase()}{e.minAge ? ` · ${e.minAge}+ ONLY` : ''}</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, marginTop: 4 }}>{e.title}</Text>
        {e.tagline ? <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 6 }}>{e.tagline}</Text> : null}

        <View style={{ marginTop: space.lg, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
          <Row icon="calendar" title={dayText(e.startsAt)} text={`${timeText(e.startsAt)}${e.endsAt ? ` – ${timeText(e.endsAt)}` : ''} (IST)`} />
          <Row icon="location" title={e.venue} text={e.city} onPress={e.mapUrl ? () => Linking.openURL(e.mapUrl) : null} />
          <Row icon="ticket" title={rupees(e.price)} text={e.price ? 'Per person, GST included' : 'No ticket price'} last={!e.open} />
          {e.open ? <Row icon="people" title={`${e.seatsLeft} seats left`} text={`of ${e.capacity}`} last /> : null}
        </View>

        {e.description ? <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: colors.text, marginTop: space.lg }}>{e.description}</Text> : null}

        {/* where I stand */}
        {reg?.status === 'paid' ? (
          <Button title="Show my ticket" icon="qr-code" onPress={() => router.push(`/events/ticket/${reg.id}`)} style={{ marginTop: space.xl }} />
        ) : null}
        {e.status === 'cancelled' ? <Banner color={colors.danger} text="This event was cancelled. If you paid, the money is refunded to where it came from." /> : null}
        {!e.open && !reg && e.status !== 'cancelled' ? <Banner color={colors.muted} text={e.ended ? 'This event is over.' : e.soldOut ? 'Sold out. Check back: seats sometimes free up.' : 'Registrations are closed.'} /> : null}

        {reg?.status === 'pending' && !editing && e.open ? (
          <View style={{ marginTop: space.xl }}>
            <Banner color={colors.gold} text={`You're registered as ${reg.fullName}. Pay ${rupees(reg.amount)} to get your ticket.`} />
            {d.payMode === 'off' ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space.sm }}>Payments open very soon. We'll let you know.</Text> : null}
            {formError ? <ErrorText>{formError}</ErrorText> : null}
            <Button title={`Pay ${rupees(reg.amount)}`} icon="card" loading={busy} disabled={d.payMode === 'off'} onPress={() => pay(reg)} style={{ marginTop: space.md }} />
            {opened ? <Button title="I've paid: check now" variant="secondary" onPress={checkPaid} style={{ marginTop: space.sm }} /> : null}
            <Button title="Edit my details" variant="ghost" onPress={() => setEditing(true)} style={{ marginTop: space.xs }} />
          </View>
        ) : null}

        {showForm ? (
          <View style={{ marginTop: space.xl }}>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text, marginBottom: space.md }}>Register</Text>
            <Input label="Full name (as on your ID)" value={f.fullName} onChangeText={set('fullName')} maxLength={80} autoComplete="name" />
            <Input label="Phone" value={phone || ''} editable={false} hint={phone ? 'From your Soulink account' : undefined}
              error={phone ? undefined : 'Add a phone number to your account first (Settings › Sign-in)'} inputStyle={{ color: colors.muted }} />
            {!phone ? <Button title="Add phone number" variant="secondary" small onPress={() => router.push('/settings/sign-in')} style={{ marginTop: -space.sm, marginBottom: space.lg }} /> : null}
            <Input label="Address" value={f.address} onChangeText={set('address')} maxLength={400} multiline numberOfLines={3} placeholder="House no., street, area, city, PIN"
              inputStyle={{ minHeight: 72, textAlignVertical: 'top' }} autoComplete="street-address" />

            <Text style={ui.label}>Government ID</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md }}>
              {d.idTypes.map((t) => <Chip key={t.id} label={t.label} selected={f.idType === t.id} onPress={() => set('idType')(t.id)} />)}
            </View>
            {file || reg?.hasIdProof ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: `${colors.mint}66`, backgroundColor: 'rgba(66,232,192,0.08)', marginBottom: space.md }}>
                {file?.image ? <Image source={{ uri: file.uri }} style={{ width: 56, height: 40, borderRadius: 6 }} contentFit="cover" /> : <Ionicons name={file ? 'document-text' : 'checkmark-circle'} size={28} color={colors.mint} />}
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, marginLeft: space.md }}>{file ? file.name : 'ID uploaded'}</Text>
                <Pressable onPress={() => setFile(null)} hitSlop={10} disabled={!file}><Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: file ? colors.aura : colors.dim }}>{file ? 'Change' : ''}</Text></Pressable>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', marginBottom: space.md }}>
              <Button title="Camera" icon="camera" variant="secondary" small onPress={() => pickPhoto(true)} style={{ flex: 1, marginRight: 6 }} />
              <Button title="Photo" icon="image" variant="secondary" small onPress={() => pickPhoto(false)} style={{ flex: 1, marginRight: 6 }} />
              <Button title="PDF" icon="document" variant="secondary" small onPress={pickPdf} style={{ flex: 1 }} />
            </View>

            <Pressable onPress={() => setAgree(!agree)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.md }} accessibilityRole="checkbox" accessibilityState={{ checked: agree }}>
              <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={22} color={agree ? colors.soul : colors.muted} />
              <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginLeft: 8 }}>
                I agree that Soulink uses my address and ID only for entry and safety at this event. Only the event team can see them, and the ID is deleted 30 days after the event.
              </Text>
            </Pressable>
            {d.payMode === 'test' && e.price ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.gold, textAlign: 'center', marginBottom: space.sm }}>Test mode: no money is taken.</Text> : null}
            {formError ? <ErrorText>{formError}</ErrorText> : null}
            <Button title={e.price ? (d.payMode === 'off' ? 'Register' : `Register & pay ${rupees(e.price)}`) : 'Register (free)'} icon="arrow-forward" loading={busy} disabled={!ready} onPress={register} />
            {editing ? <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ marginTop: space.xs }} /> : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const Center = ({ children }) => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>{children}</View>;
const Banner = ({ color, text }) => (
  <View style={{ marginTop: space.lg, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: `${color}66`, backgroundColor: `${color}14` }}>
    <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color, textAlign: 'center' }}>{text}</Text>
  </View>
);
const Row = ({ icon, title, text, onPress, last }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,252,0.15)' }}><Ionicons name={icon} size={17} color={colors.aura} /></View>
    <View style={{ flex: 1, marginLeft: space.md }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text }}>{title}</Text>
      {text ? <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 1 }}>{text}</Text> : null}
    </View>
    {onPress ? <Ionicons name="navigate" size={16} color={colors.aura} /> : null}
  </Pressable>
);
