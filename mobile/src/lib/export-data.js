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
      await Share.share({ title: name, message: json });
    }
  } catch (e) { notice("Couldn't get your data", e.message); }
}
