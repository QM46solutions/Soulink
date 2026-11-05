// Phone app: when Soulink opens, check Expo for newer app code. If there is some and it arrives within the
// first few seconds, restart into it right away (on the splash/first screen, before you've started doing
// anything), so you never need to close and reopen the app twice to see the latest version. A slower download
// is kept and used the next time the app opens.
import { useEffect } from 'react';
import * as Updates from 'expo-updates';

const QUICK_MS = 8000;

export function useAppUpdate() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const opened = Date.now();
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        const got = await Updates.fetchUpdateAsync();
        if (got.isNew && Date.now() - opened < QUICK_MS) await Updates.reloadAsync();
      } catch { /* offline: try next time */ }
    })();
  }, []);
}
