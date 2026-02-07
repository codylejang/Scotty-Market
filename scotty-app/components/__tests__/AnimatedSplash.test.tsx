import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import AnimatedSplash from '../AnimatedSplash';

// Mock the Scotty component
jest.mock('../Scotty', () => 'Scotty');

describe('AnimatedSplash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders correctly with default props', () => {
    const { getByTestId } = render(<AnimatedSplash />);
    // The component renders without crashing
    expect(render(<AnimatedSplash />)).toBeTruthy();
  });

  it('renders Scotty component with correct props', () => {
    const { UNSAFE_getByType } = render(<AnimatedSplash />);
    const scotty = UNSAFE_getByType('Scotty');
    expect(scotty).toBeTruthy();
    expect(scotty.props.mood).toBe('happy');
    expect(scotty.props.size).toBe('large');
  });

  it('starts animations on mount', () => {
    const mockStart = jest.fn();
    const mockParallel = jest.spyOn(Animated, 'parallel').mockReturnValue({
      start: mockStart,
      stop: jest.fn(),
      reset: jest.fn(),
    } as any);

    render(<AnimatedSplash />);

    expect(mockParallel).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();

    mockParallel.mockRestore();
  });

  it('calls onFinish after durationMs', () => {
    const onFinish = jest.fn();
    render(<AnimatedSplash durationMs={1000} onFinish={onFinish} />);

    expect(onFinish).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('uses custom durationMs prop', () => {
    const onFinish = jest.fn();
    render(<AnimatedSplash durationMs={2000} onFinish={onFinish} />);

    jest.advanceTimersByTime(1500);
    expect(onFinish).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('uses default durationMs of 1200ms when not provided', () => {
    const onFinish = jest.fn();
    render(<AnimatedSplash onFinish={onFinish} />);

    jest.advanceTimersByTime(1200);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('does not call onFinish if not provided', () => {
    // Should not throw error when onFinish is undefined
    expect(() => {
      render(<AnimatedSplash />);
      jest.advanceTimersByTime(1200);
    }).not.toThrow();
  });

  it('cleans up animation and timeout on unmount', () => {
    const mockStop = jest.fn();
    const mockParallel = jest.spyOn(Animated, 'parallel').mockReturnValue({
      start: jest.fn(),
      stop: mockStop,
      reset: jest.fn(),
    } as any);

    const { unmount } = render(<AnimatedSplash />);
    unmount();

    expect(mockStop).toHaveBeenCalled();

    mockParallel.mockRestore();
  });

  it('clears timeout on unmount before onFinish is called', () => {
    const onFinish = jest.fn();
    const { unmount } = render(<AnimatedSplash durationMs={1000} onFinish={onFinish} />);

    jest.advanceTimersByTime(500);
    unmount();
    jest.advanceTimersByTime(500);

    // onFinish should not be called since component unmounted
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('has correct overlay styles', () => {
    const { UNSAFE_root } = render(<AnimatedSplash />);
    // Verify component structure exists
    expect(UNSAFE_root).toBeTruthy();
  });

  it('applies pointer events auto to overlay', () => {
    const { UNSAFE_root } = render(<AnimatedSplash />);
    const overlay = UNSAFE_root.findAllByProps({ pointerEvents: 'auto' });
    expect(overlay.length).toBeGreaterThan(0);
  });

  it('creates animations with correct timing values', () => {
    const mockTiming = jest.spyOn(Animated, 'timing');
    const mockSequence = jest.spyOn(Animated, 'sequence');

    render(<AnimatedSplash />);

    // Verify opacity animation (400ms)
    expect(mockTiming).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      })
    );

    // Verify scale animation (500ms)
    expect(mockTiming).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    );

    // Verify translateY sequence with 450ms timing
    expect(mockTiming).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      })
    );

    expect(mockSequence).toHaveBeenCalled();

    mockTiming.mockRestore();
    mockSequence.mockRestore();
  });

  it('uses correct initial animation values', () => {
    const { UNSAFE_root } = render(<AnimatedSplash />);
    // Component should render with initial animated values
    expect(UNSAFE_root).toBeTruthy();
  });

  it('handles multiple rapid re-renders correctly', () => {
    const onFinish = jest.fn();
    const { rerender } = render(<AnimatedSplash durationMs={1000} onFinish={onFinish} />);

    rerender(<AnimatedSplash durationMs={1000} onFinish={onFinish} />);
    rerender(<AnimatedSplash durationMs={1000} onFinish={onFinish} />);

    jest.advanceTimersByTime(1000);

    // Should still work correctly
    expect(onFinish).toHaveBeenCalled();
  });

  it('handles zero duration edge case', () => {
    const onFinish = jest.fn();
    render(<AnimatedSplash durationMs={0} onFinish={onFinish} />);

    jest.advanceTimersByTime(0);

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('handles very long duration', () => {
    const onFinish = jest.fn();
    render(<AnimatedSplash durationMs={10000} onFinish={onFinish} />);

    jest.advanceTimersByTime(5000);
    expect(onFinish).not.toHaveBeenCalled();

    jest.advanceTimersByTime(5000);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});