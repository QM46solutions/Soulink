// Profile photo picker: one sheet with "Choose from gallery", "Take a photo" and "Remove photo".
// The profile photo is always the person's own choice, never a Face ID scan frame.
import { useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ActionSheet from './ActionSheet';
import CropPhoto from './CropPhoto';

// We crop ourselves (CropPhoto) so it works the same on phone and web
const OPTS = { mediaTypes: ['images'], allowsEditing: false, quality: 0.9 };

/**
 * const photo = usePhotoPicker({ onPicked: (uri) => ..., onRemove, onError, hasPhoto });
 * photo.open() shows the sheet; render {photo.sheet} once in the screen.
 */
export function usePhotoPicker({ onPicked, onRemove, onError, hasPhoto }) {
  const [visible, setVisible] = useState(false);
  const [cropping, setCropping] = useState(null);

  const gallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { onError?.('Allow photo access to choose a profile picture'); return; }
    const r = await ImagePicker.launchImageLibraryAsync(OPTS);
    if (!r.canceled && r.assets?.[0]) setCropping(r.assets[0].uri);
  };
  const camera = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { onError?.('Allow camera access to take a profile picture'); return; }
    }
    const r = await ImagePicker.launchCameraAsync({ ...OPTS, cameraType: ImagePicker.CameraType.front });
    if (!r.canceled && r.assets?.[0]) setCropping(r.assets[0].uri);
  };

  const options = [
    { label: 'Choose from gallery', onPress: gallery },
    { label: 'Take a photo', onPress: camera },
    ...(hasPhoto && onRemove ? [{ label: 'Remove photo', destructive: true, onPress: onRemove }] : []),
  ];
  return {
    open: () => setVisible(true),
    sheet: (
      <>
        <ActionSheet visible={visible} onClose={() => setVisible(false)} title="Profile photo" options={options} />
        <CropPhoto uri={cropping} onCancel={() => setCropping(null)} onDone={(u) => { setCropping(null); onPicked(u); }} />
      </>
    ),
  };
}
