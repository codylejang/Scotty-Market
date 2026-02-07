import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, ScrollView, View, Text } from 'react-native';

import { useApp } from '@/context/AppContext';
import AchievementCard from '@/components/AchievementCard';

export default function AchievementsModal() {
  const { achievements, completeAchievement, dismissAchievement } = useApp();

  const activeAchievements = achievements.filter((a) => !a.completed);
  const completedAchievements = achievements.filter((a) => a.completed);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Active Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Goals</Text>
          <Text style={styles.sectionSubtitle}>
            Complete these to earn credits for Scotty!
          </Text>

          {activeAchievements.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyText}>
                No active goals. Check back soon for new AI-generated challenges!
              </Text>
            </View>
          ) : (
            activeAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                onComplete={completeAchievement}
                onDismiss={dismissAchievement}
              />
            ))
          )}
        </View>

        {/* Completed Goals */}
        {completedAchievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed</Text>
            <Text style={styles.sectionSubtitle}>
              Great job on these achievements!
            </Text>

            {completedAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
              />
            ))}
          </View>
        )}
      </View>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
