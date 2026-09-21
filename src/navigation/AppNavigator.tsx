
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MetricsDetailScreen } from '../screens/MetricsDetailScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.neonCyan,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Geral',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="MetricsDetail"
        component={MetricsDetailScreen}
        options={{
          tabBarLabel: 'Métricas',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>📈</Text>,
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#070C18',
    borderTopColor: '#172554',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});
