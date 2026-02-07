import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'expo-router';
import Scotty from '@/components/Scotty';
import PawLoader from '@/components/PawLoader';
import TutorialModal from '@/components/TutorialModal';
import { TUTORIAL_STEPS } from '@/constants/Tutorial';
import { ChatMessage, ChatAction, ChatActionIcon, ChatActionCategory } from '@/types';
import { Colors, Shadows } from '@/constants/Theme';

const ICON_MAP: Record<ChatActionIcon, string> = {
  wallet: '\u{1F4B0}',
  savings: '\u{1F3E6}',
  trophy: '\u{1F3C6}',
  receipt: '\u{1F9FE}',
  alert: '\u{26A0}\u{FE0F}',
  chart: '\u{1F4CA}',
};

const CATEGORY_COLORS: Record<ChatActionCategory, string> = {
  finances: Colors.coral,
  budget: Colors.violet,
  goal: Colors.accentBlue,
  spending: '#ffab91',
};

const DEFAULT_ACTIONS: ChatAction[] = [
  {
    id: 'default_finances',
    label: 'My Finances',
    icon: 'wallet',
    category: 'finances',
    prompt: 'Give me an overview of my finances this week',
  },
  {
    id: 'default_budget',
    label: 'Budget Check',
    icon: 'savings',
    category: 'budget',
    prompt: 'How am I doing against my budgets?',
  },
  {
    id: 'default_goal',
    label: 'Save More',
    icon: 'trophy',
    category: 'goal',
    prompt: 'What are some ways I can save more money?',
  },
  {
    id: 'default_spending',
    label: 'Top Spending',
    icon: 'chart',
    category: 'spending',
    prompt: 'What are my top expenses this week?',
  },
];

