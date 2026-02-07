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
  Switch,
  KeyboardAvoidingView,
} from 'react-native';

interface BudgetBuilderModalProps {
  visible: boolean;
  onClose: () => void;
}

type BudgetCategory = 'groceries' | 'dining' | 'travel' | 'shopping' | 'fun' | 'self_care' | 'miscellaneous';

const CATEGORIES: { key: BudgetCategory; label: string; icon: string }[] = [
  { key: 'groceries', label: 'GROCERIES', icon: '🥬' },
  { key: 'dining', label: 'DINING', icon: '🍴' },
  { key: 'travel', label: 'TRAVEL', icon: '🚌' },
  { key: 'shopping', label: 'SHOPPING', icon: '🛍️' },
  { key: 'fun', label: 'FUN', icon: '🎬' },
  { key: 'self_care', label: 'SELF CARE', icon: '🌿' },
  { key: 'miscellaneous', label: 'MISCELLANEOUS', icon: '🐾' },
];

export default function BudgetBuilderModal({ visible, onClose }: BudgetBuilderModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory>('groceries');
  const [monthlyLimit, setMonthlyLimit] = useState('400');
  const [adaptiveMode, setAdaptiveMode] = useState(true);

  const suggestedBudget = 400;

  const handleSubmit = () => {
    // TODO: integrate with AppContext
    onClose();
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
                <Text style={styles.title}>Budget Builder</Text>
                <Text style={styles.subtitle}>LET'S MAKE A PLAN!</Text>
              </View>
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarEmoji}>🐕</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category Picker */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>🏷️ PICK A CATEGORY</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.categoryChip,
                        selectedCategory === cat.key && styles.categoryChipActive,
                      ]}
                      onPress={() => setSelectedCategory(cat.key)}
                    >
                      <Text style={styles.categoryIcon}>{cat.icon}</Text>
                      <Text
                        style={[
                          styles.categoryLabel,
                          selectedCategory === cat.key && styles.categoryLabelActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Monthly Limit */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>💰 MONTHLY LIMIT</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={monthlyLimit}
                    onChangeText={setMonthlyLimit}
                    keyboardType="numeric"
                  />
                  <View style={styles.inputIconBadge}>
                    <Text style={styles.inputIconText}>💳</Text>
                  </View>
                </View>
              </View>

              {/* Suggestion Card */}
              <View style={styles.suggestionCard}>
                <Text style={styles.suggestionText}>
                  Your 3-month average is $420. Suggested budget:{' '}
                  <Text style={styles.suggestionHighlight}>${suggestedBudget}.</Text>
                </Text>
                <TouchableOpacity
                  style={styles.suggestButton}
                  onPress={() => setMonthlyLimit(String(suggestedBudget))}
                >
                  <Text style={styles.suggestButtonText}>SUGGEST ${suggestedBudget}</Text>
                </TouchableOpacity>
              </View>

              {/* Adaptive Mode */}
              <View style={styles.field}>
                <View style={styles.adaptiveHeader}>
                  <Text style={styles.fieldLabel}>⚙️ ADAPTIVE MODE</Text>
                  <Text style={styles.adaptiveFlex}>ALLOW +/- 10% FLEX</Text>
                </View>
                <View style={styles.adaptiveCard}>
                  <Text style={styles.adaptiveText}>
                    Auto-adjust limit based on spending?
                  </Text>
                  <Switch
                    value={adaptiveMode}
                    onValueChange={setAdaptiveMode}
                    trackColor={{ false: '#ddd', true: '#81d4fa' }}
                    thumbColor={adaptiveMode ? '#fff' : '#fff'}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitText}>SET BUDGET 🐾</Text>
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

  // Category Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    width: '22%',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  categoryChipActive: {
    backgroundColor: '#fff9c4',
  },
  categoryIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  categoryLabel: {
    fontFamily: FONT,
    fontSize: 7,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  categoryLabelActive: {
    color: '#000',
  },

  // Input
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
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    padding: 0,
  },
  inputIconBadge: {
    width: 32,
    height: 32,
    backgroundColor: '#ffece6',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputIconText: { fontSize: 16 },

  // Suggestion
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    gap: 10,
  },
  suggestionText: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
    lineHeight: 16,
  },
  suggestionHighlight: {
    color: '#ff6b6b',
    fontWeight: '900',
  },
  suggestButton: {
    backgroundColor: '#c8e6c9',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestButtonText: {
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },

  // Adaptive
  adaptiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adaptiveFlex: {
    fontFamily: FONT,
    fontSize: 8,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
  },
  adaptiveCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    padding: 14,
  },
  adaptiveText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    marginRight: 10,
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
