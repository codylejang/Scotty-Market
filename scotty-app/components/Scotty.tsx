import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Image } from 'react-native';

const idleSvg = require('../assets/images/idle.svg');
const lovedSvg = require('../assets/images/loved.svg');

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

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={isLoved ? lovedSvg : idleSvg}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
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