// Adds to app.json what can't be fixed in it: Android notifications need Google's Firebase config file
// (google-services.json, in this folder). Until that file is here, the app builds without it.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebase = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(firebase)) return config;
  return { ...config, android: { ...config.android, googleServicesFile: './google-services.json' } };
};
