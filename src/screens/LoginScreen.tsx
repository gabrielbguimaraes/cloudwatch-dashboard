/**
 * CloudWatch Dashboard - Tela de Login (LoginScreen)
 * Validação Sintática Rigorosa OCI (Tenancy, User, Fingerprint, Região),
 * Arquitetura Desacoplada (EncryptedStorage + Keychain Biometrics),
 * Leitor Real de QR Code e Nova Logo Minimalista.
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
import {
  validateTenancyOcid,
  validateUserOcid,
  validateFingerprint,
  validateRegion,
} from '../utils/validation';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    selectedLoginProvider,
    setSelectedLoginProvider,
    loginWithCredentials,
    loginWithBiometrics,
    loginWithQrCodePayload,
    hasStoredCredentials,
    storedCredentials,
    clearStoredCredentials,
    isLoading,
  } = useAuth();

  const { isSimulationMode, setSimulationMode } = useCloud();

  // Estados dos Campos da Oracle Cloud (OCI)
  const [tenancyId, setTenancyId] = useState('ocid1.tenancy.oc1..aaaaaaaab1234567890');
  const [userId, setUserId] = useState('ocid1.user.oc1..aaaaaaaax74n9b2k3l4m');
  const [fingerprint, setFingerprint] = useState('0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59');
  const [region, setRegion] = useState('sa-saopaulo-1');
  const [privateKey, setPrivateKey] = useState('session_token_key_sec_01');

  // Estados dos Campos AWS / GCP
  const [awsKeyId, setAwsKeyId] = useState('AKIAIOSFODNN7EXAMPLE');
  const [awsSecretKey, setAwsSecretKey] = useState('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
  const [gcpEmail, setGcpEmail] = useState('cloudwatch-admin@fatec-corp.iam.gserviceaccount.com');
  const [gcpPrivateKey, setGcpPrivateKey] = useState('gcp_service_account_private_key_pem');

  // Controle de Interação e Validação
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessingQr, setIsProcessingQr] = useState(false);

  // Preenche os campos caso já existam credenciais salvas no EncryptedStorage
  useEffect(() => {
    if (storedCredentials) {
      if (storedCredentials.tenancyId) setTenancyId(storedCredentials.tenancyId);
      if (storedCredentials.userId) setUserId(storedCredentials.userId);
      if (storedCredentials.fingerprint) setFingerprint(storedCredentials.fingerprint);
      if (storedCredentials.region) setRegion(storedCredentials.region);
      if (storedCredentials.privateKey) setPrivateKey(storedCredentials.privateKey);
      if (storedCredentials.keyId) setAwsKeyId(storedCredentials.keyId);
    }
  }, [storedCredentials]);

  // Validações em Tempo Real (OCI)
  const isTenancyValid = validateTenancyOcid(tenancyId);
  const isUserValid = validateUserOcid(userId);
  const isFingerprintValid = validateFingerprint(fingerprint);
  const isRegionValid = validateRegion(region);
  const isPrivateKeyValid = privateKey.trim().length > 0;

  const isOciValid =
    isTenancyValid && isUserValid && isFingerprintValid && isRegionValid && isPrivateKeyValid;

  const isFormValid =
    selectedLoginProvider === 'OCI'
      ? isOciValid
      : selectedLoginProvider === 'AWS'
      ? awsKeyId.trim().length > 4 && awsSecretKey.trim().length > 4
      : gcpEmail.includes('@') && gcpPrivateKey.trim().length > 4;

  const handleProviderChange = (provider: CloudProvider) => {
    setSelectedLoginProvider(provider);
    setHasAttemptedSubmit(false);
  };

  /**
   * Validação Sintática Rigorosa Antes de Qualquer Ação:
   * Bloqueia login e prompt biométrico se algum campo estiver inválido.
   */
  const handleLogin = async () => {
    setHasAttemptedSubmit(true);

    if (selectedLoginProvider === 'OCI' && !isOciValid) {
      Alert.alert(
        'Credenciais OCI Inválidas',
        'Por favor, corrija os campos destacados em vermelho antes de prosseguir com a conexão.'
      );
      return;
    }

    if (!isFormValid) {
      Alert.alert('Campos Obrigatórios', 'Preencha todos os campos corretamente para conectar.');
      return;
    }

    // Monta o payload conforme o provedor
    const payload =
      selectedLoginProvider === 'OCI'
        ? {
            provider: 'OCI' as const,
            tenancyId: tenancyId.trim(),
            userId: userId.trim(),
            fingerprint: fingerprint.trim(),
            region: region.trim(),
            privateKey: privateKey.trim(),
          }
        : selectedLoginProvider === 'AWS'
        ? {
            provider: 'AWS' as const,
            keyId: awsKeyId.trim(),
            secretKey: awsSecretKey.trim(),
            region: 'us-east-1',
          }
        : {
            provider: 'GCP' as const,
            keyId: gcpEmail.trim(),
            secretKey: gcpPrivateKey.trim(),
            region: 'southamerica-east1',
          };

    // Aciona a autenticação no AuthContext (desacoplada: EncryptedStorage + Keychain Token)
    const result = await loginWithCredentials(payload);

    if (result.success) {
      navigation.replace('MainTabs');
    } else if (result.error) {
      Alert.alert('Autenticação de Segurança', result.error);
    }
  };

  /**
   * Desbloqueio direto com biometria nativa para credenciais já registradas
   */
  const handleDirectBiometrics = async () => {
    if (!hasStoredCredentials) {
      handleLogin();
      return;
    }

    const result = await loginWithBiometrics();
    if (result.success) {
      navigation.replace('MainTabs');
    } else if (result.error) {
      Alert.alert('Validação Biométrica', result.error);
    }
  };

  /**
   * Scanner de QR Code Real via Câmera Física
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
   * Processamento robusto do código QR em Plain Text
   */
  const handleBarcodeRead = (event: any) => {
    if (isProcessingQr) return;
    const rawValue = event?.nativeEvent?.codeStringValue || '';
    if (!rawValue) return;

    setIsProcessingQr(true);
    const result = loginWithQrCodePayload(rawValue);

    if (result.success && result.data) {
      const data = result.data;
      if (data.provider) setSelectedLoginProvider(data.provider);
      if (data.tenancyId) setTenancyId(data.tenancyId);
      if (data.userId) setUserId(data.userId);
      if (data.fingerprint) setFingerprint(data.fingerprint);
      if (data.region) setRegion(data.region);
      if (data.privateKey) setPrivateKey(data.privateKey);

      setIsCameraActive(false);
      setIsProcessingQr(false);
      setHasAttemptedSubmit(false);

      Alert.alert(
        '✅ QR Code Processado com Sucesso',
        'As credenciais OCI foram importadas e preenchidas automaticamente no formulário.'
      );
    } else {
      setIsProcessingQr(false);
      Alert.alert(
        'QR Code Inválido',
        result.error || 'Certifique-se de escanear uma configuração OCI em Plain Text.'
      );
    }
  };

  /**
   * Demonstração de payload OCI oficial para testes rápidos do avaliador
   */
  const handleSimulateQrPayload = () => {
    const mockOciJson = JSON.stringify({
      provider: 'OCI',
      tenancyId: 'ocid1.tenancy.oc1..aaaaaaaab1234567890',
      userId: 'ocid1.user.oc1..aaaaaaaax74n9b2k3l4m',
      fingerprint: '0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59',
      region: 'sa-saopaulo-1',
      privateKey: 'session_token_key_sec_01',
    });

    handleBarcodeRead({ nativeEvent: { codeStringValue: mockOciJson } });
  };

  const handleResetCredentials = () => {
    Alert.alert(
      'Redefinir Credenciais',
      'Deseja remover as credenciais salvas no cofre e cadastrar uma nova conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Redefinir',
          style: 'destructive',
          onPress: async () => {
            await clearStoredCredentials();
            Alert.alert('Sucesso', 'Cofre de credenciais redefinido com sucesso.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Nova Logo Minimalista Sóbria (Sem Neons Agressivos) */}
        <View style={styles.logoSection}>
          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              {/* Linha vetorial nativa de telemetria / pulso cardíaco de infraestrutura */}
              <View style={styles.telemetryBox}>
                <View style={styles.telemetryLineFlat} />
                <View style={styles.telemetryPulseUp} />
                <View style={styles.telemetryPulseDown} />
                <View style={styles.telemetryDot} />
                <View style={styles.telemetryPulseRecovery} />
                <View style={styles.telemetryLineFlat} />
              </View>
            </View>
          </View>

          <Text style={styles.appTitle}>
            Cloud<Text style={styles.appTitleHighlight}>Watch</Text>
          </Text>
          <Text style={styles.appSubtitle}>
            Painel Mobile: Oracle OCI • AWS • Google Cloud
          </Text>
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

        {/* Formulário com Validação Sintática Rigorosa */}
        <View style={styles.formCard}>
          {selectedLoginProvider === 'OCI' ? (
            <>
              {/* Campo 1: Tenancy OCID */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TENANCY OCID</Text>
                <TextInput
                  style={[
                    styles.input,
                    hasAttemptedSubmit && !isTenancyValid && styles.inputError,
                  ]}
                  value={tenancyId}
                  onChangeText={setTenancyId}
                  placeholder="ocid1.tenancy.oc1..aaaaaaaax..."
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {hasAttemptedSubmit && !isTenancyValid && (
                  <Text style={styles.errorText}>
                    ⚠️ Deve iniciar com "ocid1.tenancy.oc1.."
                  </Text>
                )}
              </View>

              {/* Campo 2: User OCID */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>USER OCID</Text>
                <TextInput
                  style={[
                    styles.input,
                    hasAttemptedSubmit && !isUserValid && styles.inputError,
                  ]}
                  value={userId}
                  onChangeText={setUserId}
                  placeholder="ocid1.user.oc1..aaaaaaaax..."
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {hasAttemptedSubmit && !isUserValid && (
                  <Text style={styles.errorText}>
                    ⚠️ Deve iniciar com "ocid1.user.oc1.."
                  </Text>
                )}
              </View>

              {/* Campo 3: Fingerprint (16 pares hex) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FINGERPRINT (16 PARES HEX)</Text>
                <TextInput
                  style={[
                    styles.input,
                    hasAttemptedSubmit && !isFingerprintValid && styles.inputError,
                  ]}
                  value={fingerprint}
                  onChangeText={setFingerprint}
                  placeholder="0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {hasAttemptedSubmit && !isFingerprintValid && (
                  <Text style={styles.errorText}>
                    ⚠️ Exige 16 pares hexadecimais (ex: 0e:ed:6e:...)
                  </Text>
                )}
              </View>

              {/* Campo 4: Região OCI */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>REGIÃO OCI</Text>
                <TextInput
                  style={[
                    styles.input,
                    hasAttemptedSubmit && !isRegionValid && styles.inputError,
                  ]}
                  value={region}
                  onChangeText={setRegion}
                  placeholder="sa-saopaulo-1 ou us-ashburn-1"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {hasAttemptedSubmit && !isRegionValid && (
                  <Text style={styles.errorText}>
                    ⚠️ Região OCI inválida (ex: sa-saopaulo-1)
                  </Text>
                )}
              </View>

              {/* Campo 5: Private Key / Token */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PRIVATE KEY PEM / SECRET TOKEN</Text>
                <TextInput
                  style={[
                    styles.input,
                    hasAttemptedSubmit && !isPrivateKeyValid && styles.inputError,
                  ]}
                  value={privateKey}
                  onChangeText={setPrivateKey}
                  secureTextEntry
                  placeholder="Chave privada PEM ou token de sessão"
                  placeholderTextColor="#64748B"
                />
                {hasAttemptedSubmit && !isPrivateKeyValid && (
                  <Text style={styles.errorText}>⚠️ Chave privada é obrigatória</Text>
                )}
              </View>
            </>
          ) : selectedLoginProvider === 'AWS' ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ACCESS KEY ID</Text>
                <TextInput
                  style={styles.input}
                  value={awsKeyId}
                  onChangeText={setAwsKeyId}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SECRET ACCESS KEY</Text>
                <TextInput
                  style={styles.input}
                  value={awsSecretKey}
                  onChangeText={setAwsSecretKey}
                  secureTextEntry
                  placeholder="Secret Access Key"
                  placeholderTextColor="#64748B"
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CLIENT EMAIL</Text>
                <TextInput
                  style={styles.input}
                  value={gcpEmail}
                  onChangeText={setGcpEmail}
                  placeholder="service-account@iam.gserviceaccount.com"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PRIVATE KEY</Text>
                <TextInput
                  style={styles.input}
                  value={gcpPrivateKey}
                  onChangeText={setGcpPrivateKey}
                  secureTextEntry
                  placeholder="Private Key Token"
                  placeholderTextColor="#64748B"
                />
              </View>
            </>
          )}

          {/* Toggle Modo Simulação */}
          <View style={styles.simCard}>
            <View>
              <Text style={styles.simTitle}>Modo Simulação</Text>
              <Text style={styles.simDesc}>Testar telemetria com instâncias Faker</Text>
            </View>
            <Switch
              value={isSimulationMode}
              onValueChange={setSimulationMode}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={isSimulationMode ? '#60A5FA' : '#94A3B8'}
            />
          </View>

          {/* Botão Conectar ao Dashboard */}
          <TouchableOpacity
            style={[styles.loginBtn, hasAttemptedSubmit && !isFormValid && styles.loginBtnDisabled]}
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

          {/* Divisor Sóbrio (Texto removido conforme solicitado) */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
          </View>

          {/* Atalhos de Hardware: Câmera Física e Biometria */}
          <View style={styles.hardwareRow}>
            <TouchableOpacity style={styles.hardwareBtn} onPress={handleOpenQrScanner}>
              <Text style={styles.hardwareBtnIcon}>📷</Text>
              <Text style={styles.hardwareBtnText}>Câmera (QR Code)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hardwareBtn} onPress={handleDirectBiometrics}>
              <Text style={styles.hardwareBtnIcon}>👆</Text>
              <Text style={styles.hardwareBtnText}>Biometria</Text>
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
                Aponte para o QR Code em Plain Text da Oracle OCI
              </Text>
            </View>
          </View>

          {/* Barra inferior da câmera com opção de teste de payload */}
          <View style={styles.cameraFooter}>
            <TouchableOpacity style={styles.cameraTestBtn} onPress={handleSimulateQrPayload}>
              <Text style={styles.cameraTestBtnText}>⚡ Inserir Payload JSON OCI Oficial</Text>
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
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 6,
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
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  telemetryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 24,
    position: 'relative',
  },
  telemetryLineFlat: {
    width: 6,
    height: 2,
    backgroundColor: '#38BDF8',
  },
  telemetryPulseUp: {
    width: 8,
    height: 2,
    backgroundColor: '#38BDF8',
    transform: [{ rotate: '-50deg' }, { translateY: -3 }],
  },
  telemetryPulseDown: {
    width: 12,
    height: 2,
    backgroundColor: '#38BDF8',
    transform: [{ rotate: '55deg' }, { translateY: 2 }],
  },
  telemetryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
    position: 'absolute',
    top: 9,
    left: 17,
  },
  telemetryPulseRecovery: {
    width: 8,
    height: 2,
    backgroundColor: '#38BDF8',
    transform: [{ rotate: '-45deg' }, { translateY: -2 }],
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
  providerSelector: {
    flexDirection: 'row',
    backgroundColor: '#0B1220',
    borderRadius: 14,
    padding: 4,
    marginTop: 18,
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
    marginBottom: 12,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#1C0E14',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
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
    marginTop: 4,
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
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  dividerRow: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#1E293B',
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
