import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { IntentChip } from '../components/Choice';
import { INTENTS } from '../lib/intents';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, getServer } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ErrorText, s } from '../components/ui';
import { confirm } from '../lib/confirm';
import { colors, space, fonts } from '../lib/theme';
import ActionSheet from '../components/ActionSheet';
import { CHAT_LANGS } from '../lib/languages';

function Toggle({ title, text, value, onChange, disabled }) {
  return (
    <View style={[s.row, { padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: disabled ? 0.5 : 1 }]}>
      <View style={{ flex: 1, marginRight: space.md }}>
        <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 15 }}>{title}</Text>
        {text ? <Text style={s.hint}>{text}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.soul, false: colors.border }} thumbColor="#fff" />
    </View>
  );
}

function Link({ icon, title, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, { padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: pressed ? colors.surface : 'transparent' }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.muted} style={{ marginRight: space.md }} />
      <Text style={{ fontFamily: fonts.body, color: danger ? colors.danger : colors.text, fontSize: 15, flex: 1 }}>{title}</Text>
      {!danger ? <Ionicons name="chevron-forward" size={18} color={colors.dim} /> : null}
    </Pressable>
  );
}

const Section = ({ children }) => <Text style={{ color: colors.dim, fontSize: 12, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.sm }}>{children}</Text>;

export default function Settings() {
  const { user, setUser, signOut } = useAuth();
  const [error, setError] = useState(null);
  const [langOpen, setLangOpen] = useState(false);
  const setChatLanguage = async (chatLanguage) => {
    try { setUser((await api('/users/me', { method: 'PATCH', body: { chatLanguage } })).user); } catch (e) { setError(e.message); }
  };

  const update = async (patch) => {
    setError(null);
    const prev = user;
    setUser({ ...user, settings: { ...user.settings, ...patch } }); // optimistic
    try { setUser((await api('/users/me', { method: 'PATCH', body: patch })).user); } catch (e) { setUser(prev); setError(e.message); }
  };

  const saveOpenTo = async (openTo) => {
    if (!openTo.length) { setError('Keep at least one option on.'); return; }
    setError(null);
    const prev = user;
    setUser({ ...user, openTo });
    try { setUser((await api('/connections/open-to', { method: 'PUT', body: { openTo } })).user); } catch (e) { setUser(prev); setError(e.message); }
  };

  return (
    <ScrollView style={s.screen}>
      <ErrorText>{error}</ErrorText>
      <Section>Privacy</Section>
      <Toggle title="Private account" text="Only approved followers see your posts and Soul Connections." value={user.settings.isPrivate} onChange={(v) => update({ isPrivate: v })} />
      <Toggle title="Show me in Discover" text="Let Soulink suggest you to people with a high Match %." value={user.settings.showInDiscover} onChange={(v) => update({ showInDiscover: v })} />
      <Toggle
        title="Discoverable by face"
        text={user.verified ? 'People who meet you can find your profile with a photo.' : 'Verify your face first.'}
        value={user.settings.faceDiscoverable}
        disabled={!user.verified}
        onChange={(v) => update({ faceDiscoverable: v })}
      />
      <Toggle title="Use my activity for Soul DNA" text="Searches, likes and time spent on profiles help improve your matches. Never shared with anyone." value={user.settings.consentTracking} onChange={(v) => update({ consentTracking: v })} />
      <Section>Open to</Section>
      <Text style={[s.hint, { paddingHorizontal: space.lg, marginTop: 0 }]}>Which Connect requests people can send you. Turn off anything you don't want.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.lg - 4, paddingTop: space.sm }}>
        {INTENTS.map((i) => {
          const on = (user.openTo || []).includes(i.key);
          return <IntentChip key={i.key} intent={i} selected={on} onPress={() => saveOpenTo(on ? user.openTo.filter((k) => k !== i.key) : [...(user.openTo || []), i.key])} />;
        })}
      </View>
      <Link icon="sparkles-outline" title="Soul Requests" onPress={() => router.push('/connections/requests')} />
      <Link icon="language-outline" title={`Chat translation: ${user.chatLanguage ? CHAT_LANGS.find((l) => l.key === user.chatLanguage)?.native : 'Off'}`} onPress={() => setLangOpen(true)} />
      <ActionSheet visible={langOpen} onClose={() => setLangOpen(false)} title="Translate chat messages into"
        options={CHAT_LANGS.map((l) => ({ label: `${l.native}${l.native !== l.label ? `  ·  ${l.label}` : ''}${user.chatLanguage === l.key ? '  ✓' : ''}`, onPress: () => setChatLanguage(l.key) }))} />
      <Link icon="person-add-outline" title="Follow requests" onPress={() => router.push('/requests')} />
      <Link icon="ban-outline" title="Blocked accounts" onPress={() => router.push('/blocked')} />

      <Section>Account</Section>
      <Link icon="create-outline" title="Edit profile" onPress={() => router.push('/edit-profile')} />
      <View style={{ padding: space.lg }}>
        <Text style={s.hint}>Signed in as {user.phone || user.email}</Text>
        <Text style={s.hint}>Server: {getServer()}</Text>
      </View>
      <Link icon="log-out-outline" title="Log out" danger onPress={async () => { if (await confirm('Log out?', undefined, { confirmText: 'Log out', destructive: true })) signOut(); }} />
    </ScrollView>
  );
}
