// "Create your soul profile" — shown once, right after a new account's code is verified.
// Four short steps:  1 Face ID  →  2 Who are you  →  3 About you  →  4 Your vibe
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, uploadImage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BrandHeader, BrandScreen } from '../components/BrandScreen';
import { AuraAvatar } from '../components/ProfileHeader';
import FaceScan from '../components/FaceScan';
import CityField from '../components/CityField';
import ProfessionField from '../components/ProfessionField';
import { Button, Chip, ErrorText, Input, s } from '../components/ui';
import { colors, fonts, gradients, space } from '../lib/theme';
import { usePhotoPicker } from '../components/PhotoPicker';
import { TERMS_VERSION } from '../lib/legal';

const GENDERS = [
  { v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }, { v: 'non_binary', l: 'Non-binary' }, { v: 'prefer_not', l: 'Prefer not to say' },
];
const INTERESTS = ['Music', 'Movies', 'Cricket', 'Fitness', 'Travel', 'Food', 'Gaming', 'Books', 'Tech', 'Art', 'Fashion', 'Photography', 'Spirituality', 'Startups', 'Dance'];
const STEPS = [
  { title: 'Face ID', sub: "Soulink is only for real people. A quick scan proves you're one." },
  { title: 'Who are you?', sub: 'Your photo and name are how friends find you.' },
  { title: 'A little about you', sub: 'Your birthday stays private (only your age is used). Tell people what you do.' },
  { title: 'Your vibe', sub: 'Pick what you love. It helps us find your people.' },
];

const maxDob = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d; };
const pad = (n) => String(n).padStart(2, '0');
// Local date → YYYY-MM-DD (toISOString would shift the day in India's timezone)
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ageOf = (isoDate) => { const b = new Date(`${isoDate}T00:00:00`); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a -= 1; return a; };
/** "25081995" typed → "25 / 08 / 1995" shown, "1995-08-25" stored */
const maskDob = (t) => { const d = t.replace(/\D/g, '').slice(0, 8); return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join(' / '); };
const dobToIso = (m) => { const d = m.replace(/\D/g, ''); if (d.length !== 8) return null; const v = `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`; const dt = new Date(`${v}T00:00:00`); return Number.isNaN(dt.getTime()) || iso(dt) !== v ? null : v; };
/** "Sai Raghava" → "sai.raghava" */
const suggestUsername = (name) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '.').slice(0, 30);

