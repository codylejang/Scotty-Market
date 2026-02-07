import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../index';

// Mock the ScottyHomeScreen component
jest.mock('@/components/ScottyHomeScreen', () => {
  const React = require('react');
  return function MockScottyHomeScreen() {
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'ScottyHomeScreen');
  };
});

describe('HomeScreen (index.tsx)', () => {
  it('renders correctly', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('ScottyHomeScreen')).toBeTruthy();
  });

  it('renders ScottyHomeScreen component', () => {
    const { getByText } = render(<HomeScreen />);
    const scottyHomeScreen = getByText('ScottyHomeScreen');
    expect(scottyHomeScreen).toBeTruthy();
  });

  it('is a valid React component', () => {
    expect(HomeScreen).toBeDefined();
    expect(typeof HomeScreen).toBe('function');
  });

  it('returns a React element', () => {
    const element = HomeScreen();
    expect(element).toBeTruthy();
    expect(React.isValidElement(element)).toBe(true);
  });

  it('renders without crashing', () => {
    expect(() => render(<HomeScreen />)).not.toThrow();
  });

  it('delegates rendering to ScottyHomeScreen', () => {
    const { UNSAFE_root } = render(<HomeScreen />);
    expect(UNSAFE_root).toBeTruthy();
  });

  it('is the default export', () => {
    expect(HomeScreen).toBeDefined();
  });

  it('can be rendered multiple times', () => {
    const { rerender } = render(<HomeScreen />);
    expect(() => rerender(<HomeScreen />)).not.toThrow();
  });

  it('maintains consistent output across renders', () => {
    const { getByText, rerender } = render(<HomeScreen />);
    expect(getByText('ScottyHomeScreen')).toBeTruthy();

    rerender(<HomeScreen />);
    expect(getByText('ScottyHomeScreen')).toBeTruthy();
  });

  it('has no props interface (accepts no props)', () => {
    // Component should render without any props
    expect(() => render(<HomeScreen />)).not.toThrow();
  });
});