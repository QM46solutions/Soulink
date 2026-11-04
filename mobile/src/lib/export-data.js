// Settings › Download my data: fetch everything the server holds about you and save it as a JSON file.
import { Platform, Share } from 'react-native';
import { api } from './api';
import { notice } from './confirm';

export async function downloadMyData() {
  try {
    const data = await api('/users/me/export', { timeoutMs: 60000 });
    const json = JSON.stringify(data, null, 2);
    const name = `soulink-data-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } else {
      // phone app: save it as a file, then the phone's share sheet (Save to Files, Drive, email…)
      const { File, Paths } = await import('expo-file-system'); // phone-only modules, loaded when needed
      const Sharing = await import('expo-sharing');
      const f = new File(Paths.cache, name);
      if (f.exists) f.delete();
      f.create(); f.write(json);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Save your Soulink data', UTI: 'public.json' });
      else await Share.share({ title: name, message: json });
    }
  } catch (e) { notice("Couldn't get your data", e.message); }
}
