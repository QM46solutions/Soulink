// Reference phone for all Soulink screens: iPhone 17 Pro Max (6.9").
// Screen 440 × 956 points. Top 59 pt is taken by the status bar + Dynamic Island,
// bottom 34 pt by the home indicator, so the app itself gets 440 × 863 points.
// Every screen must fit and look right in that space. The browser preview draws this exact phone.
export const PHONE = {
  name: 'iPhone 17 Pro Max',
  width: 440,
  height: 956,
  top: 59,
  bottom: 34,
};
export const APP_AREA = { width: PHONE.width, height: PHONE.height - PHONE.top - PHONE.bottom };
