// Phones: sheets/menus use a normal full-screen Modal (see portal.web.js for the laptop preview).
import { Modal } from 'react-native';

export function Overlay({ children, onClose, animationType = 'slide' }) {
  return <Modal visible transparent animationType={animationType} onRequestClose={onClose}>{children}</Modal>;
}
