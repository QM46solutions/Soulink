// One size factor for the phone app, from the screen's own width: the design is drawn for the iPhone 17 Pro Max
// (440 wide, same as the browser), so it's 1 there and on the web, and a little smaller on narrower phones (most
// Androids are 360–412 wide). sz(n): a height / width scaled that way (buttons, fields). Font sizes are scaled
// for every Text by lib/textScale.js, so don't wrap font sizes in sz().
import { Dimensions, Platform } from 'react-native';
const SCREEN_W = Dimensions.get('window')?.width || 440;
export const UI = Platform.OS === 'web' ? 1 : Math.max(0.86, Math.min(1, SCREEN_W / 440));
export const sz = (n) => Math.round(n * UI * 2) / 2;
/** text never grows past this on phones set to a large text size (it would push screens apart) */
// One height for every main action button on phones (Post, Send, Continue, Connect…): sleek, the same everywhere,
// scaled to the screen like the rest. webH: the height the browser version keeps (unchanged there).
export const btnH = (webH = 50) => (Platform.OS === 'web' ? webH : sz(46));
export const MAX_FONT_SCALE = 1.1; // same cap as lib/textScale.js

// Soulink design tokens — taken from the pitch site (soulink-pitch.netlify.app) so the app and site match.
export const colors = {
  void: '#08070d',
  deep: '#0e0c16',
  surface: '#15131f',
  card: '#1a1828',
  border: '#2a2740',
  soul: '#7c5cfc',
  aura: '#b08fff',
  spark: '#ff6b9d',
  gold: '#f5c842',
  mint: '#42e8c0',
  text: '#e9e7f2',
  muted: '#8b88a0',
  dim: '#4a4760',
  danger: '#ff5c7a',
  glass: 'rgba(26,24,40,0.72)',   // translucent cards over the starfield
  inputBg: 'rgba(8,7,13,0.6)',
};

// Brand gradients
export const gradients = {
  wordmark: ['#ffffff', colors.aura, colors.spark],   // big "Soulink" + headlines (135°)
  button: [colors.soul, colors.spark],                 // primary buttons (120°)
  soul: [colors.soul, colors.aura],
};

// Fonts: Syne for display, Inter for text, Space Mono for small "tech" labels
export const fonts = {
  display: 'Syne_800ExtraBold',
  displayBold: 'Syne_700Bold',
  displaySemi: 'Syne_600SemiBold',
  body: 'Inter_400Regular',
  bodyLight: 'Inter_300Light',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
};

// spacing: on phones, scaled to the screen like text and buttons (the browser keeps the exact values), so a
// screen keeps the same proportions as the browser version on any phone width
const sp = (n) => (Platform.OS === 'web' ? n : Math.round(n * UI * 2) / 2);
export const space = { xs: sp(4), sm: sp(8), md: sp(12), lg: sp(16), xl: sp(24), xxl: sp(32) };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// Default text style for body copy
export const type = {
  label: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted },
  tag: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.dim },
};
