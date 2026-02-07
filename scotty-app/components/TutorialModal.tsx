import React from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Shadows } from '@/constants/Theme';

interface TutorialModalProps {
  visible: boolean;
  title: string;
  body: string;
  stepIndex: number;
  totalSteps: number;
  primaryLabel: string;
  onPrimary: () => void;
  onSkip: () => void;
  extraContent?: React.ReactNode;
}

const FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

export default function TutorialModal({
  visible,
  title,
  body,
  stepIndex,
  totalSteps,
  primaryLabel,
  onPrimary,
  onSkip,
  extraContent,
}: TutorialModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.stepText}>Step {stepIndex + 1} of {totalSteps}</Text>
            <TouchableOpacity onPress={onSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          {extraContent ? <View style={styles.extraContent}>{extraContent}</View> : null}
          <TouchableOpacity style={styles.primaryButton} onPress={onPrimary} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    ...Shadows.sketch,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepText: {
    fontFamily: FONT,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  skipText: {
    fontFamily: FONT,
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: 'SpaceMono',
    fontSize: 20,
    color: Colors.ink,
  },
  body: {
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  extraContent: {
    gap: 8,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: Colors.coral,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: 'SpaceMono',
    fontSize: 15,
    color: Colors.ink,
  },
});
