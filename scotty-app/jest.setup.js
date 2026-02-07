// Mock expo-router
jest.mock('expo-router', () => {
  const React = require('react');
  const Screen = ({ children, ...props }) => React.createElement('View', props, children);
  const Stack = ({ children, ...props }) => React.createElement('View', props, children);
  Stack.Screen = Screen;

  return {
    Stack,
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
    Link: ({ children, ...props }) => React.createElement('View', props, children),
  };
});

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-font
jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  FontAwesome: {
    font: {},
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  DarkTheme: {},
  DefaultTheme: {},
  ThemeProvider: ({ children }) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children, ...props }) => React.createElement('View', props, children),
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockSvg = function Svg({ children, ...props }) {
    return React.createElement(View, { ...props, testID: 'svg' }, children);
  };

  const MockPath = function Path(props) {
    return React.createElement(View, { ...props, testID: 'path' });
  };

  const MockRect = function Rect(props) {
    return React.createElement(View, { ...props, testID: 'rect' });
  };

  const MockCircle = function Circle(props) {
    return React.createElement(View, { ...props, testID: 'circle' });
  };

  const MockG = function G({ children, ...props }) {
    return React.createElement(View, { ...props, testID: 'g' }, children);
  };

  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Path: MockPath,
    Rect: MockRect,
    Circle: MockCircle,
    G: MockG,
  };
});

// Mock context
jest.mock('./context/AppContext', () => ({
  AppProvider: ({ children }) => children,
  useApp: () => ({}),
}));

// Mock useColorScheme
jest.mock('./components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));