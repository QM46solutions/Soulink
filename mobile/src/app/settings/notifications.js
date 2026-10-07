// Settings > Notifications: switch phone notifications on/off, and choose which kinds reach you.
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { notice } from '../../lib/confirm';
import { disablePush, enablePush, pushEnabled, pushSupport, sendTestPush } from '../../lib/push';
import { MenuRow, Note, Section, Toggle } from '../../components/SettingsUI';
import { ErrorText, s } from '../../components/ui';

const KINDS = [
  ['messages', 'Messages', 'New chat messages'],
  ['requests', 'Requests & connections', 'Connect requests, accepts and connect backs'],
  ['likes', 'Likes 👌🏻', 'When someone likes your post'],
  ['comments', 'Comments', 'When someone comments on your post'],
  ['anonymous', 'Anonymous messages', 'Secret messages and reveals'],
  ['argue', 'Argue', 'Invites and verdicts'],
  ['events', 'Soulink Events', 'When events launch near you'],
];

export default function NotificationSettings() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState(null);
  const [phoneOn, setPhoneOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const support = pushSupport();
  useEffect(() => { pushEnabled().then(setPhoneOn); }, []);

  const togglePhone = async (on) => {
    setBusy(true); setError(null);
    try {
      if (on) { await enablePush(); setPhoneOn(true); await sendTestPush().catch(() => {}); }
      else { await disablePush(); setPhoneOn(false); }
    } catch (e) { notice("Couldn't turn on notifications", e.message || String(e)); setPhoneOn(await pushEnabled()); }
    finally { setBusy(false); }
  };
  const prefs = user.settings.notifyPrefs || {};
  const setPref = async (k, v) => {
    const prev = user;
    setUser({ ...user, settings: { ...user.settings, notifyPrefs: { ...prefs, [k]: v } } });
    try { setUser((await api('/users/me', { method: 'PATCH', body: { notifyPrefs: { [k]: v } } })).user); } catch (e) { setUser(prev); setError(e.message); }
  };
  const hint = phoneOn ? 'This phone gets Soulink notifications, even when the app is closed.'
    : support === 'needs_home_screen' ? 'iPhone: in Safari tap Share › Add to Home Screen, open Soulink from that icon, then switch this on.'
    : support === 'blocked' ? 'Blocked in your phone settings. Allow notifications for Soulink there first.'
    : support === 'unsupported' ? "This browser can't show notifications."
    : 'Get alerts when something happens, even when Soulink is closed.';

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <ErrorText>{error}</ErrorText>
      <Section>This phone</Section>
      <Toggle title="Notifications on this phone" text={hint} value={phoneOn} disabled={busy} onChange={togglePhone} />
      {phoneOn ? <MenuRow icon="notifications-outline" title="Send me a test notification" onPress={() => sendTestPush().then(() => notice('Sent', 'Lock your phone or switch apps: it should arrive in a few seconds.')).catch((e) => setError(e.message))} /> : null}
      <Section>Notify me about</Section>
      {KINDS.map(([k, title, text]) => <Toggle key={k} title={title} text={text} value={prefs[k] !== false} onChange={(v) => setPref(k, v)} />)}
      <Note>These choices apply to every phone you're signed in on. You'll still see everything in the Notifications tab inside Soulink.</Note>
    </ScrollView>
  );
}
