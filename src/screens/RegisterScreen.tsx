import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { CloudLogo } from '../components/common/CloudLogo';
import { NEUTRAL_THEME, CLOUD_PALETTES } from '../theme/tokens';
import type { SupportedCloud } from '../types/auth';

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { registerMasterAccount, linkCloudProvider, cloudAccounts } = useAuth();

  const [username, setUsername] = useState('joao.guimaraes');
  const [email, setEmail] = useState('joao.guimaraes@fatec.sp.gov.br');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de configuracao de nuvem
  const [activeConfigModal, setActiveConfigModal] = useState<SupportedCloud | null>(null);

  // Campos OCI
  const [ociTenancy, setOciTenancy] = useState('ocid1.tenancy.oc1..aaaaaaaab1234567890');
  const [ociUser, setOciUser] = useState('ocid1.user.oc1..aaaaaaaax74n9b2k3l4m');
  const [ociFingerprint, setOciFingerprint] = useState('0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59');
  const [ociRegion, setOciRegion] = useState('sa-saopaulo-1');

  // Campos AWS
  const [awsKeyId, setAwsKeyId] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');

  // Campos GCP
  const [gcpProjectId, setGcpProjectId] = useState('');
  const [gcpClientEmail, setGcpClientEmail] = useState('');
  const [gcpPrivateKey, setGcpPrivateKey] = useState('');
  const [gcpZone, setGcpZone] = useState('southamerica-east1-a');

  const configuredCount = Object.values(cloudAccounts).filter((acc) => acc.isConfigured).length;

  const handleSaveProviderConfig = async (provider: SupportedCloud) => {
    let creds: Record<string, string> = {};

    if (provider === 'OCI') {
      if (!ociTenancy.trim() || !ociUser.trim()) {
        Alert.alert('Campos Obrigatorios', 'Preencha o Tenancy OCID e User OCID.');
        return;
      }
      creds = {
        tenancyOcid: ociTenancy.trim(),
        userOcid: ociUser.trim(),
        fingerprint: ociFingerprint.trim(),
        region: ociRegion.trim(),
      };
    } else if (provider === 'AWS') {
      if (!awsKeyId.trim() || !awsSecretKey.trim()) {
        Alert.alert('Campos Obrigatorios', 'Preencha a Access Key ID e Secret Access Key.');
        return;
      }
      creds = {
        accessKeyId: awsKeyId.trim(),
        secretAccessKey: awsSecretKey.trim(),
        region: awsRegion.trim(),
      };
    } else if (provider === 'GCP') {
      if (!gcpProjectId.trim()) {
        Alert.alert('Campos Obrigatorios', 'Preencha o GCP Project ID.');
        return;
      }
      creds = {
        projectId: gcpProjectId.trim(),
        clientEmail: gcpClientEmail.trim(),
        privateKey: gcpPrivateKey.trim(),
        zone: gcpZone.trim(),
        region: 'southamerica-east1',
      };
    }

    // Modal de confirmacao para ativar biometria
    Alert.alert(
      'Autenticacao Biometrica',
      `Deseja ativar a autenticacao biometrica nativa para autorizar operacoes na conta ${provider}?`,
      [
        {
          text: 'Pular',
          style: 'cancel',
          onPress: async () => {
            await linkCloudProvider(provider, creds, false);
            setActiveConfigModal(null);
          },
        },
        {
          text: 'Ativar',
          onPress: async () => {
            await linkCloudProvider(provider, creds, true);
            setActiveConfigModal(null);
          },
        },
      ]
    );
  };

  const handleFinalize = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Campos Obrigatórios', 'Informe usuário, e-mail e senha para prosseguir.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Senha Invalida', 'A senha mestre deve conter no minimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Senhas Divergentes', 'A confirmacao de senha nao coincide com a senha informada.');
      return;
    }

    if (configuredCount === 0) {
      Alert.alert(
        'Vinculacao Obrigatoria',
        'Selecione e configure ao menos 1 provedor de nuvem para continuar.'
      );
      return;
    }

    setIsSubmitting(true);
    const res = await registerMasterAccount(username, email, password);
    setIsSubmitting(false);

    if (res.success) {
      try {
        if (typeof navigation.replace === 'function') {
          navigation.replace('MainTabs');
        } else {
          navigation.navigate('MainTabs');
        }
      } catch (navErr) {
        console.log('Navegacao efetuada por estado condicional:', navErr);
      }
    } else {
      Alert.alert('Erro no Cadastro', res.error || 'Nao foi possivel registrar a conta mestre.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Cabecalho Sobrio */}
        <View style={styles.header}>
          <Text style={styles.title}>Criacao de Conta Mestre</Text>
          <Text style={styles.subtitle}>Acesse sua conta para continuar</Text>
        </View>

        {/* Formulario Conta Mestre */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>DADOS DA CONTA PRINCIPAL</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>NOME DE USUARIO</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="ex: joao.guimaraes"
              placeholderTextColor="#5F6368"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>E-MAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ex: joao@fatec.sp.gov.br"
              placeholderTextColor="#5F6368"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>SENHA MESTRE DE ACESSO</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Minimo 6 caracteres"
              placeholderTextColor="#5F6368"
              secureTextEntry
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>CONFIRMAR SENHA</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repita a senha mestre"
              placeholderTextColor="#5F6368"
              secureTextEntry
            />
          </View>
        </View>

        {/* Secao Interativa: Provedores Conectados */}
        <View style={styles.sectionCard}>
          <View style={styles.providerSectionHeader}>
            <Text style={styles.sectionHeader}>PROVEDORES CONECTADOS</Text>
            <Text style={styles.configuredCounter}>
              {configuredCount} de 3 configurados
            </Text>
          </View>

          <Text style={styles.providerHelperText}>
            Selecione e autentique as nuvens que deseja monitorar:
          </Text>

          {/* Card OCI */}
          <View style={styles.cloudRowCard}>
            <View style={styles.cloudRowLeft}>
              <CloudLogo provider="OCI" size={32} />
              <View style={styles.cloudTextMeta}>
                <Text style={styles.cloudTitle}>Oracle Cloud Infrastructure (OCI)</Text>
                <Text style={styles.cloudStatusText}>
                  {cloudAccounts.OCI.isConfigured
                    ? `VINCULADO (${cloudAccounts.OCI.region})`
                    : 'NAO CONFIGURADO'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.configBtn,
                cloudAccounts.OCI.isConfigured && styles.configBtnLinked,
              ]}
              onPress={() => setActiveConfigModal('OCI')}
            >
              <Text
                style={[
                  styles.configBtnText,
                  cloudAccounts.OCI.isConfigured && styles.configBtnTextLinked,
                ]}
              >
                {cloudAccounts.OCI.isConfigured ? 'Alterar' : 'Configurar OCI'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Card AWS */}
          <View style={styles.cloudRowCard}>
            <View style={styles.cloudRowLeft}>
              <CloudLogo provider="AWS" size={32} />
              <View style={styles.cloudTextMeta}>
                <Text style={styles.cloudTitle}>Amazon Web Services (AWS)</Text>
                <Text style={styles.cloudStatusText}>
                  {cloudAccounts.AWS.isConfigured
                    ? `VINCULADO (${cloudAccounts.AWS.region})`
                    : 'NAO CONFIGURADO'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.configBtn,
                cloudAccounts.AWS.isConfigured && styles.configBtnLinked,
              ]}
              onPress={() => setActiveConfigModal('AWS')}
            >
              <Text
                style={[
                  styles.configBtnText,
                  cloudAccounts.AWS.isConfigured && styles.configBtnTextLinked,
                ]}
              >
                {cloudAccounts.AWS.isConfigured ? 'Alterar' : 'Configurar AWS'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Card GCP */}
          <View style={styles.cloudRowCard}>
            <View style={styles.cloudRowLeft}>
              <CloudLogo provider="GCP" size={32} />
              <View style={styles.cloudTextMeta}>
                <Text style={styles.cloudTitle}>Google Cloud Platform (GCP)</Text>
                <Text style={styles.cloudStatusText}>
                  {cloudAccounts.GCP.isConfigured
                    ? `VINCULADO (${cloudAccounts.GCP.region})`
                    : 'NAO CONFIGURADO'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.configBtn,
                cloudAccounts.GCP.isConfigured && styles.configBtnLinked,
              ]}
              onPress={() => setActiveConfigModal('GCP')}
            >
              <Text
                style={[
                  styles.configBtnText,
                  cloudAccounts.GCP.isConfigured && styles.configBtnTextLinked,
                ]}
              >
                {cloudAccounts.GCP.isConfigured ? 'Alterar' : 'Configurar GCP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botao Primario de Finalizacao */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (configuredCount === 0 || isSubmitting) && styles.primaryButtonDisabled,
          ]}
          onPress={handleFinalize}
          disabled={configuredCount === 0 || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Finalizar Cadastro e Acessar Painel</Text>
          )}
        </TouchableOpacity>

        {/* Link para quem ja possui conta */}
        <TouchableOpacity
          style={styles.loginLinkBtn}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginLinkText}>Ja possui conta mestre? Acesse o console</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Configuracao de Provedor */}
      <Modal
        visible={activeConfigModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveConfigModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Configuracao de Nuvem: {activeConfigModal}
              </Text>
              <TouchableOpacity onPress={() => setActiveConfigModal(null)}>
                <Text style={styles.modalCloseText}>FECHAR</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {activeConfigModal === 'OCI' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>TENANCY OCID</Text>
                    <TextInput
                      style={styles.input}
                      value={ociTenancy}
                      onChangeText={setOciTenancy}
                      placeholder="ocid1.tenancy.oc1..aaaa..."
                      placeholderTextColor="#5F6368"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>USER OCID</Text>
                    <TextInput
                      style={styles.input}
                      value={ociUser}
                      onChangeText={setOciUser}
                      placeholder="ocid1.user.oc1..aaaa..."
                      placeholderTextColor="#5F6368"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>FINGERPRINT</Text>
                    <TextInput
                      style={styles.input}
                      value={ociFingerprint}
                      onChangeText={setOciFingerprint}
                      placeholder="0e:ed:6e:d2:98:..."
                      placeholderTextColor="#5F6368"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>REGIAO</Text>
                    <TextInput
                      style={styles.input}
                      value={ociRegion}
                      onChangeText={setOciRegion}
                      placeholder="sa-saopaulo-1"
                      placeholderTextColor="#5F6368"
                      autoCapitalize="none"
                    />
                  </View>
                </>
              )}

              {activeConfigModal === 'AWS' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>AWS ACCESS KEY ID</Text>
                    <TextInput
                      style={styles.input}
                      value={awsKeyId}
                      onChangeText={setAwsKeyId}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      placeholderTextColor="#5F6368"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>AWS SECRET ACCESS KEY</Text>
                    <TextInput
                      style={styles.input}
                      value={awsSecretKey}
                      onChangeText={setAwsSecretKey}
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      placeholderTextColor="#5F6368"
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>DEFAULT REGION</Text>
                    <TextInput
                      style={styles.input}
                      value={awsRegion}
                      onChangeText={setAwsRegion}
                      placeholder="us-east-1"
                      placeholderTextColor="#5F6368"
                      autoCapitalize="none"
                    />
                  </View>
                </>
              )}

              {activeConfigModal === 'GCP' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>GCP PROJECT ID</Text>
                    <TextInput
                      style={styles.input}
                      value={gcpProjectId}
                      onChangeText={setGcpProjectId}
                      placeholder="cloudwatch-prod-421"
                      placeholderTextColor="#5F6368"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>CLIENT EMAIL</Text>
                    <TextInput
                      style={styles.input}
                      value={gcpClientEmail}
                      onChangeText={setGcpClientEmail}
                      placeholder="sa-monitor@cloudwatch-prod.iam.gserviceaccount.com"
                      placeholderTextColor="#5F6368"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>SERVICE ACCOUNT KEY / PRIVATE KEY</Text>
                    <TextInput
                      style={styles.input}
                      value={gcpPrivateKey}
                      onChangeText={setGcpPrivateKey}
                      placeholder="Chave JSON ou PEM"
                      placeholderTextColor="#5F6368"
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>ZONE / REGION</Text>
                    <TextInput
                      style={styles.input}
                      value={gcpZone}
                      onChangeText={setGcpZone}
                      placeholder="southamerica-east1-a"
                      placeholderTextColor="#5F6368"
                      autoCapitalize="none"
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => activeConfigModal && handleSaveProviderConfig(activeConfigModal)}
              >
                <Text style={styles.modalSaveText}>Salvar Credenciais da Nuvem</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F1318',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    marginTop: 10,
  },
  title: {
    color: '#E8EAED',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9AA0A6',
    fontSize: 12,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#181C22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  providerSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configuredCounter: {
    color: '#81C995',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  providerHelperText: {
    color: '#5F6368',
    fontSize: 11,
    marginBottom: 14,
    lineHeight: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F1318',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282E38',
    color: '#E8EAED',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cloudRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#20242C',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 12,
    marginBottom: 10,
  },
  cloudRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  cloudTextMeta: {
    flex: 1,
  },
  cloudTitle: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
  },
  cloudStatusText: {
    color: '#9AA0A6',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  configBtn: {
    backgroundColor: '#282E38',
    borderWidth: 1,
    borderColor: '#3C4043',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  configBtnLinked: {
    backgroundColor: '#132B1D',
    borderColor: '#1E462E',
  },
  configBtnText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
  },
  configBtnTextLinked: {
    color: '#81C995',
  },
  primaryButton: {
    backgroundColor: '#1A73E8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonDisabled: {
    backgroundColor: '#282E38',
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  loginLinkBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginLinkText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D3139',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#282E38',
  },
  modalTitle: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalCloseText: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalScroll: {
    padding: 16,
  },
  modalSaveBtn: {
    backgroundColor: '#132B1D',
    borderWidth: 1,
    borderColor: '#1E462E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  modalSaveText: {
    color: '#81C995',
    fontSize: 13,
    fontWeight: '800',
  },
});
