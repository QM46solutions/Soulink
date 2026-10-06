import { Alert, Platform } from 'react-native';

// In-app dialogs. Phones use the native Alert (already part of the app). On the web build, dialogs are drawn
// by <DialogHost /> inside the app (never the browser's own confirm/alert boxes).
let host = null;
export function registerDialogHost(fn) { host = fn; return () => { if (host === fn) host = null; }; }

/** Yes/no dialog. Resolves true if confirmed. */
export function confirm(title, message, { confirmText = 'OK', destructive = false, cancelText = 'Cancel' } = {}) {
  if (Platform.OS === 'web') {
    if (host) return new Promise((resolve) => host({ title, message, confirmText, cancelText, destructive, resolve }));
    // eslint-disable-next-line no-alert
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** Information dialog with one OK button. */
export function notice(title, message) {
  if (Platform.OS === 'web') {
    if (host) { host({ title, message, confirmText: 'OK', cancelText: null, resolve: () => {} }); return; }
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
