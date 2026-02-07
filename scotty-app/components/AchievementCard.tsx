import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Achievement } from '../types';

interface AchievementCardProps {
  achievement: Achievement;
  onComplete?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  food_dining: '🍔',
  groceries: '🛒',
  transport: '🚗',
  entertainment: '🎮',
  shopping: '🛍️',
  subscriptions: '📱',
  utilities: '💡',
  education: '📚',
  health: '💊',
  other: '💰',
};

export function AchievementCard({
  achievement,
  onComplete,
  onDismiss,
}: AchievementCardProps) {
  const icon = achievement.category
    ? CATEGORY_ICONS[achievement.category]
    : '🎯';

  const progress = achievement.targetAmount && achievement.currentAmount
    ? Math.min(100, (achievement.currentAmount / achievement.targetAmount) * 100)
    : null;

  return (
    <View style={[styles.card, achievement.completed && styles.cardCompleted]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{achievement.title}</Text>
          {achievement.aiGenerated && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✨ AI</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.description}>{achievement.description}</Text>

      {progress !== null && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%` },
                achievement.completed && styles.progressComplete,
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            ${achievement.currentAmount?.toFixed(0)} / ${achievement.targetAmount?.toFixed(0)}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {!achievement.completed && onComplete && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => onComplete(achievement.id)}
          >
            <Text style={styles.completeButtonText}>✓ Complete</Text>
          </TouchableOpacity>
        )}

        {onDismiss && !achievement.completed && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => onDismiss(achievement.id)}
          >
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        )}

        {achievement.completed && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>🎉 Completed!</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  aiBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  progressComplete: {
    backgroundColor: '#22C55E',
  },
  progressText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  completeButton: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  dismissButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dismissButtonText: {
    color: '#6B7280',
    fontWeight: '500',
    fontSize: 14,
  },
  completedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  completedText: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default AchievementCard;