export default function ChatScreen() {
  const {
    chatMessages,
    chatActions,
    sendChatMessage,
    loadChatActions,
    tutorial,
    advanceTutorial,
    skipTutorial,
  } = useApp();
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  // Tutorial state
  const currentStep = tutorial.active ? TUTORIAL_STEPS[tutorial.step] : null;
  const isWaitingForChat = currentStep?.waitForChat === true;
  const isChatGoFeed = currentStep?.id === 'chat-go-feed';
  const showTutorial = tutorial.active && currentStep?.screen === 'chat' && !isWaitingForChat && !isChatGoFeed;

  // After Scotty replies, show a continue button after a delay
  const [chatReplyReady, setChatReplyReady] = useState(false);

  // Track message count to detect when Scotty replies during waitForChat
  const prevMsgCount = useRef(chatMessages.length);
  useEffect(() => {
    if (isWaitingForChat && chatMessages.length > prevMsgCount.current) {
      const last = chatMessages[chatMessages.length - 1];
      if (last?.role === 'scotty') {
        // Scotty replied — show continue button after delay, THEN advance step
        const timer = setTimeout(() => {
          setChatReplyReady(true);
          advanceTutorial();
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages.length, isWaitingForChat, advanceTutorial]);

  const handleContinueToFeed = () => {
    setChatReplyReady(false);
    advanceTutorial();
    router.push('/(tabs)/feed');
  };

  const handleTutorialPrimary = () => {
    if (!currentStep) return;
    advanceTutorial();
  };

  // Load contextual actions on mount
  useEffect(() => {
    loadChatActions();
  }, []);

  const activeActions = chatActions.length > 0 ? chatActions : DEFAULT_ACTIONS;

  const handleSend = useCallback(async (text?: string) => {
    const message = (text || inputText).trim();
    if (!message || isLoading) return;

    setInputText('');
    setIsLoading(true);

    try {
      await sendChatMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, sendChatMessage]);

  const handleActionPress = useCallback((action: ChatAction) => {
    handleSend(action.prompt);
  }, [handleSend]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isScotty = item.role === 'scotty';

    return (
      <View
        style={[
          styles.messageRow,
          isScotty ? styles.scottyRow : styles.userRow,
        ]}
      >
        {isScotty && (
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={['#ff6b6b', '#9b59b6']}
              style={styles.avatarGradient}
            >
              <Scotty size={28} />
            </LinearGradient>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isScotty ? styles.scottyBubble : styles.userBubble,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isScotty ? styles.scottyText : styles.userText,
            ]}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SCOTTY CHAT</Text>
        <View style={styles.onlineRow}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>SCOTTY IS ONLINE</Text>
        </View>
      </View>

      {/* Date separator */}
      <View style={styles.dateSeparator}>
        <View style={styles.dateLine} />
        <View style={styles.datePill}>
          <Text style={styles.dateText}>TODAY {dateStr}</Text>
        </View>
        <View style={styles.dateLine} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListFooterComponent={
          isLoading ? (
            <View style={[styles.messageRow, styles.scottyRow]}>
              <View style={styles.avatarWrap}>
                <LinearGradient
                  colors={['#ff6b6b', '#9b59b6']}
                  style={styles.avatarGradient}
                >
                  <Scotty size={28} />
                </LinearGradient>
              </View>
              <View style={[styles.bubble, styles.scottyBubble, styles.thinkingBubble]}>
                <Text style={styles.thinkingLabel}>Scotty is sniffing...</Text>
                <PawLoader size={14} color={Colors.violet} />
              </View>
            </View>
          ) : null
        }
      />

      {/* Bottom Action Panel */}
      <View style={styles.bottomPanel}>
        {/* Action Chips - Horizontal Scrolling */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionChipRow}
          style={styles.actionScroller}
        >
          {activeActions.slice(0, 6).map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.actionChip,
                { borderColor: CATEGORY_COLORS[action.category] || Colors.coral },
              ]}
              onPress={() => handleActionPress(action)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.actionChipIcon}>
                {ICON_MAP[action.icon] || '\u{1F4B0}'}
              </Text>
              <Text
                style={[
                  styles.actionChipLabel,
                  { color: CATEGORY_COLORS[action.category] || Colors.coral },
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input Row */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Scotty anything..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            editable={!isLoading}
            onSubmitEditing={() => handleSend()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.sendButtonText}>
              {isLoading ? '...' : '\u{2191}'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tutorial Modal */}
      <TutorialModal
        visible={!!showTutorial}
        title={currentStep?.title || ''}
        body={currentStep?.body || ''}
        stepIndex={tutorial.step}
        totalSteps={TUTORIAL_STEPS.length}
        primaryLabel={currentStep?.primaryLabel || 'Next'}
        onPrimary={handleTutorialPrimary}
        onSkip={skipTutorial}
      />

      {/* Floating hint during waitForChat */}
      {isWaitingForChat && (
        <View style={styles.chatHintBanner}>
          <Text style={styles.chatHintText}>💬  Tap a prompt chip to ask Scotty!</Text>
        </View>
      )}

      {/* Non-blocking continue button after Scotty replies */}
      {isChatGoFeed && chatReplyReady && (
        <View style={styles.continueBar} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinueToFeed}
            activeOpacity={0.85}
          >
            <Text style={styles.continueText}>← Continue to Feed</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.paper,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: Colors.paper,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ink,
    letterSpacing: 1,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
  },
  onlineText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: '#4caf50',
    letterSpacing: 0.5,
  },

  // Date separator
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: `${Colors.ink}1A`,
  },
  datePill: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: `${Colors.ink}26`,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 12,
  },
  dateText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },

  // Messages
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  scottyRow: {
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  avatarWrap: {
    marginRight: 10,
  },
  avatarGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.ink,
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: Colors.ink,
  },
  scottyBubble: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 3,
    ...Shadows.sketchSm,
  },
  userBubble: {
    backgroundColor: Colors.coral,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 3,
    ...Shadows.sketchSm,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  scottyText: {
    color: Colors.ink,
  },
  userText: {
    color: Colors.white,
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: Colors.white,
    borderTopWidth: 4,
    borderTopColor: Colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },

  // Action chips - horizontal scroll
  actionScroller: {
    maxHeight: 50,
    marginBottom: 12,
  },
  actionChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderRadius: 20,
    backgroundColor: Colors.white,
    ...Shadows.sketchSm,
  },
  actionChipIcon: {
    fontSize: 15,
  },
  actionChipLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
  },

  // Thinking bubble
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  thinkingLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.paper,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: Colors.ink,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sendButton: {
    backgroundColor: Colors.coral,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: Colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sketchSm,
  },
  sendButtonDisabled: {
    backgroundColor: `${Colors.ink}1A`,
    ...Shadows.sketchSm,
    shadowOpacity: 0.3,
  },
  sendButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 20,
  },
  chatHintBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: Colors.violet,
    borderBottomWidth: 2,
    borderBottomColor: Colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  chatHintText: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  continueBar: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  continueButton: {
    backgroundColor: Colors.coral,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 28,
    ...Shadows.sketch,
  },
  continueText: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
});
