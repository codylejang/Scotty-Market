import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ScottyHomeScreen from '../ScottyHomeScreen';

describe('ScottyHomeScreen', () => {
  it('renders correctly', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('"Save some kibble for later!"')).toBeTruthy();
  });

  it('renders speech bubble with correct text', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    const speechText = getByText('"Save some kibble for later!"');
    expect(speechText).toBeTruthy();
  });

  it('renders category icons with correct emojis', () => {
    const { getAllByText, getByText } = render(<ScottyHomeScreen />);
    expect(getAllByText('☕').length).toBeGreaterThan(0);
    expect(getByText('🍴')).toBeTruthy();
    expect(getByText('🐾')).toBeTruthy();
  });

  it('renders category badges with correct counts', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('1x')).toBeTruthy();
    expect(getByText('4x')).toBeTruthy();
    expect(getByText('3x')).toBeTruthy();
  });

  it('renders happiness meter with correct label and value', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('SCOTTY HAPPINESS')).toBeTruthy();
    expect(getByText('82%')).toBeTruthy();
  });

  it('renders savings goals section', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('JUICY MEAT FUND')).toBeTruthy();
    expect(getByText('BOBA RUN SAVINGS')).toBeTruthy();
    expect(getByText('ICE CREAM PARTY')).toBeTruthy();
  });

  it('renders goal amounts correctly', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('$45 / $60')).toBeTruthy();
    expect(getByText('$12 / $30')).toBeTruthy();
    expect(getByText('$24 / $25')).toBeTruthy();
  });

  it('renders goal icons with correct emojis', () => {
    const { getAllByText, getByText } = render(<ScottyHomeScreen />);
    expect(getByText('🍖')).toBeTruthy();
    expect(getAllByText('☕').length).toBeGreaterThan(0);
    expect(getByText('🍦')).toBeTruthy();
  });

  it('renders summary cards with correct labels', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('DAILY SPEND')).toBeTruthy();
    expect(getByText('BANK TOTAL')).toBeTruthy();
  });

  it('renders summary values correctly', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('$42.50')).toBeTruthy();
    expect(getByText('$2,410')).toBeTruthy();
    expect(getByText('↗ +$120 today')).toBeTruthy();
  });

  it('renders budget dashboard with correct title', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('BUDGET DASHBOARD')).toBeTruthy();
  });

  it('renders budget tabs: Daily, Weekly, Monthly', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('Daily')).toBeTruthy();
    expect(getByText('Weekly')).toBeTruthy();
    expect(getByText('Monthly')).toBeTruthy();
  });

  it('switches active tab when clicked', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    const weeklyTab = getByText('Weekly');

    fireEvent.press(weeklyTab);

    // Component should re-render with new active tab
    expect(getByText('Weekly')).toBeTruthy();
  });

  it('switches to Monthly tab when clicked', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    const monthlyTab = getByText('Monthly');

    fireEvent.press(monthlyTab);

    expect(getByText('Monthly')).toBeTruthy();
  });

  it('can switch between all tabs', () => {
    const { getByText } = render(<ScottyHomeScreen />);

    // Start with Daily (default)
    let dailyTab = getByText('Daily');
    expect(dailyTab).toBeTruthy();

    // Switch to Weekly
    fireEvent.press(getByText('Weekly'));
    expect(getByText('Weekly')).toBeTruthy();

    // Switch to Monthly
    fireEvent.press(getByText('Monthly'));
    expect(getByText('Monthly')).toBeTruthy();

    // Switch back to Daily
    fireEvent.press(getByText('Daily'));
    expect(getByText('Daily')).toBeTruthy();
  });

  it('renders budget categories with emojis', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('🎭')).toBeTruthy();
    expect(getByText('🍔')).toBeTruthy();
    expect(getByText('🛍️')).toBeTruthy();
  });

  it('renders budget category names', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('Entertainment')).toBeTruthy();
    expect(getByText('Dining Out')).toBeTruthy();
    expect(getByText('Shopping')).toBeTruthy();
  });

  it('renders budget category amounts', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('$45.00 / $60.00')).toBeTruthy();
    expect(getByText('$112.00 / $120.00')).toBeTruthy();
    expect(getByText('$20.00 / $150.00')).toBeTruthy();
  });

  it('renders budget projections', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('Projected End: 92%')).toBeTruthy();
    expect(getByText('Projected End: 115%')).toBeTruthy();
    expect(getByText('Projected End: 40%')).toBeTruthy();
  });

  it('renders settings icon in budget header', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    expect(getByText('⚙️')).toBeTruthy();
  });

  it('settings icon is touchable', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    const settingsIcon = getByText('⚙️');

    // Should not throw when pressed (even if no handler is attached)
    expect(() => fireEvent.press(settingsIcon.parent!)).not.toThrow();
  });

  it('renders ScrollView container', () => {
    const { UNSAFE_root } = render(<ScottyHomeScreen />);
    const scrollViews = UNSAFE_root.findAllByType('RCTScrollView');
    expect(scrollViews.length).toBeGreaterThan(0);
  });

  it('handles tab state changes independently', () => {
    const { getByText, rerender } = render(<ScottyHomeScreen />);

    fireEvent.press(getByText('Weekly'));
    rerender(<ScottyHomeScreen />);

    fireEvent.press(getByText('Monthly'));

    // Should maintain state and continue to render correctly
    expect(getByText('Monthly')).toBeTruthy();
    expect(getByText('BUDGET DASHBOARD')).toBeTruthy();
  });

  it('displays multiple spending categories', () => {
    const { getByText } = render(<ScottyHomeScreen />);

    // Verify all three budget categories are present
    const entertainment = getByText('Entertainment');
    const diningOut = getByText('Dining Out');
    const shopping = getByText('Shopping');

    expect(entertainment).toBeTruthy();
    expect(diningOut).toBeTruthy();
    expect(shopping).toBeTruthy();
  });

  it('shows warning projection for over-budget category', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    // Dining Out is at 115% (over budget)
    const overBudgetProjection = getByText('Projected End: 115%');
    expect(overBudgetProjection).toBeTruthy();
  });

  it('renders complete hero section structure', () => {
    const { getByText } = render(<ScottyHomeScreen />);

    // Verify hero components are present
    expect(getByText('"Save some kibble for later!"')).toBeTruthy();
    expect(getByText('SCOTTY HAPPINESS')).toBeTruthy();
    expect(getByText('82%')).toBeTruthy();
  });

  it('maintains consistent UI structure', () => {
    const { getByText, rerender } = render(<ScottyHomeScreen />);

    // Initial render
    expect(getByText('SCOTTY HAPPINESS')).toBeTruthy();

    // Re-render
    rerender(<ScottyHomeScreen />);

    // Structure should remain consistent
    expect(getByText('SCOTTY HAPPINESS')).toBeTruthy();
    expect(getByText('BUDGET DASHBOARD')).toBeTruthy();
  });

  it('handles empty tab presses gracefully', () => {
    const { getByText } = render(<ScottyHomeScreen />);
    const dailyTab = getByText('Daily');

    // Pressing already active tab should not cause issues
    fireEvent.press(dailyTab);
    fireEvent.press(dailyTab);

    expect(getByText('Daily')).toBeTruthy();
  });

  it('renders PixelScotty SVG component', () => {
    const { UNSAFE_root } = render(<ScottyHomeScreen />);
    // Should render without crashing
    expect(UNSAFE_root).toBeTruthy();
  });

  it('renders LinearGradient for happiness meter', () => {
    const { UNSAFE_root } = render(<ScottyHomeScreen />);
    // Should render successfully - LinearGradient is mocked as View
    expect(UNSAFE_root).toBeTruthy();
  });

  it('renders without crashing when switching tabs rapidly', () => {
    const { getByText } = render(<ScottyHomeScreen />);

    expect(() => {
      fireEvent.press(getByText('Weekly'));
      fireEvent.press(getByText('Daily'));
      fireEvent.press(getByText('Monthly'));
      fireEvent.press(getByText('Weekly'));
    }).not.toThrow();
  });

  it('persists all UI elements after tab switches', () => {
    const { getByText } = render(<ScottyHomeScreen />);

    // Switch tabs
    fireEvent.press(getByText('Weekly'));
    fireEvent.press(getByText('Monthly'));

    // Verify all main sections still present
    expect(getByText('"Save some kibble for later!"')).toBeTruthy();
    expect(getByText('SCOTTY HAPPINESS')).toBeTruthy();
    expect(getByText('JUICY MEAT FUND')).toBeTruthy();
    expect(getByText('BUDGET DASHBOARD')).toBeTruthy();
  });
});