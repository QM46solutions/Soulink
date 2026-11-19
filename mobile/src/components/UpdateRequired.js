// Shown over the app only when this store version is older than the minimum the team set (console › Releases ›
// Update policy). It explains why and opens the official store listing. If the check fails (offline, server
// asleep), nothing is shown: a check that can't run never blocks anyone.
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkMinimumOnStart, installedVersion, openStore } from '../lib/appUpdate';
import { Button } from './ui';
import { colors, fonts, space } from '../lib/theme';

const STORE = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

export default function UpdateRequired() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { checkMinimumOnStart().then(setInfo).catch(() => {}); }, []);
  if (!info) return null;
  const go = async () => {
    setError(null);
    try { if (!(await openStore(info))) setError(`Soulink isn't on the ${STORE} yet.`); } catch { setError(`Open the ${STORE} and search for Soulink.`); }
  };
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: colors.void || '#08070d', justifyContent: 'center', padding: space.xl }}>
      <Ionicons name="arrow-up-circle" size={56} color={colors.aura} style={{ alignSelf: 'center' }} />
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, textAlign: 'center', marginTop: space.lg }}>Please update Soulink</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 14.5, color: colors.muted, textAlign: 'center', lineHeight: 22, marginTop: space.md }}>
        {`Version ${installedVersion} is no longer supported. Version ${info.latest} has important fixes, so please update to keep using Soulink. You stay logged in and nothing is lost.`}
        {info.message ? `\n\n${info.message}` : ''}
      </Text>
      <Button title="Update Now" icon="open-outline" onPress={go} style={{ marginTop: space.xl }} />
      {error ? <Text style={{ color: colors.gold, fontFamily: fonts.medium, textAlign: 'center', marginTop: space.md }}>{error}</Text> : null}
    </View>
  );
}
