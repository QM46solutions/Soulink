// Settings > Notifications: switch phone notifications on/off, and choose which kinds reach you.
import { useEffect, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirm, notice } from '../../lib/confirm';
import { disablePush, enablePush, pushEnabled, pushSupport, sendTestPush, setPushChoice } from '../../lib/push';
import { MenuRow, Note, Section, Toggle } from '../../components/SettingsUI';
import { ErrorText, s } from '../../components/ui';
import { feedbackPrefs, setFeedbackPrefs } from '../../lib/feedback';

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
  const [fx, setFx] = useState(feedbackPrefs()); // sounds & vibration (this phone only)
  useEffect(() => { pushEnabled().then(setPhoneOn); }, []);

  const togglePhone = async (on) => {
    setBusy(true); setError(null);
    try {
      if (on) { await enablePush(); await setPushChoice('allowed'); setPhoneOn(true); await sendTestPush().catch(() => {}); }
      else { await disablePush(); await setPushChoice('later'); setPhoneOn(false); }
    } catch (e) {
      setPhoneOn(await pushEnabled());
      if (e.code === 'blocked') {
        if (await confirm('Notifications are off', e.message, { confirmText: 'Open phone settings', cancelText: 'Not now' })) Linking.openSettings().catch(() => {});
      } else notice("Couldn't turn on notifications", e.message || String(e));
    }
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
    : support === 'unsupported' ? "This phone can't get notifications from this version of the app."
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
      <Section>Sounds & vibration</Section>
      <Toggle title="Sounds" text="A short sound when you Connect, like, comment or share" value={fx.sound} onChange={(v) => { setFx({ ...fx, sound: v }); setFeedbackPrefs({ sound: v }); }} />
      <Toggle title="Vibration" text="A light buzz for the same actions" value={fx.vibrate} onChange={(v) => { setFx({ ...fx, vibrate: v }); setFeedbackPrefs({ vibrate: v }); }} />
      <Note>Sounds and vibration are set for this phone only.</Note>
    </ScrollView>
  );
}
