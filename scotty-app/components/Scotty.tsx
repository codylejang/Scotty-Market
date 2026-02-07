import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import IdleSvg from '../assets/images/idle.svg';
import LovedSvg from '../assets/images/loved.svg';

interface ScottyProps {
  size?: number;
}

export interface ScottyRef {
  showLoved: () => void;
}

export const Scotty = forwardRef<ScottyRef, ScottyProps>(({ size = 160 }, ref) => {
  const [isLoved, setIsLoved] = useState(false);
  const timeoutRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    showLoved: () => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      setIsLoved(true);
      
      // Revert back to idle after 1 second
      timeoutRef.current = setTimeout(() => {
        setIsLoved(false);
      }, 1000);
    },
  }));

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const SvgComponent = isLoved ? LovedSvg : IdleSvg;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <SvgComponent width={size} height={size} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Scotty;