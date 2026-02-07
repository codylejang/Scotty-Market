import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Quest, GoalData } from '../types';

function ModalQuestCard({ quest, onDelete }: { quest: Quest; onDelete?: (id: string) => void }) {
  const [showInfo, setShowInfo] = useState(false);
  const progressPercent = quest.goal > 0 ? (quest.progress / quest.goal) * 100 : 0;
  const isComplete = quest.goal > 0 && quest.progress >= quest.goal;

  return (
    <View style={styles.questCard}>
      <View style={styles.questContent}>
        {/* Icon Section */}
        <View style={styles.iconSection}>
          {onDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete(quest.id)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.deleteButtonText}>🗑</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.iconBox, { backgroundColor: quest.bgColor }]}>
            <Text style={styles.iconEmoji}>{quest.emoji}</Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <View style={styles.questHeader}>
            <Text style={styles.questTitle}>{quest.title}</Text>
            <Text style={styles.xpReward}>+{quest.xpReward} XP</Text>
          </View>
          <Text style={styles.questSubtitle}>{quest.subtitle}</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(progressPercent, 100)}%` },
                ]}
              />
            </View>
          </View>
          <Text
            style={[
              styles.progressText,
              isComplete && styles.progressTextComplete,
            ]}
          >
            {quest.progress}/{quest.goal} {quest.progressUnit}
          </Text>
          {showInfo && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>{quest.subtitle}</Text>
              {quest.goalTarget ? (
                <Text style={styles.infoBoxGoal}>Contributes to: {quest.goalTarget}</Text>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

interface ScottyQuestsModalProps {
  visible: boolean;
  onClose: () => void;
  quests: Quest[];
  goals?: GoalData[];
  onRefreshQuests?: () => void;
  onDeleteQuest?: (id: string) => void;
}

export default function ScottyQuestsModal({
  visible,
  onClose,
  quests,
  goals = [],
  onRefreshQuests,
  onDeleteQuest,
}: ScottyQuestsModalProps) {
  const [showRefreshNotification, setShowRefreshNotification] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState('12:45:00');

  const hasGoals = goals.length > 0;

  // Filter to goal-linked quests only (Scotty's Quests are for saving toward goals)
  const scottyQuests = useMemo(() => {
    return quests.filter((q) => q.createdBy === 'goal_workshop');
  }, [quests]);

  // Calculate time until midnight reset
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);

      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilReset(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshQuests = () => {
    setShowRefreshNotification(true);
    onRefreshQuests?.();
    setTimeout(() => setShowRefreshNotification(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>SCOTTY'S QUESTS</Text>
              <Text style={styles.subtitle}>LIVE TRACKING ENABLED</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <View style={styles.closeIcon}>
                <Text style={styles.closeText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Quest List */}
          <ScrollView
            style={styles.questList}
            contentContainerStyle={styles.questListContent}
            showsVerticalScrollIndicator={false}
          >
            {hasGoals && scottyQuests.length > 0 ? (
              scottyQuests.map((quest) => (
                <ModalQuestCard key={quest.id} quest={quest} onDelete={onDeleteQuest} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🐾</Text>
                <Text style={styles.emptyText}>
                  {hasGoals ? 'No quests yet!' : 'No goals set!'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {hasGoals
                    ? 'Tap the button below to generate quests for your savings goals.'
                    : 'Set a savings goal first, then Scotty will create quests to help you reach it.'}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefreshQuests}
              disabled={!hasGoals}
            >
              <LinearGradient
                colors={hasGoals ? ['#ff6b6b', '#9b59b6'] : ['#ccc', '#aaa']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.refreshGradient}
              >
                <Text style={styles.refreshButtonText}>GET NEW SCOTTY QUESTS</Text>
              </LinearGradient>
              {showRefreshNotification && (
                <View style={styles.notification}>
                  <Text style={styles.notificationText}>QUESTS UPDATED!</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.resetTimer}>RESETS IN {timeUntilReset}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff6f3',
    borderWidth: 4,
    borderColor: '#000',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  title: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 2,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  closeText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  },

  // Quest List
  questList: {
    flex: 1,
  },
  questListContent: {
    padding: 16,
  },
  questCard: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  questContent: {
    flexDirection: 'row',
    padding: 16,
  },

  // Icon Section
  iconSection: {
    alignItems: 'center',
    marginRight: 12,
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff9c4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  infoButtonText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  iconBox: {
    width: 80,
    height: 80,
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 40,
  },

  // Details Section
  detailsSection: {
    flex: 1,
  },
  questHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  questTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    flex: 1,
  },
  xpReward: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#9b59b6',
    marginLeft: 8,
  },
  questSubtitle: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 6,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ff6b6b',
  },
  progressText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#ff6b6b',
  },
  progressTextComplete: {
    color: '#4caf50',
  },

  // Footer
  footer: {
    padding: 16,
    borderTopWidth: 3,
    borderTopColor: '#000',
  },
  refreshButton: {
    position: 'relative',
    marginBottom: 12,
  },
  refreshGradient: {
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#000',
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  refreshButtonText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  notification: {
    position: 'absolute',
    right: -8,
    top: -8,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  notificationText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  resetTimer: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textAlign: 'center',
    letterSpacing: 1,
  },
  infoBox: {
    marginTop: 10,
    backgroundColor: '#fff9c4',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    padding: 10,
  },
  infoBoxText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    lineHeight: 16,
  },
  infoBoxGoal: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '700',
    color: '#9b59b6',
    marginTop: 6,
    letterSpacing: 0.5,
  },

  // Delete Button
  deleteButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  deleteButtonText: {
    fontSize: 18,
    opacity: 0.4,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});
