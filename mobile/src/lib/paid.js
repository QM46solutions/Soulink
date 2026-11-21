// Paid digital features (Spread, the one paid message) are sold only on the web app for now. The Play Store and
// App Store apps hide them until Google Play Billing / Apple in-app purchases are built in: both stores require
// their own billing for digital purchases inside the app. Free features are not affected.
import { Platform } from 'react-native';

export const PAID_IN_APP = Platform.OS === 'web';
