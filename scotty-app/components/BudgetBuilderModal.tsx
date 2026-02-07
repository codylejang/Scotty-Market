import React, { useEffect, useMemo, useState } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { createBudget, updateBudget } from '../services/api';
import { BudgetItem } from '../types';

interface BudgetBuilderModalProps {
  visible: boolean;
  onClose: () => void;
}

type BudgetFrequency = BudgetItem['frequency'];

type BudgetDraft = {
  limit: string;
  frequency: BudgetFrequency;
  adaptiveEnabled: boolean;
};

const CATEGORIES: { category: string; label: string; icon: string }[] = [
  { category: 'Food & Drink', label: 'FOOD & DRINK', icon: '🍴' },
  { category: 'Groceries', label: 'GROCERIES', icon: '🥬' },
  { category: 'Transportation', label: 'TRANSPORT', icon: '🚌' },
  { category: 'Entertainment', label: 'FUN', icon: '🎬' },
  { category: 'Shopping', label: 'SHOPPING', icon: '🛍️' },
  { category: 'Health', label: 'SELF CARE', icon: '🌿' },
  { category: 'Subscription', label: 'SUBSCRIPTIONS', icon: '💳' },
];

const FREQUENCIES: Array<{ label: string; value: BudgetFrequency }> = [
  { label: 'DAILY', value: 'Day' },
  { label: 'MONTHLY', value: 'Month' },
  { label: 'YEARLY', value: 'Year' },
];

function formatFrequencyLabel(frequency: BudgetFrequency): string {
  if (frequency === 'Day') return 'Daily';
  if (frequency === 'Year') return 'Yearly';
  return 'Monthly';
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildDrafts(existingBudgets: BudgetItem[]): Record<string, BudgetDraft> {
  const map = new Map(existingBudgets.map((b) => [b.category, b]));
  const drafts: Record<string, BudgetDraft> = {};

  for (const item of CATEGORIES) {
    const budget = map.get(item.category);
    drafts[item.category] = {
      limit: budget ? String(roundMoney(budget.limitAmount)) : '',
      frequency: budget?.frequency || 'Month',
      adaptiveEnabled: budget?.adaptiveEnabled ?? true,
    };
  }

  return drafts;
}

export default function BudgetBuilderModal({ visible, onClose }: BudgetBuilderModalProps) {
  const { budgets, refreshBudgets } = useApp();
  const [drafts, setDrafts] = useState<Record<string, BudgetDraft>>({});
  const [submitting, setSubmitting] = useState(false);

  const existingByCategory = useMemo(
    () => new Map(budgets.map((budget) => [budget.category, budget])),
    [budgets],
  );

  useEffect(() => {
    if (!visible) return;
    setDrafts(buildDrafts(budgets));
  }, [visible, budgets]);

  const setDraft = (category: string, patch: Partial<BudgetDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...patch,
      },
    }));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const mutations: Promise<any>[] = [];

    for (const category of CATEGORIES) {
      const draft = drafts[category.category];
      if (!draft) continue;

      const trimmed = draft.limit.trim();
      if (!trimmed) continue;

      const amount = parseFloat(trimmed);
      if (!amount || amount <= 0) {
        Alert.alert('Invalid amount', `Please enter a valid budget for ${category.label}.`);
        return;
      }

      const normalizedAmount = roundMoney(amount);
      const existing = existingByCategory.get(category.category);

      if (existing) {
        const changed =
          Math.abs(existing.limitAmount - normalizedAmount) > 0.009 ||
          existing.frequency !== draft.frequency ||
          (existing.adaptiveEnabled ?? true) !== draft.adaptiveEnabled;

        if (changed) {
          mutations.push(updateBudget(existing.id, {
            limitAmount: normalizedAmount,
            frequency: draft.frequency,
            adaptiveEnabled: draft.adaptiveEnabled,
            adaptiveMaxAdjustPct: existing.adaptiveMaxAdjustPct || 10,
          }));
        }
      } else {
        mutations.push(createBudget(
          category.category,
          normalizedAmount,
          draft.frequency,
          draft.adaptiveEnabled,
          10,
        ));
      }
    }

    if (mutations.length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await Promise.all(mutations);
      await refreshBudgets();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save budgets.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>
          <View style={styles.modal}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Budget Builder</Text>
              <Text style={styles.subtitle}>MODIFY YOUR LIMITS</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {CATEGORIES.map((item) => {
                const draft = drafts[item.category];
                if (!draft) return null;

                const existing = existingByCategory.get(item.category);
                const existingText = existing
                  ? `Current: $${roundMoney(existing.limitAmount).toFixed(2)} / ${formatFrequencyLabel(existing.frequency)}`
                  : 'Current: Not set';

                return (
                  <View key={item.category} style={styles.categoryCard}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryTitle}>{item.icon} {item.label}</Text>
                      <Text style={styles.existingText}>{existingText}</Text>
                    </View>

                    <View style={styles.inputRow}>
                      <Text style={styles.inputPrefix}>$</Text>
                      <TextInput
                        style={styles.input}
                        value={draft.limit}
                        onChangeText={(text) => setDraft(item.category, { limit: text })}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#aaa"
                      />
                    </View>

                    <View style={styles.periodRow}>
                      {FREQUENCIES.map((freq) => (
                        <TouchableOpacity
                          key={`${item.category}-${freq.value}`}
                          style={[
                            styles.periodChip,
                            draft.frequency === freq.value && styles.periodChipActive,
                          ]}
                          onPress={() => setDraft(item.category, { frequency: freq.value })}
                        >
                          <Text
                            style={[
                              styles.periodText,
                              draft.frequency === freq.value && styles.periodTextActive,
                            ]}
                          >
                            {freq.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.adaptiveRow}>
                      <Text style={styles.adaptiveText}>Adaptive mode</Text>
                      <Switch
                        value={draft.adaptiveEnabled}
                        onValueChange={(value) => setDraft(item.category, { adaptiveEnabled: value })}
                        trackColor={{ false: '#ddd', true: '#81d4fa' }}
                        thumbColor="#fff"
                      />
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>SAVE BUDGET CHANGES</Text>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '88%',
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
  header: {
    marginBottom: 18,
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
    color: '#777',
    letterSpacing: 1,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  categoryHeader: {
    marginBottom: 10,
  },
  categoryTitle: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  existingText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  inputPrefix: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '900',
    marginRight: 4,
    color: '#000',
  },
  input: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    padding: 0,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  periodChip: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  periodChipActive: {
    backgroundColor: '#fff9c4',
  },
  periodText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  periodTextActive: {
    color: '#000',
  },
  adaptiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adaptiveText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  submitButton: {
    marginTop: 8,
    backgroundColor: '#ff6b6b',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.8,
  },
});
