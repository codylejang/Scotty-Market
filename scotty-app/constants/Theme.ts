// Scotty App Theme - Sketch/Doodle Style
// Based on the hand-drawn aesthetic with dotted paper background

export const Colors = {
  // Core colors
  paper: '#fff6f3',
  paperDark: '#ffece6',
  ink: '#1a1a1a',
  coral: '#ff6b6b',
  violet: '#9b59b6',
  accentBlue: '#81d4fa',

  // Sticky note colors
  stickyYellow: '#fff9c4',
  stickyPink: '#f8bbd0',
  stickyGreen: '#c8e6c9',
  stickyBlue: '#bbdefb',
  stickyPurple: '#e1bee7',

  // Functional colors
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',

  // Text colors
  textPrimary: '#1a1a1a',
  textSecondary: 'rgba(26, 26, 26, 0.6)',
  textMuted: 'rgba(26, 26, 26, 0.4)',

  // White for cards
  white: '#ffffff',
};

export const Shadows = {
  sketch: {
    shadowColor: Colors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  sketchSm: {
    shadowColor: Colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sketchCoral: {
    shadowColor: Colors.coral,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
};

export const BorderRadii = {
  doodle1: 32, // Asymmetric feel - use with different corners
  doodle2: 8,
  round: 999,
  card: 16,
  button: 20,
};

// Gradient colors for happiness bar
export const GradientColors = {
  sunset: ['#ff6b6b', '#9b59b6'],
  happiness: ['#ff6b6b', '#9b59b6'],
};

// Font families - these need to be loaded via expo-font
export const Fonts = {
  display: 'Manrope',
  displayBold: 'Manrope-Bold',
  pixel: 'VT323',
  hand: 'Caveat',
};

// Common styles
export const CommonStyles = {
  sketchBorder: {
    borderWidth: 2,
    borderColor: Colors.ink,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: BorderRadii.card,
    ...Shadows.sketch,
  },
  cardSm: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: BorderRadii.doodle2,
    ...Shadows.sketchSm,
  },
  stickyNote: {
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 8,
    ...Shadows.sketchSm,
  },
};

// Category badge colors (sticky note style)
export const CategoryColors: Record<string, string> = {
  food_dining: Colors.stickyPink,
  groceries: Colors.stickyGreen,
  transport: Colors.stickyBlue,
  entertainment: Colors.stickyPurple,
  shopping: Colors.stickyYellow,
  subscriptions: Colors.accentBlue,
  utilities: Colors.stickyBlue,
  education: Colors.stickyGreen,
  health: Colors.stickyPink,
  other: Colors.paperDark,
};

export default {
  Colors,
  Shadows,
  BorderRadii,
  GradientColors,
  Fonts,
  CommonStyles,
  CategoryColors,
};
