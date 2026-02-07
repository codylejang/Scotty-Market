import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { createGoal } from '../services/api';

interface GoalWorkshopModalProps {
  visible: boolean;
  onClose: () => void;
  onGoalCreated?: () => void;
}

export default function GoalWorkshopModal({ visible, onClose, onGoalCreated }: GoalWorkshopModalProps) {
  const [goalName, setGoalName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [savedSoFar, setSavedSoFar] = useState('');
  const [budgetPercent, setBudgetPercent] = useState(30);
  const [totalPrice, setTotalPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const amount = parseFloat(totalPrice);
    if (!goalName || !amount || amount <= 0) {
      Alert.alert('Missing Info', 'Please enter a goal name and price.');
      return;
    }

    setSubmitting(true);
    try {
      // Parse date from mm/dd/yyyy to ISO
      let deadline: string | undefined;
      if (targetDate) {
        const parts = targetDate.split('/');
        if (parts.length === 3) {
          deadline = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }

      await createGoal(
        goalName,
        amount,
        deadline,
        parseFloat(savedSoFar) || 0,
        budgetPercent
      );

      // Reset form
      setGoalName('');
      setTargetDate('');
      setSavedSoFar('');
      setBudgetPercent(10);
      setTotalPrice('');

      onGoalCreated?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save goal. Is the backend running?');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>
          <View style={styles.modal}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Goal Workshop</Text>
                <Text style={styles.subtitle}>LET'S MAKE A PLAN!</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Goal Name */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>✏️ GOAL NAME</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., New MacBook"
                    placeholderTextColor="#bbb"
                    value={goalName}
                    onChangeText={setGoalName}
                  />
                </View>
              </View>

              {/* When */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>📅 WHEN DO YOU WANT IT?</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="mm/dd/yyyy"
                    placeholderTextColor="#bbb"
                    value={targetDate}
                    onChangeText={setTargetDate}
                  />
                  <Text style={styles.inputIcon}>📅</Text>
                </View>
              </View>

              {/* Saved So Far */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>💚 SAVED SO FAR?</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    keyboardType="numeric"
                    value={savedSoFar}
                    onChangeText={setSavedSoFar}
                  />
                </View>
              </View>

              {/* Budget Percent */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>% HOW MUCH WOULD YOU LIKE TO PUT INTO SAVINGS?</Text>
                <View style={styles.percentRow}>
                  <View style={styles.percentBadge}>
                    <Text style={styles.percentValue}>{budgetPercent}</Text>
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={100}
                      step={1}
                      value={budgetPercent}
                      onValueChange={(value) => setBudgetPercent(Math.round(value))}
                      minimumTrackTintColor="#9b59b6"
                      maximumTrackTintColor="#e0e0e0"
                      thumbTintColor="#9b59b6"
                    />
                  </View>
                  <Text style={styles.percentLabel}>OF MONTHLY INCOME</Text>
                </View>
              </View>

              {/* Total Price */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>💎 TOTAL PRICE TAG?</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    keyboardType="numeric"
                    value={totalPrice}
                    onChangeText={setTotalPrice}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>BREAK IT DOWN, SCOTTY! 🐾</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff6f3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 2,
    borderColor: '#000',
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    backgroundColor: '#ff6b6b',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 2,
  },
  avatarBadge: {
    width: 48,
    height: 48,
    backgroundColor: '#fff9c4',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  avatarEmoji: { fontSize: 24 },

  // Fields
  field: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '900',
    color: '#ff6b6b',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputPrefix: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    padding: 0,
  },
  inputIcon: {
    fontSize: 16,
    marginLeft: 8,
  },

  // Percent slider
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  percentBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  percentValue: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  },
  percentSymbol: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    marginLeft: 2,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#ddd',
    borderRadius: 3,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#81d4fa',
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 18,
    height: 18,
    backgroundColor: '#81d4fa',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 9,
    marginLeft: -9,
  },
  percentLabel: {
    fontFamily: FONT,
    fontSize: 7,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    width: 60,
    textAlign: 'right',
  },
  sliderContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  slider: {
    height: 40,
  },

  // Submit
  submitButton: {
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  submitText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
});
