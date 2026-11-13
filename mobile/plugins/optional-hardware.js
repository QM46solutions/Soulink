// Tells Google Play that Soulink USES the camera, microphone and location but doesn't REQUIRE them.
// Expo adds these as "required" from the permissions, which hides the app on devices that lack one
// (some tablets, Chromebooks, emulators). The app already asks for each permission when it needs it.
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL = [
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.camera.front',
  'android.hardware.microphone',
  'android.hardware.location',
  'android.hardware.location.gps',
  'android.hardware.location.network',
  'android.hardware.screen.portrait',
];

module.exports = (config) => withAndroidManifest(config, (cfg) => {
  const manifest = cfg.modResults.manifest;
  manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
  // tools:replace wins over any library (e.g. the camera package) that marks the feature as required
  const attrs = (name) => ({ 'android:name': name, 'android:required': 'false', 'tools:replace': 'android:required' });
  const list = (manifest['uses-feature'] = manifest['uses-feature'] || []);
  for (const name of OPTIONAL) {
    const found = list.find((f) => f.$['android:name'] === name);
    if (found) found.$ = { ...found.$, ...attrs(name) };
    else list.push({ $: attrs(name) });
  }
  return cfg;
});
