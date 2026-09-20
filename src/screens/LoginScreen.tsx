/**
 * CloudWatch Dashboard - Tela de Login (LoginScreen)
 * Foco Primário: Oracle Cloud Infrastructure (OCI)
 * Identidade Visual: Deep Obsidian Black & Electric Blue Neon
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useCloud } from '../context/CloudContext';
import type { CloudProvider } from '../types';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { selectedLoginProvider, setSelectedLoginProvider, loginWithCredentials, loginWithBiometrics, isLoading } = useAuth();
  const { isSimulationMode, setSimulationMode } = useCloud();

  const [keyId, setKeyId] = useState('ocid1.user.oc1..aaaaaaaax74n9b2k');
  const [secretKey, setSecretKey] = useState('••••••••••••••••••••••••');

  const handleProviderChange = (provider: CloudProvider) => {
    setSelectedLoginProvider(provider);
    if (provider === 'OCI') {
      setKeyId('ocid1.user.oc1..aaaaaaaax74n9b2k');
    } else if (provider === 'AWS') {
      setKeyId('AKIAIOSFODNN7EXAMPLE');
    } else {
      setKeyId('gcp-service-account@iam.gserviceaccount.com');
    }
  };

  const handleLogin = async () => {
    const success = await loginWithCredentials(keyId, secretKey);
    if (success) {
      navigation.replace('MainTabs');
    }
  };

  const handleBiometrics = async () => {
    const success = await loginWithBiometrics();
    if (success) {
      navigation.replace('MainTabs');
    }
  };

  const handleQrScan = () => {
    Alert.alert(
      '📷 Leitor de QR Code (Câmera)',
      'Aponte a câmera para escanear credenciais da Oracle Cloud ou AWS.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Simular Leitura OCI',
          onPress: async () => {
            await loginWithCredentials(keyId, secretKey);
            navigation.replace('MainTabs');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header com Logo Futurista Hexagonal */}
        <View style={styles.logoSection}>
          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              <Text style={styles.logoIcon}>⚡</Text>
            </View>
          </View>
          <Text style={styles.appTitle}>
            Cloud<Text style={styles.appTitleHighlight}>Watch</Text>
          </Text>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>OCI FIRST • MULTI-CLOUD</Text>
          </View>
          <Text style={styles.appSubtitle}>
            Painel Mobile: Oracle OCI • AWS • Google Cloud
          </Text>
        </View>

        {/* Seleção de Provedor (Oracle OCI Ativo por Padrão) */}
        <View style={styles.providerSelector}>
          <TouchableOpacity
            style={[
              styles.providerBtn,
              selectedLoginProvider === 'OCI' && styles.providerBtnOciActive,
            ]}
            onPress={() => handleProviderChange('OCI')}
          >
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text
              style={[
                styles.providerBtnText,
                selectedLoginProvider === 'OCI' && styles.providerBtnTextActive,
              ]}
            >
              Oracle OCI
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.providerBtn,
              selectedLoginProvider === 'AWS' && styles.providerBtnAwsActive,
            ]}
            onPress={() => handleProviderChange('AWS')}
          >
            <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
            <Text
              style={[
                styles.providerBtnText,
                selectedLoginProvider === 'AWS' && styles.providerBtnTextActive,
              ]}
            >
              AWS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.providerBtn,
              selectedLoginProvider === 'GCP' && styles.providerBtnGcpActive,
            ]}
            onPress={() => handleProviderChange('GCP')}
          >
            <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
            <Text
              style={[
                styles.providerBtnText,
                selectedLoginProvider === 'GCP' && styles.providerBtnTextActive,
              ]}
            >
              GCP
            </Text>
          </TouchableOpacity>
        </View>

        {/* Inputs de Credenciais */}
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {selectedLoginProvider === 'OCI' ? 'USER OCID / FINGERPRINT' : 'ACCESS KEY ID'}
            </Text>
            <TextInput
              style={styles.input}
              value={keyId}
              onChangeText={setKeyId}
              placeholderTextColor="#64748B"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PRIVATE KEY PEM / SECRET TOKEN</Text>
            <TextInput
              style={styles.input}
              value={secretKey}
              onChangeText={setSecretKey}
              secureTextEntry
              placeholderTextColor="#64748B"
            />
          </View>

          {/* Toggle Modo Simulação Faker */}
          <View style={styles.simCard}>
            <View>
              <Text style={styles.simTitle}>Modo Simulação (@faker-js/faker)</Text>
              <Text style={styles.simDesc}>Testar sem custos com nuvem real</Text>
            </View>
            <Switch
              value={isSimulationMode}
              onValueChange={setSimulationMode}
              trackColor={{ false: '#334155', true: colors.neonBlue }}
              thumbColor={isSimulationMode ? colors.neonCyan : '#f4f3f4'}
            />
          </View>

          {/* Botão Entrar */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginBtnText}>Conectar ao Dashboard →</Text>
            )}
          </TouchableOpacity>

          {/* Divisor de Hardware */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>RECURSOS DE HARDWARE</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Atalhos de Hardware: Câmera QR e Biometria */}
          <View style={styles.hardwareRow}>
            <TouchableOpacity style={styles.hardwareBtn} onPress={handleQrScan}>
              <Text style={styles.hardwareBtnIcon}>📷</Text>
              <Text style={styles.hardwareBtnText}>Ler QR Code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hardwareBtn} onPress={handleBiometrics}>
              <Text style={styles.hardwareBtnIcon}>👆</Text>
              <Text style={styles.hardwareBtnText}>Biometria</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Rodapé Acadêmico */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            João Gabriel Barros Guimarães • 4DSM • FATEC-SJC
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 24,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  logoOuter: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#0F1E36',
    borderWidth: 2,
    borderColor: '#38BDF860',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.neonBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  logoInner: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#070D1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 28,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 12,
    letterSpacing: -0.5,
  },
  appTitleHighlight: {
    color: colors.neonCyan,
  },
  badgeContainer: {
    marginTop: 4,
    backgroundColor: '#0066FF20',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0066FF40',
  },
  badgeText: {
    color: colors.neonElectric,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  appSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
  providerSelector: {
    flexDirection: 'row',
    backgroundColor: '#0B1220',
    borderRadius: 14,
    padding: 4,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  providerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  providerBtnOciActive: {
    backgroundColor: '#C74634',
  },
  providerBtnAwsActive: {
    backgroundColor: '#B45309',
  },
  providerBtnGcpActive: {
    backgroundColor: '#1D4ED8',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  providerBtnText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  providerBtnTextActive: {
    color: '#FFFFFF',
  },
  formCard: {
    marginTop: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  simCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0066FF15',
    borderWidth: 1,
    borderColor: '#0066FF30',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  simTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  simDesc: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  loginBtn: {
    backgroundColor: colors.neonBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.neonBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E293B',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  hardwareRow: {
    flexDirection: 'row',
    gap: 12,
  },
  hardwareBtn: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  hardwareBtnIcon: {
    fontSize: 14,
  },
  hardwareBtnText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#0F172A',
  },
  footerText: {
    color: '#64748B',
    fontSize: 10,
  },
});
