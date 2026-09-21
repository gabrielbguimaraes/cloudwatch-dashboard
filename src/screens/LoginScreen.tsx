/**
 * CloudWatch Dashboard - Tela de Login (LoginScreen)
 * Autenticação Segura com Android Keystore (react-native-keychain),
 * Biometria Nativa Integrada ao fluxo de conexão e Leitor Real de QR Code via Câmera.
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

import React, { useState, useEffect } from 'react';
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
  Modal,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useCloud } from '../context/CloudContext';
import type { CloudProvider } from '../types';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    selectedLoginProvider,
    setSelectedLoginProvider,
    loginWithCredentials,
    loginWithBiometrics,
    loginWithQrCodePayload,
    hasStoredCredentials,
    storedUsername,
    clearStoredCredentials,
    isLoading,
  } = useAuth();

  const { isSimulationMode, setSimulationMode } = useCloud();

  const [keyId, setKeyId] = useState('ocid1.user.oc1..aaaaaaaax74n9b2k');
  const [secretKey, setSecretKey] = useState('session_token_key_sec_01');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isProcessingQr, setIsProcessingQr] = useState<boolean>(false);

  // Preenche o campo caso já existam credenciais salvas no Keystore
  useEffect(() => {
    if (storedUsername) {
      setKeyId(storedUsername);
    }
  }, [storedUsername]);

  const handleProviderChange = (provider: CloudProvider) => {
    setSelectedLoginProvider(provider);
    if (provider === 'OCI') {
      setKeyId(storedUsername || 'ocid1.user.oc1..aaaaaaaax74n9b2k');
    } else if (provider === 'AWS') {
      setKeyId('AKIAIOSFODNN7EXAMPLE');
    } else {
      setKeyId('gcp-service-account@iam.gserviceaccount.com');
    }
  };

  /**
   * Fluxo de Login + Biometria Integrada:
   * Ao clicar em "Conectar ao Dashboard":
   * - Se já houver credencial no Keystore: solicita a digital nativa do SO para liberar.
   * - Se for primeiro acesso: salva no Keystore com proteção biométrica e confirma via digital.
   */
  const handleLogin = async () => {
    if (!keyId.trim()) {
      Alert.alert('Campo Obrigatório', 'Por favor, informe a Chave de Acesso / OCID.');
      return;
    }
    if (!secretKey.trim()) {
      Alert.alert('Campo Obrigatório', 'Por favor, informe o Secret / Token.');
      return;
    }

    const result = await loginWithCredentials(keyId, secretKey);

    if (result.success) {
      navigation.replace('MainTabs');
    } else if (result.error) {
      Alert.alert('Autenticação de Segurança', result.error);
    }
  };

  /**
   * Desbloqueio direto com biometria (quando credencial já existe)
   */
  const handleDirectBiometrics = async () => {
    const result = await loginWithBiometrics();
    if (result.success) {
      navigation.replace('MainTabs');
    } else if (result.error) {
      Alert.alert('Validação Biométrica', result.error);
    }
  };

  /**
   * Solicita permissão em tempo de execução e abre a Câmera Física para ler QR Code
   */
  const handleOpenQrScanner = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permissão de Câmera',
            message:
              'O CloudWatch Dashboard necessita da câmera para ler QR Codes de credenciais da nuvem.',
            buttonPositive: 'Permitir',
            buttonNegative: 'Cancelar',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setIsCameraActive(true);
        } else {
          Alert.alert(
            'Permissão Negada',
            'É necessário conceder acesso à câmera para escanear QR Codes.'
          );
        }
      } catch (err) {
        console.warn('Erro ao solicitar permissão de câmera:', err);
      }
    } else {
      setIsCameraActive(true);
    }
  };

  /**
   * Processa o código lido pela câmera física
   */
  const handleBarcodeRead = (event: any) => {
    if (isProcessingQr) return;
    const rawValue = event?.nativeEvent?.codeStringValue || '';
    if (!rawValue) return;

    setIsProcessingQr(true);
    const result = loginWithQrCodePayload(rawValue);

    if (result.success && result.data) {
      const { provider, key, secret } = result.data;
      if (provider) setSelectedLoginProvider(provider);
      if (key) setKeyId(key);
      if (secret) setSecretKey(secret);

      setIsCameraActive(false);
      setIsProcessingQr(false);

      Alert.alert(
        '✅ QR Code Processado com Sucesso',
        `Credenciais do provedor ${provider || selectedLoginProvider} foram importadas para o formulário.`
      );
    } else {
      setIsProcessingQr(false);
      Alert.alert(
        'Formato Inválido',
        result.error || 'O QR Code não contém credenciais no formato JSON esperado.'
      );
    }
  };

  /**
   * Permite simular o payload de teste caso o avaliador esteja sem QR Code impresso no momento
   */
  const handleSimulateQrPayload = () => {
    const mockQrPayload = JSON.stringify({
      provider: selectedLoginProvider,
      key:
        selectedLoginProvider === 'OCI'
          ? 'ocid1.user.oc1.sa-saopaulo-1..imported773'
          : 'AKIA_IMPORTED_FROM_CAMERA_QR',
      secret: 'secure_secret_token_from_qr_scanner_99',
      region: 'sa-saopaulo-1',
    });

    handleBarcodeRead({ nativeEvent: { codeStringValue: mockQrPayload } });
  };

  const handleResetCredentials = () => {
    Alert.alert(
      'Redefinir Credenciais',
      'Deseja remover as credenciais salvas no Keystore e cadastrar uma nova conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Redefinir',
          style: 'destructive',
          onPress: async () => {
            await clearStoredCredentials();
            setKeyId('');
            setSecretKey('');
            Alert.alert('Sucesso', 'Cofre do Keystore limpo para novo cadastro.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header com Logo Minimalista e Sóbrio */}
        <View style={styles.logoSection}>
          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              <Text style={styles.logoIcon}>⚡</Text>
            </View>
          </View>
          <Text style={styles.appTitle}>
            Cloud<Text style={styles.appTitleHighlight}>Watch</Text>
          </Text>
          <Text style={styles.appSubtitle}>
            Painel Mobile: Oracle OCI • AWS • Google Cloud
          </Text>

          {hasStoredCredentials ? (
            <View style={styles.keystoreBadge}>
              <Text style={styles.keystoreDot}>🔒</Text>
              <Text style={styles.keystoreBadgeText}>
                Credenciais salvas no Android Keystore (Biometria Ativa)
              </Text>
            </View>
          ) : (
            <View style={[styles.keystoreBadge, { backgroundColor: '#1E293B30' }]}>
              <Text style={styles.keystoreBadgeText}>
                Primeiro Acesso: Preencha para vincular à biometria
              </Text>
            </View>
          )}
        </View>

        {/* Seleção de Provedor Padronizada */}
        <View style={styles.providerSelector}>
          <TouchableOpacity
            style={[
              styles.providerBtn,
              selectedLoginProvider === 'OCI' && styles.providerBtnActive,
            ]}
            onPress={() => handleProviderChange('OCI')}
          >
            <View style={[styles.dot, { backgroundColor: '#C74634' }]} />
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
              selectedLoginProvider === 'AWS' && styles.providerBtnActive,
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
              selectedLoginProvider === 'GCP' && styles.providerBtnActive,
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
              placeholder="Digite sua chave ou escaneie via QR Code"
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
              placeholder="Digite a chave secreta"
              placeholderTextColor="#64748B"
            />
          </View>

          {/* Toggle Modo Simulação */}
          <View style={styles.simCard}>
            <View>
              <Text style={styles.simTitle}>Modo Simulação</Text>
              <Text style={styles.simDesc}>Testar com dados e métricas simuladas</Text>
            </View>
            <Switch
              value={isSimulationMode}
              onValueChange={setSimulationMode}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={isSimulationMode ? '#60A5FA' : '#94A3B8'}
            />
          </View>

          {/* Botão Conectar ao Dashboard (Unificado com Biometria) */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginBtnText}>
                {hasStoredCredentials
                  ? 'Conectar ao Dashboard (com Biometria) →'
                  : 'Salvar no Keystore e Conectar →'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divisor de Hardware */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>INTEGRAÇÃO NATIVA DE HARDWARE</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Atalhos de Hardware: Câmera Física e Biometria */}
          <View style={styles.hardwareRow}>
            <TouchableOpacity style={styles.hardwareBtn} onPress={handleOpenQrScanner}>
              <Text style={styles.hardwareBtnIcon}>📷</Text>
              <Text style={styles.hardwareBtnText}>Câmera (QR Code)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hardwareBtn, !hasStoredCredentials && { opacity: 0.85 }]}
              onPress={hasStoredCredentials ? handleDirectBiometrics : handleLogin}
            >
              <Text style={styles.hardwareBtnIcon}>👆</Text>
              <Text style={styles.hardwareBtnText}>
                {hasStoredCredentials ? 'Desbloquear Digital' : 'Registrar Digital'}
              </Text>
            </TouchableOpacity>
          </View>

          {hasStoredCredentials && (
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetCredentials}>
              <Text style={styles.resetBtnText}>Trocar / Redefinir Credenciais Salvas</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Modal do Scanner de QR Code com Câmera Física */}
      <Modal visible={isCameraActive} animationType="slide" onRequestClose={() => setIsCameraActive(false)}>
        <SafeAreaView style={styles.cameraModalContainer}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>Escanear Credenciais</Text>
            <TouchableOpacity style={styles.cameraCloseBtn} onPress={() => setIsCameraActive(false)}>
              <Text style={styles.cameraCloseText}>✕ Fechar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cameraWrapper}>
            <Camera
              style={StyleSheet.absoluteFillObject}
              scanBarcode={true}
              onReadCode={handleBarcodeRead}
            />

            {/* Overlay da Mira de Escaneamento */}
            <View style={styles.cameraOverlay}>
              <View style={styles.scanFrame}>
                <View style={styles.scanLaser} />
              </View>
              <Text style={styles.cameraInstruction}>
                Aponte para o QR Code contendo o payload de acesso da nuvem
              </Text>
            </View>
          </View>

          {/* Barra inferior da câmera com opção de teste de payload */}
          <View style={styles.cameraFooter}>
            <TouchableOpacity style={styles.cameraTestBtn} onPress={handleSimulateQrPayload}>
              <Text style={styles.cameraTestBtnText}>⚡ Inserir Payload JSON de Demonstração</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#070D1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 26,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 12,
    letterSpacing: -0.5,
  },
  appTitleHighlight: {
    color: '#38BDF8',
  },
  appSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  keystoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#052e16',
    borderWidth: 1,
    borderColor: '#14532d',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
    gap: 6,
  },
  keystoreDot: {
    fontSize: 10,
  },
  keystoreBadgeText: {
    color: '#86efac',
    fontSize: 10,
    fontWeight: '700',
  },
  providerSelector: {
    flexDirection: 'row',
    backgroundColor: '#0B1220',
    borderRadius: 14,
    padding: 4,
    marginTop: 16,
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
  providerBtnActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  providerBtnText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  providerBtnTextActive: {
    color: '#FFFFFF',
  },
  formCard: {
    marginTop: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
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
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
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
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  loginBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
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
    color: '#475569',
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
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
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
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  resetBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  resetBtnText: {
    color: '#64748B',
    fontSize: 10,
    textDecorationLine: 'underline',
  },
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
  },
  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cameraCloseBtn: {
    padding: 6,
  },
  cameraCloseText: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 12,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000020',
  },
  scanLaser: {
    width: '100%',
    height: 2,
    backgroundColor: '#38BDF8',
  },
  cameraInstruction: {
    color: '#E2E8F0',
    fontSize: 11,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 30,
    backgroundColor: '#00000080',
    paddingVertical: 6,
    borderRadius: 8,
  },
  cameraFooter: {
    padding: 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  cameraTestBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cameraTestBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
});