function Progress({ step }) {
  return (
    <View style={{ flexDirection: 'row', flex: 1, marginHorizontal: space.md }}>
      {STEPS.map((_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, marginHorizontal: 3, overflow: 'hidden', backgroundColor: colors.border }}>
          {i <= step ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

export default function Setup() {
  const { user, setUser, signOut } = useAuth();
  const [step, setStep] = useState(user?.verified ? 1 : 0);
  const [avatarUri, setAvatarUri] = useState(null);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [uStatus, setUStatus] = useState(null);
  const [dobText, setDobText] = useState('');
  const [birthDate, setBirthDate] = useState(null);
  const [showDate, setShowDate] = useState(false);
  const [gender, setGender] = useState(null);
  const [city, setCity] = useState('');
  const [profession, setProfession] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [interests, setInterests] = useState([]);
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const debounce = useRef(null);

  // Username follows the name until the person edits it themselves
  useEffect(() => { if (!usernameTouched) setUsername(suggestUsername(displayName)); }, [displayName, usernameTouched]);

  useEffect(() => {
    clearTimeout(debounce.current);
    const u = username.trim();
    if (u.length < 3) { setUStatus(null); return undefined; }
    debounce.current = setTimeout(async () => {
      try { setUStatus(await api(`/users/username-available?u=${encodeURIComponent(u)}`)); } catch { setUStatus(null); }
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [username]);

  const photo = usePhotoPicker({ onPicked: setAvatarUri, onRemove: () => setAvatarUri(null), onError: setError, hasPhoto: !!avatarUri });

  const age = birthDate ? ageOf(birthDate) : null;
  const dobError = dobText.replace(/\D/g, '').length === 8 && !birthDate ? 'Enter a real date (DD / MM / YYYY)' : age !== null && age < 18 ? 'You must be 18 or older to join Soulink' : null;
  const canNext = [
    !!user?.verified,
    displayName.trim() && username.length >= 3 && uStatus?.available !== false,
    birthDate && age >= 18 && profession.trim().length >= 2,
    true,
  ][step];

  const finish = async () => {
    setError(null); setBusy(true);
    try {
      await api('/users/me/complete-onboarding', {
        method: 'POST',
        body: { username, displayName: displayName.trim(), birthDate, gender, city: city.trim() || null, profession: profession.trim(), isCreator, bio: bio.trim(), interests, isPrivate, acceptTerms: true, termsVersion: TERMS_VERSION },
      });
      let me = (await api('/users/me')).user;
      if (avatarUri) me = (await uploadImage('/users/me/avatar', avatarUri)).user;
      setUser(me); // onboarding done → app opens Home
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const next = () => { setError(null); if (step < STEPS.length - 1) setStep(step + 1); else finish(); };
  const back = () => { setError(null); if (step > 0) setStep(step - 1); else signOut(); };

  return (
    <BrandScreen back onBack={back} right={<><Progress step={step} /><Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, width: 36, textAlign: 'right' }}>{step + 1}/{STEPS.length}</Text></>}>
      <BrandHeader size={36} title={STEPS[step].title} subtitle={STEPS[step].sub} />

      {step === 0 ? (
        <FaceScan
          alreadyVerified={!!user?.verified}
          onVerified={(me) => { setUser(me); setTimeout(() => setStep(1), 1400); }}
        />
      ) : null}

      {step === 1 ? (
        <View>
          <Pressable onPress={photo.open} style={{ alignSelf: 'center', alignItems: 'center', marginBottom: space.xl }} accessibilityLabel="Add a profile photo">
            <AuraAvatar size={104} user={{ avatarUrl: avatarUri || user?.avatarUrl, displayName: displayName || '?' }} />
            <View style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.spark, borderRadius: 16, padding: 7, borderWidth: 2, borderColor: colors.void }}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <Text onPress={photo.open} style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13, textAlign: 'center', marginTop: -space.md, marginBottom: space.lg }}>{avatarUri ? 'Change profile photo' : 'Add your profile photo'}</Text>
          {photo.sheet}
          <Input label="Your name" value={displayName} onChangeText={setDisplayName} maxLength={50} placeholder="e.g. Sai Raghava" autoFocus />
          <Input
            label="Username"
            value={username}
            onChangeText={(t) => { setUsernameTouched(true); setUsername(t.toLowerCase().replace(/[^a-z0-9._]/g, '')); }}
            autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder="sai.raghava"
            left={<Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 16, marginRight: 2 }}>@</Text>}
            right={uStatus?.available ? <Ionicons name="checkmark-circle" size={20} color={colors.mint} /> : null}
            error={uStatus && !uStatus.available ? uStatus.reason : null}
            hint={uStatus?.available ? 'Available' : 'Letters, numbers, dot and underscore'}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text style={s.label}>Date of birth</Text>
          {Platform.OS === 'web' ? (
            <View style={[s.inputWrap, dobError && { borderColor: colors.danger }]}>
              <TextInput
                style={s.input} value={dobText} placeholder="DD / MM / YYYY" placeholderTextColor={colors.dim}
                keyboardType="number-pad" maxLength={14} autoFocus
                onChangeText={(t) => { const m = maskDob(t); setDobText(m); setBirthDate(dobToIso(m)); }}
              />
              {age !== null && age >= 18 ? <Text style={{ color: colors.mint, fontFamily: fonts.semibold, fontSize: 13 }}>{age} yrs</Text> : null}
            </View>
          ) : (
            <Pressable onPress={() => setShowDate(true)} style={s.inputWrap}>
              <Text style={{ flex: 1, fontFamily: fonts.medium, color: birthDate ? colors.text : colors.dim, fontSize: 16 }}>
                {birthDate ? birthDate.split('-').reverse().join(' / ') : 'DD / MM / YYYY'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={colors.muted} />
            </Pressable>
          )}
          {dobError ? <Text style={s.error}>{dobError}</Text> : <Text style={s.hint}>You must be 18 or older.</Text>}
          {showDate && Platform.OS !== 'web' ? (
            <DateTimePicker
              value={birthDate ? new Date(`${birthDate}T00:00:00`) : maxDob()} mode="date" maximumDate={maxDob()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(e, d) => { setShowDate(Platform.OS === 'ios'); if (d && e.type !== 'dismissed') { setBirthDate(iso(d)); setDobText(iso(d).split('-').reverse().join(' / ')); } }}
            />
          ) : null}

          <Text style={[s.label, { marginTop: space.xl }]}>Gender (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: space.lg }}>
            {GENDERS.map((g) => <Chip key={g.v} label={g.l} selected={gender === g.v} onPress={() => setGender(gender === g.v ? null : g.v)} />)}
          </View>

          <CityField value={city} onChange={setCity} />
          <View style={{ marginTop: space.lg }}><ProfessionField required value={profession} onChange={setProfession} creator={isCreator} onCreator={setIsCreator} /></View>
        </View>
      ) : null}

      {step === 3 ? (
        <View>
          <Text style={s.label}>Interests {interests.length ? `· ${interests.length}` : ''}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: space.lg }}>
            {INTERESTS.map((i) => (
              <Chip key={i} label={i} selected={interests.includes(i)}
                onPress={() => setInterests((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))} />
            ))}
          </View>
          <Input label="Bio (optional)" value={bio} onChangeText={setBio} placeholder="A line about you" multiline maxLength={300} hint={`${bio.length}/300`} />
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, padding: space.lg, borderRadius: 20, marginBottom: space.md }}>
            <Ionicons name={isPrivate ? 'lock-closed' : 'earth'} size={20} color={colors.aura} style={{ marginRight: space.md }} />
            <View style={{ flex: 1, marginRight: space.md }}>
              <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>{isPrivate ? 'Private account' : 'Public account'}</Text>
              <Text style={[s.hint, { marginLeft: 0 }]}>{isPrivate ? 'Only people you approve see your posts.' : 'Anyone on Soulink can see your posts.'}</Text>
            </View>
            <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: colors.soul, false: colors.border }} thumbColor="#fff" />
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: space.lg }}>
        <ErrorText>{error}</ErrorText>
        {step > 0 || user?.verified ? (
          <Button title={step < STEPS.length - 1 ? 'Continue' : 'Create my profile'} onPress={next} loading={busy} disabled={!canNext} />
        ) : null}
        {step === 3 && !interests.length && !bio ? (
          <Text style={[s.hint, { textAlign: 'center', marginLeft: 0 }]}>You can skip these and add them later.</Text>
        ) : null}
      </View>
    </BrandScreen>
  );
}
