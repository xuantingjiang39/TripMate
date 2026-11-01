import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { LiveNavigationScreen } from '../screens/LiveNavigationScreen';
import { PlanScreen } from '../screens/PlanScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { TripsScreen } from '../screens/TripsScreen';
import { TripDetailScreen } from '../screens/TripDetailScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../theme';

export type MainTabParamList = { Today: undefined; Plan: undefined; Trips: undefined; Profile: undefined };
export type RootStackParamList = { Main: NavigatorScreenParams<MainTabParamList> | undefined; LiveNavigation: undefined; TripDetail: undefined };

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const expanded = useWindowDimensions().width >= 840;
  const icons: Record<keyof MainTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
    Today: ['today-outline', 'today'], Plan: ['sparkles-outline', 'sparkles'], Trips: ['albums-outline', 'albums'], Profile: ['person-circle-outline', 'person-circle'],
  };
  const titles: Record<keyof MainTabParamList, string> = { Today: '今天', Plan: '规划', Trips: '行程', Profile: '我的' };
  return <Tab.Navigator screenOptions={({ route }) => ({
    headerTitle: titles[route.name], headerShadowVisible: false,
    headerStyle: { backgroundColor: p.background }, headerTintColor: p.text,
    headerTitleStyle: { fontWeight: '700' },
    tabBarActiveTintColor: p.primary, tabBarInactiveTintColor: p.muted,
    tabBarPosition: expanded ? 'left' : 'bottom',
    tabBarLabelPosition: expanded ? 'beside-icon' : 'below-icon',
    tabBarStyle: expanded
      ? { backgroundColor: p.surface, borderRightColor: p.border, width: 180, paddingTop: 16 }
      : { backgroundColor: p.surface, borderTopColor: p.border, height: Platform.OS === 'android' ? 60 + Math.max(insets.bottom, 8) : undefined, paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 8) : undefined, paddingTop: 6 },
    tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    tabBarIcon: ({ color, size, focused }) => <Ionicons name={icons[route.name][focused ? 1 : 0]} color={color} size={size} />,
  })}>
    <Tab.Screen name="Today" component={TodayScreen} />
    <Tab.Screen name="Plan" component={PlanScreen} />
    <Tab.Screen name="Trips" component={TripsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>;
}

export function RootNavigator() {
  const p = usePalette();
  return <Stack.Navigator screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: p.background }, headerTintColor: p.text, contentStyle: { backgroundColor: p.background } }}>
    <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen name="LiveNavigation" component={LiveNavigationScreen} options={{ title: '地图导航', presentation: 'card' }} />
    <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: '完整攻略' }} />
  </Stack.Navigator>;
}
