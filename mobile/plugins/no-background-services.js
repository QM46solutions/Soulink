// Soulink never runs in the background: no background location, no audio playing after the app is closed.
// The location package still declares a background location "foreground service" in its own manifest; this
// removes it from the app so the Play Store build declares no foreground services (none are ever started).
const { withAndroidManifest } = require('expo/config-plugins');

const REMOVE = ['expo.modules.location.services.LocationTaskService'];

module.exports = (config) => withAndroidManifest(config, (cfg) => {
  const manifest = cfg.modResults.manifest;
  manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
  const app = manifest.application[0];
  const list = (app.service = app.service || []);
  for (const name of REMOVE) {
    if (!list.some((s) => s.$['android:name'] === name)) list.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
  }
  return cfg;
});
