import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, Platform } from 'react-native';

import { SplashScreen } from '../screens/SplashScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MetricsDetailScreen } from '../screens/MetricsDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NEUTRAL_THEME, CLOUD_PALETTES } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs: React.FC = () => {
  const { activeProvider } = useAuth();
  const activeColor = CLOUD_PALETTES[activeProvider]?.primary || '#8AB4F8';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: NEUTRAL_THEME.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'PAINEL',
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.tabIconBadge, focused && { borderColor: color, backgroundColor: '#20242C' }]}>
              <Text style={[styles.tabIconText, { color }]}>DSH</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="MetricsDetail"
        component={MetricsDetailScreen}
        options={{
          tabBarLabel: 'METRICAS',
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.tabIconBadge, focused && { borderColor: color, backgroundColor: '#20242C' }]}>
              <Text style={[styles.tabIconText, { color }]}>MTR</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'GOVERNANCA',
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.tabIconBadge, focused && { borderColor: color, backgroundColor: '#20242C' }]}>
              <Text style={[styles.tabIconText, { color }]}>GOV</Text>
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: NEUTRAL_THEME.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="MetricsDetailModal" component={MetricsDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: NEUTRAL_THEME.surfaceCard,
    borderTopColor: NEUTRAL_THEME.borderDefault,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  tabIconBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
});
