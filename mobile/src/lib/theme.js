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

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// Default text style for body copy
export const type = {
  label: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted },
  tag: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.dim },
};
