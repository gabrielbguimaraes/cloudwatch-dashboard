/**
 * CloudWatch Dashboard - Root Application Component
 * Aluno: João Gabriel Barros Guimarães (RA: 1461392411007)
 * FATEC Prof. Dr. Eng. Gerson Penha - 4DSM
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CloudProviderComponent } from './src/context/CloudContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#070B14" />
      <AuthProvider>
        <CloudProviderComponent>
          <AppNavigator />
        </CloudProviderComponent>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
