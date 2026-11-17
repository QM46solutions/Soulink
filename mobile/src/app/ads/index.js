// The Ads Manager moved to the Soulink team console (soulinkconsole.qm46.in › Ads & customers).
// This old address only sends anyone who still opens it back to Settings. ("My ads" for customers stays: ads/mine.js.)
import { Redirect } from 'expo-router';

export default function AdsManagerMoved() {
  return <Redirect href="/settings" />;
}
