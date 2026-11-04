import { Platform } from 'react-native';
import * as Location from 'expo-location';
// Rough current position from the phone (asks permission the first time).
export async function currentPosition() {
  // phone app: the phone's own location service (asks permission the first time)
  if (Platform.OS !== 'web') {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location is blocked. Allow it for Soulink in your phone settings, then try again.');
    try { return (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords; }
    catch { throw new Error("Couldn't get your location. Try again outside or near a window."); }
  }
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error("This phone or browser can't share location.")); return; }
    navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), (e) => reject(new Error(e.code === 1 ? 'Location is blocked. Allow it for Soulink in your phone settings, then try again.' : "Couldn't get your location. Try again outside or near a window.")), { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  });
}
