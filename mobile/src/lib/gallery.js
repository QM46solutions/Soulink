// Choosing photos and videos from the phone's gallery.
// Android: the system photo picker shows the gallery to the person and hands back only what they pick, so
// Soulink needs no gallery permission at all (none is in the Android build). iPhone still asks once.
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function galleryAccess() {
  if (Platform.OS !== 'ios') return { granted: true };
  return ImagePicker.requestMediaLibraryPermissionsAsync();
}
