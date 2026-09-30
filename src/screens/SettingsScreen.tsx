import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Switch,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { AppImage } from '../components/common/AppImage';
import { CloudLogo } from '../components/common/CloudLogo';
import { Toast } from '../components/common/Toast';
import { CLOUD_PALETTES, NEUTRAL_THEME } from '../theme/tokens';
import type { SupportedCloud } from '../types/auth';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    masterUser,
    cloudAccounts,
    toggleBiometrics,
    unlinkCloudProvider,
    linkCloudProvider,
    logoutMaster,
    clearStoredCredentials,
  } = useAuth();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal para conectar ou reconfigurar nuvem
  const [connectModalCloud, setConnectModalCloud] = useState<SupportedCloud | null>(null);
  const [inputField1, setInputField1] = useState('');
  const [inputField2, setInputField2] = useState('');
  const [inputField3, setInputField3] = useState('');
  const [inputRegion, setInputRegion] = useState('');

  // Mascara identificador de conta (Tenancy OCID ou AWS/GCP ID)
  const maskAccountIdentifier = (id?: string): string => {
    if (!id || id.trim().length === 0) return 'Nao informado';
    const clean = id.trim();
    if (clean.length <= 16) return clean;
    return `${clean.slice(0, 8)}...${clean.slice(-8)}`;
  };

  // Iniciais do usuario para o avatar fallback
  const getUserInitials = (): string => {
    if (!masterUser?.username) return 'ADM';
    const parts = masterUser.username.split(/[._\s-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return masterUser.username.substring(0, 3).toUpperCase();
  };

  const formattedCreatedDate = masterUser?.createdAt
    ? new Date(masterUser.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Registro inicial';

  const handleOpenConnectModal = (cloud: SupportedCloud) => {
    setConnectModalCloud(cloud);
    const existing = cloudAccounts[cloud];
    if (cloud === 'OCI') {
      setInputField1(existing?.credentials?.tenancyOcid || 'ocid1.tenancy.oc1..aaaaaaaab1234567890');
      setInputField2(existing?.credentials?.userOcid || 'ocid1.user.oc1..aaaaaaaax74n9b2k3l4m');
      setInputField3(existing?.credentials?.fingerprint || '0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59');
      setInputRegion(existing?.region || 'sa-saopaulo-1');
    } else if (cloud === 'AWS') {
      setInputField1(existing?.credentials?.accessKeyId || '');
      setInputField2(existing?.credentials?.secretAccessKey || '');
      setInputField3('');
      setInputRegion(existing?.region || 'us-east-1');
    } else if (cloud === 'GCP') {
      setInputField1(existing?.credentials?.projectId || '');
      setInputField2(existing?.credentials?.clientEmail || '');
      setInputField3(existing?.credentials?.zone || 'southamerica-east1-a');
      setInputRegion(existing?.region || 'southamerica-east1');
    }
  };

  const handleSaveCloudCredentials = async () => {
    if (!connectModalCloud) return;

    let creds: Record<string, string> = {};
    if (connectModalCloud === 'OCI') {
      if (!inputField1.trim() || !inputField2.trim()) {
        Alert.alert('Campos Obrigatorios', 'Preencha Tenancy OCID e User OCID.');
        return;
      }
      creds = {
        tenancyOcid: inputField1.trim(),
        userOcid: inputField2.trim(),
        fingerprint: inputField3.trim(),
        region: inputRegion.trim() || 'sa-saopaulo-1',
      };
    } else if (connectModalCloud === 'AWS') {
      if (!inputField1.trim() || !inputField2.trim()) {
        Alert.alert('Campos Obrigatorios', 'Preencha Access Key ID e Secret Access Key.');
        return;
      }
      creds = {
        accessKeyId: inputField1.trim(),
        secretAccessKey: inputField2.trim(),
        region: inputRegion.trim() || 'us-east-1',
      };
    } else if (connectModalCloud === 'GCP') {
      if (!inputField1.trim()) {
        Alert.alert('Campos Obrigatorios', 'Preencha o GCP Project ID.');
        return;
      }
      creds = {
        projectId: inputField1.trim(),
        clientEmail: inputField2.trim(),
        zone: inputField3.trim() || 'southamerica-east1-a',
        region: inputRegion.trim() || 'southamerica-east1',
      };
    }

    const cloud = connectModalCloud;
    Alert.alert(
      'Autenticacao Biometrica',
      `Deseja ativar a autenticacao biometrica nativa para autorizar operacoes na conta ${cloud}?`,
      [
        {
          text: 'Pular',
          style: 'cancel',
          onPress: async () => {
            const res = await linkCloudProvider(cloud, creds, false);
            if (res.success) {
              setToastMessage(`Provedor ${cloud} vinculado com sucesso`);
            } else {
              setToastMessage(res.error || 'Falha ao vincular provedor');
            }
            setConnectModalCloud(null);
          },
        },
        {
          text: 'Ativar',
          onPress: async () => {
            const res = await linkCloudProvider(cloud, creds, true);
            if (res.success) {
              setToastMessage(`Provedor ${cloud} vinculado com biometria ativa`);
            } else {
              setToastMessage(res.error || 'Falha ao vincular provedor');
            }
            setConnectModalCloud(null);
          },
        },
      ]
    );
  };

  const handleToggleBiometrics = async (cloud: SupportedCloud, currentVal: boolean) => {
    const success = await toggleBiometrics(cloud, !currentVal);
    if (success) {
      setToastMessage(`Biometria ${!currentVal ? 'ativada' : 'desativada'} para ${cloud}`);
    } else {
      setToastMessage('Falha ao alternar biometria');
    }
  };

  const handleRevokeCloud = (cloud: SupportedCloud) => {
    Alert.alert(
      'Revogar Credenciais',
      `Deseja remover as chaves de ${cloud} do cofre criptografico e desativar este provedor?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar e Desconectar',
          style: 'destructive',
          onPress: async () => {
            const success = await unlinkCloudProvider(cloud);
            if (success) {
              setToastMessage(`Credenciais de ${cloud} revogadas`);
            } else {
              setToastMessage(`Falha ao revogar ${cloud}`);
            }
          },
        },
      ]
    );
  };

  const handleClearResourceCache = async () => {
    Alert.alert(
      'Limpar Cache de Recursos',
      'Deseja purgar apenas o cache local de telemetria e instâncias? As credenciais das nuvens permanecerao intactas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@cloudwatch_resources');
              await AsyncStorage.removeItem('@cloudwatch_resources_OCI');
              await AsyncStorage.removeItem('@cloudwatch_resources_AWS');
              await AsyncStorage.removeItem('@cloudwatch_resources_GCP');
              await AsyncStorage.removeItem('@cloudwatch:pinned_resources');
              setToastMessage('Cache de recursos purgado com sucesso');
            } catch (err) {
              setToastMessage('Erro ao purgar cache de recursos');
            }
          },
        },
      ]
    );
  };

  const handleLogoutMaster = () => {
    Alert.alert(
      'Encerrar Sessao Mestre',
      'Esta operacao destruira o cofre criptografico, apagara os tokens de sessao e desconectara o dispositivo. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar Sessao Mestre',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearStoredCredentials();
              await logoutMaster();
              if (typeof navigation.replace === 'function') {
                navigation.replace('Login');
              } else if (navigation.getParent()) {
                navigation.getParent()?.replace('Login');
              } else {
                navigation.navigate('Login');
              }
            } catch (err) {
              console.warn('Erro ao encerrar sessao:', err);
            }
          },
        },
      ]
    );
  };

  const clouds: SupportedCloud[] = ['OCI', 'AWS', 'GCP'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Cabecalho da Tela */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Central de Governanca</Text>
          <Text style={styles.headerSubtitle}>
            Administracao de identidade mestre, cofres multi-cloud e integridade de hardware
          </Text>
        </View>

        {/* 1. Card de Perfil Mestre */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTag}>PERFIL MESTRE</Text>
          </View>

          <View style={styles.profileRow}>
            <AppImage
              source={require('../assets/avatar.png')}
              fallbackLabel={getUserInitials()}
              size={56}
              isCircular={true}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileUsername}>
                {masterUser?.username || 'joao.guimaraes'}
              </Text>
              <Text style={styles.profileEmail}>
                {masterUser?.email || 'joao.guimaraes@fatec.sp.gov.br'}
              </Text>
              <View style={styles.profileMetaBadge}>
                <Text style={styles.profileMetaText}>Conta Mestre Criada: {formattedCreatedDate}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Gerenciamento de Provedores Conectados (Relacao 1:N) */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTag}>PROVEDORES DE INFRAESTRUTURA (1:N)</Text>
          </View>

          {clouds.map((cloud, index) => {
            const config = cloudAccounts[cloud];
            const isConfigured = !!config?.isConfigured;
            const palette = CLOUD_PALETTES[cloud];

            return (
              <View key={cloud}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.cloudRow}>
                  <View style={styles.cloudRowTop}>
                    <View style={styles.cloudTitleBlock}>
                      <CloudLogo provider={cloud} size={28} />
                      <View style={styles.cloudNameCol}>
                        <Text style={styles.cloudNameText}>{palette.name}</Text>
                        <Text style={styles.cloudIdText}>
                          {isConfigured
                            ? maskAccountIdentifier(config.accountIdentifier)
                            : 'Nao Vinculado'}
                        </Text>
                      </View>
                    </View>

                    {isConfigured ? (
                      <View style={[styles.statusBadge, { backgroundColor: palette.badgeBg, borderColor: palette.primary }]}>
                        <Text style={[styles.statusBadgeText, { color: palette.badgeText }]}>VINCULADO</Text>
                      </View>
                    ) : (
                      <View style={styles.statusBadgeUnlinked}>
                        <Text style={styles.statusBadgeUnlinkedText}>DISPONIVEL</Text>
                      </View>
                    )}
                  </View>

                  {isConfigured ? (
                    <View style={styles.cloudControlsRow}>
                      <View style={styles.biometricSwitchCol}>
                        <Text style={styles.controlLabel}>Exigir Biometria:</Text>
                        <Switch
                          value={!!config.biometricsEnabled}
                          onValueChange={() => handleToggleBiometrics(cloud, !!config.biometricsEnabled)}
                          trackColor={{ false: '#282E38', true: palette.primary }}
                          thumbColor={config.biometricsEnabled ? '#FFFFFF' : '#9AA0A6'}
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.revokeButton}
                        onPress={() => handleRevokeCloud(cloud)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.revokeButtonText}>Desconectar / Revogar</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.connectActionRow}>
                      <TouchableOpacity
                        style={styles.connectButton}
                        onPress={() => handleOpenConnectModal(cloud)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.connectButtonText}>Conectar Provedor</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* 3. Seguranca do Dispositivo e Hardware */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTag}>SEGURANCA DO DISPOSITIVO & HARDWARE</Text>
          </View>

          <View style={styles.auditRow}>
            <View style={styles.auditCol}>
              <Text style={styles.auditLabel}>Criptografia do Cofre</Text>
              <Text style={styles.auditValue}>AES-256-GCM (Android Keystore / TEE Ativo)</Text>
            </View>
            <View style={styles.hardwareBadge}>
              <View style={[styles.dot, { backgroundColor: NEUTRAL_THEME.statusRunning.text }]} />
              <Text style={styles.hardwareBadgeText}>HOMOLOGADO</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.auditRow}>
            <View style={styles.auditCol}>
              <Text style={styles.auditLabel}>Isolamento de Memoria</Text>
              <Text style={styles.auditValue}>Hermes Engine Sandboxed</Text>
            </View>
            <View style={styles.hardwareBadge}>
              <View style={[styles.dot, { backgroundColor: NEUTRAL_THEME.statusRunning.text }]} />
              <Text style={styles.hardwareBadgeText}>PROTEGIDO</Text>
            </View>
          </View>
        </View>

        {/* 4. Acoes de Manutencao e Encerramento */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTag}>ACOES DE MANUTENCAO & ENCERRAMENTO</Text>
          </View>

          <TouchableOpacity
            style={styles.cacheButton}
            onPress={handleClearResourceCache}
            activeOpacity={0.8}
          >
            <Text style={styles.cacheButtonText}>Limpar Cache de Recursos</Text>
          </TouchableOpacity>

          <View style={{ height: 12 }} />

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleLogoutMaster}
            activeOpacity={0.8}
          >
            <Text style={styles.dangerButtonText}>Encerrar Sessao Mestre</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Conexao de Nuvem */}
      {connectModalCloud && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setConnectModalCloud(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <CloudLogo provider={connectModalCloud} size={24} />
                <Text style={styles.modalTitle}>Configurar {CLOUD_PALETTES[connectModalCloud].name}</Text>
              </View>

              <Text style={styles.modalDescription}>
                Insira as credenciais de acesso corporativo. As chaves serao salvas no cofre seguro EncryptedStorage.
              </Text>

              {connectModalCloud === 'OCI' && (
                <>
                  <Text style={styles.inputLabel}>Tenancy OCID</Text>
                  <TextInput
                    style={styles.input}
                    value={inputField1}
                    onChangeText={setInputField1}
                    placeholder="ocid1.tenancy.oc1..aaaaaaaab..."
                    placeholderTextColor="#5F6368"
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>User OCID</Text>
                  <TextInput
                    style={styles.input}
                    value={inputField2}
                    onChangeText={setInputField2}
                    placeholder="ocid1.user.oc1..aaaaaaaax..."
                    placeholderTextColor="#5F6368"
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Fingerprint</Text>
                  <TextInput
                    style={styles.input}
                    value={inputField3}
                    onChangeText={setInputField3}
                    placeholder="0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59"
                    placeholderTextColor="#5F6368"
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Regiao OCI</Text>
                  <TextInput
                    style={styles.input}
                    value={inputRegion}
                    onChangeText={setInputRegion}
                    placeholder="sa-saopaulo-1"
                    placeholderTextColor="#5F6368"
                    autoCapitalize="none"
                  />
                </>
              )}

              {connectModalCloud === 'AWS' && (
                <>
                  <Text style={styles.inputLabel}>AWS Access Key ID</Text>
                  <TextInput
                    style={styles.input}
                    value={inputField1}
                    onChangeText={setInputField1}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    placeholderTextColor="#5F6368"
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>AWS Secret Access Key</Text>
                  <TextInput
                    style={styles.input}
                    value={inputField2}
                    onChangeText={setInputField2}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    placeholderTextColor="#5F6368"
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Regiao Padrao</Text>
                  <TextInput
                    style={styles.input}
                    value={inputRegion}
                    onChangeText={setInputRegion}
                    placeholder="us-east-1"
                    placeholderTextColor="#5F6368"
                    autoCapitalize="none"
                  />
                </>
              )}

              {connectModalCloud === 'GCP' && (
                <>
                  <Text style={styles.inputLabel}>GCP Project ID</Text>
                  <TextInput
                    style={styles.input}
                    value={inputField1}
                    onChangeText={setInputField1}
                    placeholder="corp-production-sp-1"
                    placeholderTextColor="#5F6368"
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Client Email (Service Account)</Text>
                  <TextInput
                    style={styles.input}
                    value={inputField2}
                    onChangeText={setInputField2}
                    placeholder="sa-cloudwatch@corp.iam.gserviceaccount.com"
                    placeholderTextColor="#5F6368"
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Zona GCP</Text>
                  <TextInput
                    style={styles.input}
                    value={inputField3}
                    onChangeText={setInputField3}
                    placeholder="southamerica-east1-a"
                    placeholderTextColor="#5F6368"
                    autoCapitalize="none"
                  />
                </>
              )}

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setConnectModalCloud(null)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveButton, { backgroundColor: CLOUD_PALETTES[connectModalCloud].primary }]}
                  onPress={handleSaveCloudCredentials}
                >
                  <Text style={styles.modalSaveText}>Salvar Credenciais</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: NEUTRAL_THEME.background,
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: NEUTRAL_THEME.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: NEUTRAL_THEME.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: NEUTRAL_THEME.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NEUTRAL_THEME.borderDefault,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTag: {
    fontSize: 10,
    fontWeight: '800',
    color: NEUTRAL_THEME.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileUsername: {
    fontSize: 16,
    fontWeight: '700',
    color: NEUTRAL_THEME.textPrimary,
  },
  profileEmail: {
    fontSize: 12,
    color: NEUTRAL_THEME.textSecondary,
    marginTop: 2,
  },
  profileMetaBadge: {
    marginTop: 6,
    backgroundColor: '#20242C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: NEUTRAL_THEME.borderDefault,
  },
  profileMetaText: {
    fontSize: 10,
    color: NEUTRAL_THEME.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cloudRow: {
    paddingVertical: 8,
  },
  cloudRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cloudTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cloudNameCol: {
    flex: 1,
  },
  cloudNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: NEUTRAL_THEME.textPrimary,
  },
  cloudIdText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: NEUTRAL_THEME.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadgeUnlinked: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3C4043',
    backgroundColor: '#20242C',
  },
  statusBadgeUnlinkedText: {
    fontSize: 10,
    fontWeight: '800',
    color: NEUTRAL_THEME.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cloudControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  biometricSwitchCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlLabel: {
    fontSize: 11,
    color: NEUTRAL_THEME.textSecondary,
    fontWeight: '600',
  },
  revokeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#20242C',
    borderWidth: 1,
    borderColor: '#3C4043',
  },
  revokeButtonText: {
    fontSize: 11,
    color: '#F28B82',
    fontWeight: '600',
  },
  connectActionRow: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  connectButton: {
    backgroundColor: '#20242C',
    borderWidth: 1,
    borderColor: '#3C4043',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  connectButtonText: {
    fontSize: 11,
    color: '#8AB4F8',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: NEUTRAL_THEME.borderDefault,
    marginVertical: 10,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  auditCol: {
    flex: 1,
    paddingRight: 10,
  },
  auditLabel: {
    fontSize: 11,
    color: NEUTRAL_THEME.textSecondary,
    fontWeight: '600',
  },
  auditValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: NEUTRAL_THEME.textPrimary,
    marginTop: 2,
  },
  hardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: NEUTRAL_THEME.statusRunning.bg,
    borderWidth: 1,
    borderColor: NEUTRAL_THEME.statusRunning.border,
  },
  hardwareBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: NEUTRAL_THEME.statusRunning.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cacheButton: {
    backgroundColor: '#20242C',
    borderWidth: 1,
    borderColor: '#3C4043',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacheButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: NEUTRAL_THEME.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dangerButton: {
    backgroundColor: '#2D1515',
    borderWidth: 1,
    borderColor: '#4D1F1F',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F28B82',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#181C22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E8EAED',
  },
  modalDescription: {
    fontSize: 12,
    color: '#9AA0A6',
    lineHeight: 18,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    color: '#9AA0A6',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#0F1318',
    borderColor: '#282E38',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#E8EAED',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3C4043',
  },
  modalCancelText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '600',
  },
  modalSaveButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
