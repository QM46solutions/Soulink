// Settings > Device permissions: what this phone lets Soulink use. Tap Allow to ask; if blocked, change it in phone settings.
import { useCallback, useState } from 'react';
import { Linking, Platform, ScrollView } from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { InfoRow, Note, Section } from '../../components/SettingsUI';
import { Button, s } from '../../components/ui';
import { colors } from '../../lib/theme';
import { currentPosition } from '../../lib/location';

const WEB = Platform.OS === 'web' && typeof navigator !== 'undefined';
// Phone app: the phone's own permission state (the browser checks below don't exist on Android / iPhone)
const NATIVE = {
  camera: [() => Camera.getCameraPermissionsAsync(), () => Camera.requestCameraPermissionsAsync()],
  microphone: [() => Camera.getMicrophonePermissionsAsync(), () => Camera.requestMicrophonePermissionsAsync()],
  geolocation: [() => Location.getForegroundPermissionsAsync(), () => Location.requestForegroundPermissionsAsync()],
  notifications: [() => Notifications.getPermissionsAsync(), null],
};
const stateOf = (r) => (r?.status === 'granted' ? 'granted' : r?.status === 'denied' ? 'denied' : 'prompt');
async function query(name) {
  if (!WEB) { try { return stateOf(await NATIVE[name][0]()); } catch { return 'unknown'; } }
  try {
    if (name === 'notifications' && typeof Notification !== 'undefined') return Notification.permission === 'default' ? 'prompt' : Notification.permission;
    if (!WEB || !navigator.permissions?.query) return 'unknown';
    return (await navigator.permissions.query({ name })).state; // granted | denied | prompt
  } catch { return 'unknown'; }
}
const LABEL = { granted: ['Allowed', colors.mint], denied: ['Blocked', colors.danger], prompt: ['Not asked yet', colors.gold], unknown: ['Asked when needed', colors.muted] };

export default function DevicePermissions() {
  const [st, setSt] = useState({});
  const refresh = useCallback(async () => {
    const names = ['camera', 'microphone', 'geolocation', 'notifications'];
    setSt(Object.fromEntries(await Promise.all(names.map(async (n) => [n, await query(n)]))));
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const media = async (kind) => {
    if (!WEB) {
      // ask the phone; once it was refused for good, only the phone's Settings can allow it
      try {
        const r = await NATIVE[kind][1]();
        if (r.status !== 'granted' && !r.canAskAgain) await Linking.openSettings();
      } catch { /* not available */ }
      refresh();
      return;
    }
    try { const stream = await navigator.mediaDevices.getUserMedia(kind === 'camera' ? { video: true } : { audio: true }); stream.getTracks().forEach((t) => t.stop()); } catch { /* denied */ }
    refresh();
  };
  const row = (name, icon, title, ask) => {
    const [label, color] = LABEL[st[name] || 'unknown'];
    return <InfoRow key={name} icon={icon} title={title} value={label} color={color}
      action={st[name] !== 'granted' && ask ? <Button small variant="ghost" title="Allow" onPress={ask} style={{ marginLeft: 6 }} /> : null} />;
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Section>This phone lets Soulink use</Section>
      {row('camera', 'camera', 'Camera', () => media('camera'))}
      {row('microphone', 'mic', 'Microphone', () => media('microphone'))}
      <InfoRow icon="images" title="Photos" value="You choose each time" color={colors.muted} />
      {row('geolocation', 'location', 'Location', () => (WEB ? currentPosition().catch(() => {}).finally(refresh) : media('geolocation')))}
      {row('notifications', 'notifications', 'Notifications', () => router.push('/settings/notifications'))}
      {!WEB ? <Button variant="ghost" title="Open phone settings for Soulink" onPress={() => Linking.openSettings().catch(() => {})} style={{ marginHorizontal: 16, marginTop: 12 }} /> : null}
      <Note>Camera is used for Face ID, selfies and photos; microphone for voice notes and the voice translator. If something says Blocked, tap “Open phone settings for Soulink” (in a browser: Safari or Chrome › Site settings) and allow it, then come back.</Note>
    </ScrollView>
  );
}
