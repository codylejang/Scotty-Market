import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Colors, Shadows } from '@/constants/Theme';

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '🏠',
    graph: '📊',
    chat: '💬',
  };

  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>
        {icons[name] || '•'}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.ink,
        tabBarInactiveTintColor: `${Colors.ink}4D`, // 30% opacity
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: "SCOTTY'S HOME",
          headerTitleAlign: 'left',
          tabBarIcon: ({ focused }) => <TabBarIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Graph',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabBarIcon name="graph" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          headerTitle: 'CHAT WITH SCOTTY',
          headerTitleAlign: 'left',
          tabBarIcon: ({ focused }) => <TabBarIcon name="chat" focused={focused} />,
          tabBarBadge: '',
          tabBarBadgeStyle: styles.chatBadge,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: `${Colors.paper}F2`, // 95% opacity
    borderTopWidth: 2,
    borderTopColor: Colors.ink,
    paddingTop: 12,
    paddingBottom: 24,
    height: 80,
  },
  tabBarLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  tabBarItem: {
    gap: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
    opacity: 0.3,
  },
  iconFocused: {
    opacity: 1,
  },
  header: {
    backgroundColor: Colors.paper,
    borderBottomWidth: 0,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: Colors.ink,
  },
  badgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 16,
    gap: 6,
    ...Shadows.sketchSm,
  },
  badgeIcon: {
    fontSize: 16,
  },
  badgeText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink,
  },
  profileContainer: {
    marginLeft: 16,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.ink,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sketchSm,
  },
  profileEmoji: {
    fontSize: 20,
  },
  chatBadge: {
    backgroundColor: Colors.coral,
    borderWidth: 1,
    borderColor: Colors.ink,
    minWidth: 8,
    height: 8,
    borderRadius: 4,
    top: 2,
    right: 2,
  },
});
