import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { HealthMetrics } from '../types';
import AnimatedProgressBar from './AnimatedProgressBar';

interface HealthTabProps {
  healthMetrics: HealthMetrics;
  onStartGoal: () => void;
  onCreateBudget: () => void;
}

const CALENDAR_DAYS = [
  [null, null, null, null, null, 1, 2],
  [3, 4, 5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14, 15, 16],
  [17, 18, 19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28, 29, 30],
];

const BILL_DAYS = [5, 12, 21]; // Days with bills due
const TODAY = 7;

export default function HealthTab({ healthMetrics, onStartGoal, onCreateBudget }: HealthTabProps) {
  const healthGrade = healthMetrics.overallScore >= 80 ? 'A' : healthMetrics.overallScore >= 60 ? 'B' : 'C';
  const healthPct = `${healthMetrics.overallScore}%`;

  return (
    <View style={styles.container}>
      {/* Health Speech Bubble */}
      <View style={styles.speechCard}>
        <View style={styles.speechAvatar}>
          <Text style={styles.speechAvatarText}>🐕</Text>
        </View>
        <View style={styles.speechContent}>
          <Text style={styles.speechText}>
            I say your health is <Text style={styles.speechBold}>{healthPct}!</Text>
          </Text>
          <Text style={styles.speechSub}>
            KEEP THOSE DIGITS MOVING, HUMAN! YOU'RE CRUSHING IT!
          </Text>
        </View>
      </View>

      {/* Bill Calendar */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>📅</Text>
        <Text style={styles.sectionTitle}>Bill Calendar</Text>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Text style={styles.calendarMonth}>OCTOBER 2023</Text>
          <View style={styles.calendarNav}>
            <Text style={styles.calendarNavText}>◀ ▶</Text>
          </View>
        </View>

        {/* Day headers */}
        <View style={styles.calendarRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <View key={i} style={styles.calendarCell}>
              <Text style={styles.calendarDayHeader}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        {CALENDAR_DAYS.map((week, wi) => (
          <View key={wi} style={styles.calendarRow}>
            {week.map((day, di) => {
              const isBill = day !== null && BILL_DAYS.includes(day);
              const isToday = day === TODAY;
              return (
                <View
                  key={di}
                  style={[
                    styles.calendarCell,
                    isToday && styles.calendarCellToday,
                    isBill && styles.calendarCellBill,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      isToday && styles.calendarDayToday,
                      isBill && styles.calendarDayBill,
                    ]}
                  >
                    {day ?? ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        {/* Due today */}
        <View style={styles.dueTodaySection}>
          <Text style={styles.dueTodayLabel}>DUE TODAY</Text>
          <View style={styles.dueChipRow}>
            <View style={[styles.dueChip, { backgroundColor: '#ff6b6b' }]}>
              <Text style={styles.dueChipIcon}>🎬</Text>
              <View>
                <Text style={styles.dueChipName}>CINEMA+</Text>
                <Text style={styles.dueChipAmount}>$4.99</Text>
              </View>
            </View>
            <View style={[styles.dueChip, { backgroundColor: '#e1bee7' }]}>
              <Text style={styles.dueChipIcon}>🎵</Text>
              <View>
                <Text style={styles.dueChipName}>MUSIC</Text>
                <Text style={styles.dueChipAmount}>$1.99</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Health Metrics */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>💪</Text>
        <Text style={styles.sectionTitle}>Health Metrics</Text>
      </View>

      {/* Animated loading bar */}
      <View style={styles.metricsLoadingBar}>
        <AnimatedProgressBar
          targetPercent={healthMetrics.overallScore}
          color="#ff6b6b"
          delay={200}
          height={8}
          small
        />
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>SAVINGS RATE</Text>
          <Text style={styles.metricValue}>{healthMetrics.savingsRate}%</Text>
          <Text style={styles.metricSubtext}>HEALTHY & GROWING!</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>DEBT RATIO</Text>
          <Text style={styles.metricValue}>15%</Text>
          <Text style={styles.metricSubtext}>MANAGEABLE, HUMAN</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>ADHERENCE</Text>
          <Text style={styles.metricValue}>{healthMetrics.budgetAdherence}%</Text>
          <Text style={styles.metricSubtext}>ON TARGET!</Text>
          <View style={styles.metricBarWrapper}>
            <AnimatedProgressBar
              targetPercent={healthMetrics.budgetAdherence}
              color="#9b59b6"
              delay={400}
              height={6}
              small
            />
          </View>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>CONSISTENCY</Text>
          <Text style={styles.metricValueWord}>High</Text>
          <Text style={styles.metricSubtext}>GOOD FLOW!</Text>
          <View style={styles.metricBarWrapper}>
            <AnimatedProgressBar
              targetPercent={85}
              color="#4caf50"
              delay={600}
              height={6}
              small
            />
          </View>
        </View>
      </View>

      {/* CTA Buttons */}
      <TouchableOpacity style={styles.ctaCard} onPress={onStartGoal} activeOpacity={0.7}>
        <View style={styles.ctaContent}>
          <Text style={styles.ctaIcon}>🎯</Text>
          <View>
            <Text style={styles.ctaTitle}>START A GOAL</Text>
            <Text style={styles.ctaSub}>Scotty will break it down</Text>
          </View>
        </View>
        <Text style={styles.ctaArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ctaCardDark} onPress={onCreateBudget} activeOpacity={0.7}>
        <View style={styles.ctaContent}>
          <Text style={styles.ctaIcon}>🐾</Text>
          <View>
            <Text style={styles.ctaTitleLight}>CREATE BUDGET</Text>
            <Text style={styles.ctaSubLight}>Set the human rules</Text>
          </View>
        </View>
        <Text style={styles.ctaArrowLight}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

const FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },

  // Speech
  speechCard: {
    flexDirection: 'row',
    backgroundColor: '#c8e6c9',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  speechAvatar: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  speechAvatarText: { fontSize: 20 },
  speechContent: { flex: 1 },
  speechText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    lineHeight: 18,
  },
  speechBold: {
    fontWeight: '900',
    color: '#ff6b6b',
    fontSize: 14,
  },
  speechSub: {
    fontFamily: FONT,
    fontSize: 8,
    color: '#333',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 4,
    gap: 6,
  },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },

  // Calendar
  calendarCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarMonth: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  calendarNav: {
    flexDirection: 'row',
  },
  calendarNavText: {
    fontFamily: FONT,
    fontSize: 12,
    color: '#999',
  },
  calendarRow: {
    flexDirection: 'row',
  },
  calendarCell: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  calendarCellToday: {
    backgroundColor: '#000',
    borderRadius: 8,
  },
  calendarCellBill: {
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
  },
  calendarDayHeader: {
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: '900',
    color: '#999',
  },
  calendarDayText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  calendarDayToday: {
    color: '#fff',
  },
  calendarDayBill: {
    color: '#fff',
    fontWeight: '900',
  },

  // Due today
  dueTodaySection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  dueTodayLabel: {
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 8,
  },
  dueChipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flex: 1,
  },
  dueChipIcon: { fontSize: 18 },
  dueChipName: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  dueChipAmount: {
    fontFamily: FONT,
    fontSize: 9,
    color: '#333',
  },

  // Metrics loading bar
  metricsLoadingBar: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  metricLabel: {
    fontFamily: FONT,
    fontSize: 8,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
  },
  metricValueWord: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
  },
  metricSubtext: {
    fontFamily: FONT,
    fontSize: 7,
    color: '#999',
    fontStyle: 'italic',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  metricBarWrapper: {
    marginTop: 8,
  },

  // CTA Cards
  ctaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  ctaCardDark: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctaIcon: { fontSize: 20 },
  ctaTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  ctaTitleLight: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  ctaSub: {
    fontFamily: FONT,
    fontSize: 9,
    color: '#999',
    fontStyle: 'italic',
  },
  ctaSubLight: {
    fontFamily: FONT,
    fontSize: 9,
    color: '#999',
    fontStyle: 'italic',
  },
  ctaArrow: {
    fontFamily: FONT,
    fontSize: 20,
    color: '#000',
  },
  ctaArrowLight: {
    fontFamily: FONT,
    fontSize: 20,
    color: '#fff',
  },
});
