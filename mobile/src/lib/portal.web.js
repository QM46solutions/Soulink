// Web (laptop preview): draw sheets/menus on top of the whole phone screen, above everything else.
import { createPortal } from 'react-dom';
import { View } from 'react-native';

export function Overlay({ children }) {
  if (typeof document === 'undefined') return null;
  const host = document.getElementById('phone-screen');
  return createPortal(
    <View style={{ position: host ? 'absolute' : 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, justifyContent: 'flex-end' }}>{children}</View>,
    host || document.body,
  );
}
