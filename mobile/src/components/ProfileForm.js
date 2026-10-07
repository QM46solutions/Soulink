import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { colors, space, fonts } from '../lib/theme';
import { Button, Chip, ErrorText, Input, s } from './ui';
import { AuraAvatar } from './ProfileHeader';
import CityField from './CityField';
import ProfessionField from './ProfessionField';
import { usePhotoPicker } from './PhotoPicker';
import { LANGUAGES } from '../lib/filters';

const GENDERS = [
  { v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }, { v: 'non_binary', l: 'Non-binary' }, { v: 'prefer_not', l: 'Prefer not to say' },
];
const INTERESTS = ['Music', 'Movies', 'Cricket', 'Fitness', 'Travel', 'Food', 'Gaming', 'Books', 'Tech', 'Art', 'Fashion', 'Photography', 'Spirituality', 'Startups', 'Dance'];

const fmt = (d) => d.toISOString().slice(0, 10);
const maxDob = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d; };

/**
 * Shared by first-time setup and Edit profile.
 * onSubmit({ fields, avatarUri }) should save and throw on error.
 */
export default function ProfileForm({ initial = {}, submitLabel, onSubmit, requireAll }) {
  const [avatarUri, setAvatarUri] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [username, setUsername] = useState(initial.username || '');
  const [displayName, setDisplayName] = useState(initial.displayName || '');
  const [birthDate, setBirthDate] = useState(initial.birthDate || null);
  const [showDate, setShowDate] = useState(false);
  const [gender, setGender] = useState(initial.gender || null);
  const [city, setCity] = useState(initial.city || '');
  const [bio, setBio] = useState(initial.bio || '');
  const [interests, setInterests] = useState(initial.interests || []);
  const [college, setCollege] = useState(initial.college || '');
  const [company, setCompany] = useState(initial.company || '');
  const [profession, setProfession] = useState(initial.profession || '');
  const [isCreator, setIsCreator] = useState(!!initial.isCreator);
  const [languages, setLanguages] = useState(initial.languages || []);
  const [isPrivate, setIsPrivate] = useState(!!initial.settings?.isPrivate);
  const [uStatus, setUStatus] = useState(null); // {available, reason}
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    clearTimeout(debounce.current);
    const u = username.trim().toLowerCase();
    if (!u || u === initial.username) { setUStatus(null); return; }
    debounce.current = setTimeout(async () => {
      try { setUStatus(await api(`/users/username-available?u=${encodeURIComponent(u)}`)); } catch { setUStatus(null); }
    }, 400);
    return () => clearTimeout(debounce.current);
  }, [username, initial.username]);

  const photo = usePhotoPicker({
    onPicked: (uri) => { setAvatarUri(uri); setRemoveAvatar(false); },
    onRemove: () => { setAvatarUri(null); setRemoveAvatar(true); },
    onError: setError,
    hasPhoto: !!avatarUri || (!!initial.avatarUrl && !removeAvatar),
  });

  const toggleInterest = (i) =>
    setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length >= 15 ? cur : [...cur, i]));

  const canSubmit = username.trim().length >= 3 && displayName.trim() && (!requireAll || birthDate) && uStatus?.available !== false;

  const submit = async () => {
    setError(null); setBusy(true);
    try {
      await onSubmit({
        fields: {
          username: username.trim().toLowerCase(),
          displayName: displayName.trim(),
          ...(birthDate ? { birthDate } : {}),
          gender,
          city: city.trim() || null,
          bio: bio.trim(),
          interests,
          college: college.trim() || null,
          company: company.trim() || null,
          profession: profession.trim() || null,
          isCreator,
          languages,
          isPrivate,
        },
        avatarUri,
        removeAvatar,
      });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.xl, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={photo.open} style={{ alignSelf: 'center', marginBottom: space.sm }} accessibilityLabel="Change profile photo">
        <AuraAvatar size={104} user={{ avatarUrl: avatarUri || (removeAvatar ? null : initial.avatarUrl), displayName: displayName || username || '?' }} />
        <View style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.spark, borderRadius: 14, padding: 6, borderWidth: 2, borderColor: colors.void }}>
          <Ionicons name="camera" size={16} color="#fff" />
        </View>
      </Pressable>
      <Text onPress={photo.open} style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13, textAlign: 'center', marginBottom: space.xl }}>Change profile photo</Text>
      {photo.sheet}

      <Input
        label="Username"
        value={username}
        onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={30}
        placeholder="e.g. sai.raghava"
        error={uStatus && !uStatus.available ? uStatus.reason : null}
        hint={uStatus?.available ? '✓ Available' : 'Letters, numbers, dot and underscore'}
      />
      <Input label="Name" value={displayName} onChangeText={setDisplayName} maxLength={50} placeholder="Your name" />

      <Text style={s.label}>Date of birth{requireAll ? '' : ' (private)'}</Text>
      {Platform.OS === 'web' ? (
        // Browser testing: the native date picker isn't available, so type the date
        <View style={[s.inputWrap, { marginBottom: 6 }]}>
          <TextInput
            style={s.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.dim}
            defaultValue={birthDate || ''}
            onChangeText={(t) => setBirthDate(/^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null)}
            maxLength={10}
          />
        </View>
      ) : (
        <Pressable onPress={() => setShowDate(true)} style={[s.inputWrap, { minHeight: 48, marginBottom: 6 }]}>
          <Text style={{ fontFamily: fonts.body, color: birthDate ? colors.text : colors.dim, fontSize: 16 }}>{birthDate || 'Select date'}</Text>
        </Pressable>
      )}
      <Text style={[s.hint, { marginTop: 0, marginBottom: space.lg }]}>You must be 18+. Only your age is used for matching; your birthday isn't shown.</Text>
      {showDate && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={birthDate ? new Date(`${birthDate}T00:00:00`) : maxDob()}
          mode="date"
          maximumDate={maxDob()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, d) => { setShowDate(Platform.OS === 'ios'); if (d && e.type !== 'dismissed') setBirthDate(fmt(d)); }}
        />
      ) : null}

      <Text style={s.label}>Gender (optional)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg }}>
        {GENDERS.map((g) => <Chip key={g.v} label={g.l} selected={gender === g.v} onPress={() => setGender(gender === g.v ? null : g.v)} />)}
      </View>

      <ProfessionField value={profession} onChange={setProfession} creator={isCreator} onCreator={setIsCreator} />
      <CityField value={city} onChange={setCity} autoLocate={false} />
      <Input label="Bio" value={bio} onChangeText={setBio} placeholder="A little about you" multiline maxLength={300} hint={`${bio.length}/300`} />

      <Text style={s.label}>Interests</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg }}>
        {INTERESTS.map((i) => <Chip key={i} label={i} selected={interests.includes(i)} onPress={() => toggleInterest(i)} />)}
      </View>

      <Input label="College (optional)" value={college} onChangeText={setCollege} maxLength={120} placeholder="e.g. JNTU Hyderabad" hint="Lets people from your college find you" />
      <Input label="Company (optional)" value={company} onChangeText={setCompany} maxLength={120} placeholder="e.g. Infosys" hint="Lets colleagues find you" />
      <Text style={s.label}>Languages you speak</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg }}>
        {LANGUAGES.map((l) => <Chip key={l} label={l} selected={languages.includes(l)} onPress={() => setLanguages((c) => (c.includes(l) ? c.filter((x) => x !== l) : [...c, l]))} />)}
      </View>

      <View style={[s.row, { justifyContent: 'space-between', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, padding: space.lg, borderRadius: 16, marginBottom: space.xl }]}>
        <View style={{ flex: 1, marginRight: space.md }}>
          <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>Private account</Text>
          <Text style={s.hint}>Only people you approve can see your posts and Connections.</Text>
        </View>
        <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: colors.soul, false: colors.border }} thumbColor="#fff" />
      </View>

      <ErrorText>{error}</ErrorText>
      <Button title={submitLabel} onPress={submit} loading={busy} disabled={!canSubmit} />
    </ScrollView>
  );
}
