import { Alert, Platform } from 'react-native';

/** Cross-platform yes/no dialog. Resolves true if confirmed. (Alert doesn't work in browsers.) */
export function confirm(title, message, { confirmText = 'OK', destructive = false, cancelText = 'Cancel' } = {}) {
  if (Platform.OS === 'web') {
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

export function notice(title, message) {
  // eslint-disable-next-line no-alert
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
