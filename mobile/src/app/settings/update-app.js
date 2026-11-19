// Settings › Update App: is there a newer Soulink? Checks two things when it opens (and on "Check again"):
//  - an over-the-air update for this version (downloads here, then restarts with your login kept), and
//  - a newer store version (Google Play / App Store; opens the official listing, the store does the install).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { applyOtaUpdate, checkOtaUpdate, checkStoreVersion, downloadOtaUpdate, installedVersion, isStoreApp, openStore } from '../../lib/appUpdate';
import { build } from '../../lib/telemetry';
import { Button, ErrorText, s } from '../../components/ui';
import { InfoRow, Note, Section } from '../../components/SettingsUI';
import { colors, fonts, space } from '../../lib/theme';

const STORE = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

function Banner({ icon, color, title, text }) {
  return (
    <View style={{ marginHorizontal: space.lg, marginTop: space.lg, padding: space.lg, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(26,24,40,0.7)', flexDirection: 'row' }}>
      <Ionicons name={icon} size={26} color={color} style={{ marginRight: space.md, marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: colors.text, lineHeight: 22 }}>{title}</Text>
        {text ? <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.muted, lineHeight: 20, marginTop: 4 }}>{text}</Text> : null}
      </View>
    </View>
  );
}

export default function UpdateApp() {
  const [state, setState] = useState('checking'); // checking | latest | store | ota | downloading | ready | error | web
  const [store, setStore] = useState(null);
  const [error, setError] = useState(null);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return; // one check at a time
    busy.current = true; setError(null); setState('checking');
    try {
      if (!isStoreApp) { setState('web'); return; }
      // the store version first: an older store version needs the store, whatever over-the-air has
      const st = await checkStoreVersion();
      setStore(st);
      if (st.status === 'available') { setState('store'); return; }
      const ota = await checkOtaUpdate().catch(() => ({ available: false }));
      setState(ota.available ? 'ota' : 'latest');
    } catch { setState('error'); } finally { busy.current = false; }
  }, []);
  useEffect(() => { check(); }, [check]);

  const getOta = async () => {
    if (busy.current) return;
    busy.current = true; setError(null); setState('downloading');
    try { setState((await downloadOtaUpdate()) ? 'ready' : 'latest'); }
    catch { setState('ota'); setError("The download didn't finish. Check your connection and try again."); }
    finally { busy.current = false; }
  };
  const restart = async () => {
    try { await applyOtaUpdate(); } catch { setError("Couldn't restart. Close Soulink and open it again to use the update."); }
  };
  const goStore = async () => {
    setError(null);
    try { if (!(await openStore(store))) setError(`Soulink isn't on the ${STORE} yet. We'll let you know when it is.`); }
    catch { setError(`Couldn't open the ${STORE}. Open it yourself and search for Soulink.`); }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 60 }}>
      <Section>This phone</Section>
      <InfoRow icon="phone-portrait" title="Installed version" value={installedVersion} />
      {build && build !== 'store' ? <InfoRow icon="git-branch" title="Latest app code" value={build.replace('ota-', '')} /> : null}

      {state === 'checking' ? (
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <ActivityIndicator color={colors.aura} />
          <Text style={{ fontFamily: fonts.medium, color: colors.muted, marginTop: space.md }}>Checking for updates…</Text>
        </View>
      ) : null}

      {state === 'latest' ? <Banner icon="checkmark-circle" color={colors.mint} title="You are using the latest version of Soulink." /> : null}
      {state === 'web' ? <Banner icon="globe-outline" color={colors.aura} title="You are using the latest version of Soulink." text="The web version always opens the newest Soulink. Updates for the phone app come from Google Play and the App Store." /> : null}
      {state === 'error' ? <Banner icon="cloud-offline" color={colors.gold} title="Unable to check for updates. Please try again." /> : null}

      {state === 'store' ? (
        <>
          <Banner icon="arrow-up-circle" color={colors.aura} title="A new version of Soulink is available."
            text={`Version ${store?.latest} is on ${STORE}. You have ${installedVersion}.${store?.belowMinimum ? ' This version is no longer supported, so please update to keep using Soulink.' : ''}${store?.message ? `\n\n${store.message}` : ''}`} />
          <View style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
            <Button title="Update Now" icon="open-outline" onPress={goStore} />
          </View>
          <Note>{STORE} downloads and installs the update. You stay logged in, and your settings and data are kept.</Note>
        </>
      ) : null}

      {state === 'ota' || state === 'downloading' ? (
        <>
          <Banner icon="sparkles" color={colors.aura} title="A new version of Soulink is available." text="New screens and fixes for your version. It downloads in the background while you keep using Soulink." />
          <View style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
            <Button title={state === 'downloading' ? 'Downloading…' : 'Update Now'} icon="download-outline" onPress={getOta} loading={state === 'downloading'} disabled={state === 'downloading'} />
          </View>
        </>
      ) : null}

      {state === 'ready' ? (
        <>
          <Banner icon="refresh-circle" color={colors.mint} title="Update ready" text="Restart Soulink to start using it. You stay logged in." />
          <View style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
            <Button title="Restart now" icon="refresh" onPress={restart} />
          </View>
          <Note>Not now? It's used automatically the next time you open Soulink.</Note>
        </>
      ) : null}

      <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
        <ErrorText>{error}</ErrorText>
        {['latest', 'error', 'store', 'ota'].includes(state) ? <Button title="Check again" variant="ghost" icon="reload" onPress={check} style={{ marginTop: space.sm }} /> : null}
      </View>
    </ScrollView>
  );
}
