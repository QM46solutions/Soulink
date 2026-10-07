// Rough current position from the phone (asks permission the first time).
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error("This phone or browser can't share location.")); return; }
    navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), (e) => reject(new Error(e.code === 1 ? 'Location is blocked. Allow it for Soulink in your phone settings, then try again.' : "Couldn't get your location. Try again outside or near a window.")), { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  });
}
