// Profile photo picker: one sheet with "Choose from gallery", "Take a photo" and "Remove photo".
// The profile photo is always the person's own choice, never a Face ID scan frame.
import { useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ActionSheet from './ActionSheet';

const OPTS = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };

/**
 * const photo = usePhotoPicker({ onPicked: (uri) => ..., onRemove, onError, hasPhoto });
 * photo.open() shows the sheet; render {photo.sheet} once in the screen.
 */
export function usePhotoPicker({ onPicked, onRemove, onError, hasPhoto }) {
  const [visible, setVisible] = useState(false);

  const gallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { onError?.('Allow photo access to choose a profile picture'); return; }
    const r = await ImagePicker.launchImageLibraryAsync(OPTS);
    if (!r.canceled && r.assets?.[0]) onPicked(r.assets[0].uri);
  };
  const camera = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { onError?.('Allow camera access to take a profile picture'); return; }
    }
    const r = await ImagePicker.launchCameraAsync({ ...OPTS, cameraType: ImagePicker.CameraType.front });
    if (!r.canceled && r.assets?.[0]) onPicked(r.assets[0].uri);
  };

  const options = [
    { label: 'Choose from gallery', onPress: gallery },
    { label: 'Take a photo', onPress: camera },
    ...(hasPhoto && onRemove ? [{ label: 'Remove photo', destructive: true, onPress: onRemove }] : []),
  ];
  return {
    open: () => setVisible(true),
    sheet: <ActionSheet visible={visible} onClose={() => setVisible(false)} title="Profile photo" options={options} />,
  };
}
