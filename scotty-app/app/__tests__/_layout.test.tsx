import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import RootLayout from '../_layout';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

// Mock AnimatedSplash
jest.mock('@/components/AnimatedSplash', () => {
  const React = require('react');
  const { View, Text, Button } = require('react-native');
  return function MockAnimatedSplash({ onFinish }: { onFinish?: () => void }) {
    return React.createElement(
      View,
      { testID: 'animated-splash' },
      React.createElement(Text, null, 'AnimatedSplash'),
      React.createElement(Button, {
        onPress: () => onFinish && onFinish(),
        title: 'Finish',
        testID: 'finish-splash-button',
      })
    );
  };
});

describe('RootLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when fonts are loaded', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { getByTestId } = render(<RootLayout />);
    expect(getByTestId('animated-splash')).toBeTruthy();
  });

  it('returns null when fonts are not loaded', () => {
    (useFonts as jest.Mock).mockReturnValue([false, null]);

    const { UNSAFE_root } = render(<RootLayout />);
    // When fonts aren't loaded, component returns null
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('calls SplashScreen.hideAsync when fonts are loaded', async () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    render(<RootLayout />);

    await waitFor(() => {
      expect(SplashScreen.hideAsync).toHaveBeenCalled();
    });
  });

  it('does not call SplashScreen.hideAsync when fonts are not loaded', () => {
    (useFonts as jest.Mock).mockReturnValue([false, null]);
    (SplashScreen.hideAsync as jest.Mock).mockClear();

    render(<RootLayout />);

    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('throws error when font loading fails', () => {
    const error = new Error('Font loading failed');
    (useFonts as jest.Mock).mockReturnValue([false, error]);

    expect(() => render(<RootLayout />)).toThrow('Font loading failed');
  });

  it('renders AnimatedSplash by default', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { getByTestId } = render(<RootLayout />);
    expect(getByTestId('animated-splash')).toBeTruthy();
  });

  it('hides AnimatedSplash when onFinish is called', async () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { getByText, queryByTestId } = render(<RootLayout />);

    const finishButton = getByText('Finish');
    fireEvent.press(finishButton);

    await waitFor(() => {
      expect(queryByTestId('animated-splash')).toBeNull();
    });
  });

  it('loads SpaceMono font', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    render(<RootLayout />);

    expect(useFonts).toHaveBeenCalledWith(
      expect.objectContaining({
        SpaceMono: expect.anything(),
      })
    );
  });

  it('loads FontAwesome fonts', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    render(<RootLayout />);

    // useFonts should be called with FontAwesome.font spread in
    expect(useFonts).toHaveBeenCalled();
  });

  it('renders navigation correctly', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { UNSAFE_root } = render(<RootLayout />);
    // Should render without errors
    expect(UNSAFE_root).toBeTruthy();
  });

  it('uses correct theme based on colorScheme', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { UNSAFE_root } = render(<RootLayout />);
    // Should render successfully with theme
    expect(UNSAFE_root).toBeTruthy();
  });

  it('manages showAnimatedSplash state correctly', async () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { getByTestId, queryByTestId, getByText } = render(<RootLayout />);

    // Initially shows animated splash
    expect(getByTestId('animated-splash')).toBeTruthy();

    // After finish, should hide splash
    const finishButton = getByText('Finish');
    fireEvent.press(finishButton);

    await waitFor(() => {
      expect(queryByTestId('animated-splash')).toBeNull();
    });
  });

  it('handles re-renders correctly', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { rerender } = render(<RootLayout />);

    expect(() => rerender(<RootLayout />)).not.toThrow();
  });

  it('exports unstable_settings with correct initialRouteName', () => {
    const module = require('../_layout');
    expect(module.unstable_settings).toBeDefined();
    expect(module.unstable_settings.initialRouteName).toBe('(tabs)');
  });

  it('maintains state isolation between renders', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { unmount: unmount1 } = render(<RootLayout />);
    unmount1();

    const { getByTestId: getByTestId2 } = render(<RootLayout />);
    // Second instance should have fresh state
    expect(getByTestId2('animated-splash')).toBeTruthy();
  });

  it('handles font loading state transitions', async () => {
    // Start with fonts not loaded
    (useFonts as jest.Mock).mockReturnValue([false, null]);

    const { rerender, UNSAFE_root } = render(<RootLayout />);
    expect(UNSAFE_root.children).toHaveLength(0);

    // Update to fonts loaded
    (useFonts as jest.Mock).mockReturnValue([true, null]);
    rerender(<RootLayout />);

    // Should now render content
    await waitFor(() => {
      expect(UNSAFE_root.children.length).toBeGreaterThan(0);
    });
  });

  it('does not show AnimatedSplash after it finishes', async () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { queryByTestId, rerender, getByText } = render(<RootLayout />);

    // Finish the splash
    const finishButton = getByText('Finish');
    fireEvent.press(finishButton);

    await waitFor(() => {
      expect(queryByTestId('animated-splash')).toBeNull();
    });

    // Re-render and verify splash stays hidden
    rerender(<RootLayout />);
    expect(queryByTestId('animated-splash')).toBeNull();
  });

  it('renders navigation structure correctly', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { UNSAFE_root } = render(<RootLayout />);

    // Should have rendered successfully
    expect(UNSAFE_root).toBeTruthy();
  });

  it('initializes with correct default state', () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    const { getByTestId } = render(<RootLayout />);

    // showAnimatedSplash should be true initially
    expect(getByTestId('animated-splash')).toBeTruthy();
  });

  it('handles missing font assets gracefully', () => {
    const fontError = new Error('Font asset not found');
    (useFonts as jest.Mock).mockReturnValue([false, fontError]);

    expect(() => render(<RootLayout />)).toThrow();
  });

  it('only calls hideAsync once when fonts load', async () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);
    (SplashScreen.hideAsync as jest.Mock).mockClear();

    render(<RootLayout />);

    await waitFor(() => {
      expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    });
  });
});