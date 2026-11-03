/**
 * CloudWatch Mobile - Onboarding Guiado da Oracle Cloud (US09) & Etapa Pos-Cadastro "Conecte sua nuvem"
 * Fase 3 (Itens 5, 6 e 7):
 *  - Stepper de 5 passos com pareamento via OCI Cloud Shell (sem digitar OCIDs)
 *  - Botao "Copiar" (Clipboard nativo) + "Compartilhar" (Share nativo) + contador regressivo de 10 min
 *  - Espacos dedicados para imagens em assets/onboarding/ nos passos 2 a 4
 *  - Polling a cada 2s em GET /api/oci/pairing/:id/status (CONNECTED / EXPIRED / FAILED)
 *  - Caixa "Por que isso e seguro?", secao "Deu erro?", alternativa "Prefiro conectar manualmente"
 *    com parser do bloco [DEFAULT] do ~/.oci/config e limpeza imediata da chave .pem da memoria apos envio,
 *    secao "Como criar um usuario somente leitura" com policies copiaveis e atalho "Usar a conta da VM (demo)" para o dono.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  NativeModules,
  Platform,
  ToastAndroid,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCloud } from '../context/CloudContext';
import {
  telemetryRepository,
  OciPairingSessionPayload,
  OciPairingStatusPayload,
} from '../services/telemetryRepository';
import { CloudLogo } from '../components/CloudLogo';

const READONLY_IAM_POLICIES = [
  'Allow group CloudWatchReaders to inspect instances in tenancy',
  'Allow group CloudWatchReaders to read instance-family in tenancy',
  'Allow group CloudWatchReaders to read virtual-network-family in tenancy',
  'Allow group CloudWatchReaders to read metrics in tenancy',
  'Allow group CloudWatchReaders to read audit-events in tenancy',
].join('\n');

function copyToSystemClipboard(text: string, feedbackMessage: string) {
  try {
    const nativeClipboard =
      (NativeModules as any)?.Clipboard || (NativeModules as any)?.RNCClipboard;
    if (nativeClipboard && typeof nativeClipboard.setString === 'function') {
      nativeClipboard.setString(text);
      if (Platform.OS === 'android') {
        ToastAndroid.show(feedbackMessage, ToastAndroid.SHORT);
      } else {
        Alert.alert('Copiado', feedbackMessage);
      }
      return true;
    }
  } catch {
    // fallback abaixo
  }

  Share.share({ message: text }).catch(() => { });
  return false;
}

/**
 * Parser do bloco [DEFAULT] do arquivo ~/.oci/config (ignora key_file e comentarios)
 */
export function parseOciConfigBlock(rawText: string): {
  tenancyOcid?: string;
  userOcid?: string;
  fingerprint?: string;
  region?: string;
} {
  const lines = rawText.split(/\r?\n/);
  let inTargetProfile = true;
  let sawAnySection = false;
  const parsed: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      sawAnySection = true;
      inTargetProfile = sectionMatch[1].trim().toUpperCase() === 'DEFAULT';
      continue;
    }

    if (sawAnySection && !inTargetProfile) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim().toLowerCase();
    const val = line.slice(eqIndex + 1).trim();
    if (!val || key === 'key_file') continue;

    parsed[key] = val;
  }

  return {
    tenancyOcid: parsed.tenancy,
    userOcid: parsed.user,
    fingerprint: parsed.fingerprint,
    region: parsed.region,
  };
}

// ============================================================================
// 1. ETAPA POS-CADASTRO: "CONECTE SUA NUVEM" (COM "PULAR POR ENQUANTO")
// ============================================================================
export const ConnectCloudsIntroScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { masterUser, cloudAccounts, clearJustRegistered } = useAuth();
  const isOciConnected = Boolean(cloudAccounts.OCI?.isConfigured);

  const handleSkipOrContinue = () => {
    clearJustRegistered();
    navigation.replace('MainTabs');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.introHeader}>
          <Text style={styles.kickerBadge}>CONTA CRIADA COM SUCESSO</Text>
          <Text style={styles.screenTitle}>Conecte sua nuvem</Text>
          <Text style={styles.screenSubtitle}>
            Olá, {masterUser?.username || 'usuário'}! Conecte apenas os provedores que você utiliza,
            ou pule esta etapa e configure quando quiser.
          </Text>
        </View>

        {/* Card Oracle Cloud (OCI) */}
        <View style={[styles.providerCard, styles.providerCardOci]}>
          <View style={styles.providerCardTop}>
            <View style={styles.providerTitleRow}>
              <CloudLogo provider="OCI" size={26} />
              <View style={{ flex: 1 }}>
                <Text style={styles.providerName}>Oracle Cloud Infrastructure</Text>
                <Text style={styles.providerDesc}>
                  Conexão rápida pelo Cloud Shell sem digitar OCIDs (somente leitura).
                </Text>
              </View>
            </View>
          </View>

          {isOciConnected ? (
            <View style={styles.connectedTag}>
              <Text style={styles.connectedTagText}>
                CONECTADA — {cloudAccounts.OCI.tenancyName || cloudAccounts.OCI.accountIdentifier}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.ociConnectBtn}
              onPress={() => navigation.navigate('OciOnboarding')}
              activeOpacity={0.85}
            >
              <Text style={styles.ociConnectBtnText}>Conectar Oracle Cloud</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Card Amazon Web Services (AWS - Em breve) */}
        <View style={[styles.providerCard, styles.providerCardDisabled]}>
          <View style={styles.providerTitleRow}>
            <CloudLogo provider="AWS" size={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.providerNameMuted}>Amazon Web Services (AWS)</Text>
              <Text style={styles.providerDescMuted}>
                Integração real via IAM Role / CloudWatch prevista para a Sprint 3.
              </Text>
            </View>
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>Em breve</Text>
            </View>
          </View>
        </View>

        {/* Card Google Cloud Platform (GCP - Em breve) */}
        <View style={[styles.providerCard, styles.providerCardDisabled]}>
          <View style={styles.providerTitleRow}>
            <CloudLogo provider="GCP" size={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.providerNameMuted}>Google Cloud Platform (GCP)</Text>
              <Text style={styles.providerDescMuted}>
                Integração real via Cloud Monitoring prevista para a Sprint 3.
              </Text>
            </View>
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>Em breve</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={isOciConnected ? styles.primaryProceedBtn : styles.skipBtn}
          onPress={handleSkipOrContinue}
          activeOpacity={0.8}
        >
          <Text style={isOciConnected ? styles.primaryProceedBtnText : styles.skipBtnText}>
            {isOciConnected ? 'Ir para o Painel' : 'Pular por enquanto'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================================
// 2. TELA PRINCIPAL: "CONECTAR ORACLE CLOUD" (STEPPER GUIADO + ALTERNATIVA MANUAL)
// ============================================================================
export const OciOnboardingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    isOwnerUser,
    refreshCloudAccounts,
    linkCloudProvider,
    activateOwnerDemoAccount,
    clearJustRegistered,
  } = useAuth();
  const { refreshMetrics } = useCloud();

  const [pairingSession, setPairingSession] = useState<OciPairingSessionPayload | null>(null);
  const [pairingStatus, setPairingStatus] = useState<OciPairingStatusPayload | null>(null);
  const [isGeneratingCommand, setIsGeneratingCommand] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Secoes expansiveis
  const [showErrorHelp, setShowErrorHelp] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showReadOnlyGuide, setShowReadOnlyGuide] = useState(false);

  // Estado da conexao manual (chave .pem e passphrase sao limpas imediatamente apos o envio)
  const [configPasteText, setConfigPasteText] = useState('');
  const [manualTenancyOcid, setManualTenancyOcid] = useState('');
  const [manualUserOcid, setManualUserOcid] = useState('');
  const [manualFingerprint, setManualFingerprint] = useState('');
  const [manualRegion, setManualRegion] = useState('sa-saopaulo-1');
  const [manualPem, setManualPem] = useState('');
  const [manualPassphrase, setManualPassphrase] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccessInfo, setManualSuccessInfo] = useState<{
    permissionStatus?: string;
    hint?: string;
  } | null>(null);

  // Estado do atalho demo do dono da VM
  const [isActivatingDemo, setIsActivatingDemo] = useState(false);

  const syncedOnConnectRef = useRef<string | null>(null);

  // Contador regressivo de expiracao (10 min)
  useEffect(() => {
    if (!pairingSession?.expiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const diffMs = new Date(pairingSession.expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      setRemainingSeconds(secs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pairingSession?.expiresAt]);

  // Passo 5: Polling a cada 2s em GET /api/oci/pairing/:id/status enquanto PENDING
  useEffect(() => {
    if (!pairingSession?.id) return;
    if (
      pairingStatus &&
      (pairingStatus.status === 'CONNECTED' ||
        pairingStatus.status === 'EXPIRED' ||
        pairingStatus.status === 'FAILED')
    ) {
      return;
    }

    let active = true;

    const poll = async () => {
      const res = await telemetryRepository.getPairingStatus(pairingSession.id);
      if (!active || !res.ok || !res.data) return;

      setPairingStatus(res.data);

      if (
        res.data.status === 'CONNECTED' &&
        syncedOnConnectRef.current !== pairingSession.id
      ) {
        syncedOnConnectRef.current = pairingSession.id;
        await refreshCloudAccounts();
        await refreshMetrics(true);
      }
    };

    poll();
    const timer = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pairingSession?.id, pairingStatus?.status, refreshCloudAccounts, refreshMetrics]);

  const handleGenerateCommand = async () => {
    setIsGeneratingCommand(true);
    setCommandError(null);
    setPairingStatus(null);
    setCopiedFeedback(false);

    const res = await telemetryRepository.createPairingSession();
    setIsGeneratingCommand(false);

    if (!res.ok || !res.data) {
      setCommandError(
        res.error || 'Não foi possível gerar o comando de conexão no momento.'
      );
      return;
    }

    setPairingSession(res.data);
  };

  const handleCopyCommand = () => {
    if (!pairingSession?.command) return;
    copyToSystemClipboard(pairingSession.command, 'Comando copiado para a área de transferência!');
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2500);
  };

  const handleShareCommand = async () => {
    if (!pairingSession?.command) return;
    try {
      await Share.share({
        title: 'Comando de conexão CloudWatch — Oracle Cloud',
        message: pairingSession.command,
      });
    } catch {
      // compartilhamento cancelado pelo usuario
    }
  };

  const handleConfigPasteChange = (text: string) => {
    setConfigPasteText(text);
    const extracted = parseOciConfigBlock(text);
    if (extracted.tenancyOcid) setManualTenancyOcid(extracted.tenancyOcid);
    if (extracted.userOcid) setManualUserOcid(extracted.userOcid);
    if (extracted.fingerprint) setManualFingerprint(extracted.fingerprint);
    if (extracted.region) setManualRegion(extracted.region);
  };

  const handleManualConnect = async () => {
    setManualError(null);
    setManualSuccessInfo(null);

    if (
      !manualTenancyOcid.trim() ||
      !manualUserOcid.trim() ||
      !manualFingerprint.trim() ||
      !manualRegion.trim() ||
      !manualPem.trim()
    ) {
      setManualError(
        'Cole o bloco [DEFAULT] do seu ~/.oci/config (ou preencha Tenancy, User, Fingerprint e Região) e cole a chave privada .pem.'
      );
      return;
    }

    const pemToSend = manualPem;
    const passphraseToSend = manualPassphrase;

    // Apaga imediatamente a chave privada e a passphrase do estado do aplicativo logo no envio
    setManualPem('');
    setManualPassphrase('');
    setIsSubmittingManual(true);

    const res = await linkCloudProvider(
      'OCI',
      {
        tenancyOcid: manualTenancyOcid.trim(),
        userOcid: manualUserOcid.trim(),
        fingerprint: manualFingerprint.trim(),
        region: manualRegion.trim().toLowerCase(),
        privateKeyPem: pemToSend,
        passphrase: passphraseToSend,
      },
      false
    );

    setIsSubmittingManual(false);

    if (!res.success) {
      setManualError(
        res.error ||
        'A Oracle Cloud rejeitou as credenciais informadas. Nada foi salvo.'
      );
      return;
    }

    setManualSuccessInfo({
      permissionStatus: res.permissionStatus,
      hint: res.hint,
    });
    await refreshMetrics(true);
  };

  const handleOwnerDemoConnect = async () => {
    setIsActivatingDemo(true);
    const res = await activateOwnerDemoAccount();
    setIsActivatingDemo(false);

    if (!res.success) {
      Alert.alert(
        'Conta da VM indisponível',
        res.error || 'Não foi possível autenticar via Instance Principal.'
      );
      return;
    }

    await refreshMetrics(true);
    clearJustRegistered();
    navigation.navigate('MainTabs');
  };

  const handleFinishToDashboard = () => {
    clearJustRegistered();
    navigation.navigate('MainTabs');
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const currentStatus =
    pairingStatus?.status ||
    (pairingSession && remainingSeconds === 0 ? 'EXPIRED' : pairingSession ? 'PENDING' : null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Barra Superior */}
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                handleFinishToDashboard();
              }
            }}
          >
            <Text style={styles.backBtnText}>← Voltar</Text>
          </TouchableOpacity>
          <View style={styles.ociHeaderChip}>
            <CloudLogo provider="OCI" size={16} />
            <Text style={styles.ociHeaderChipText}>ORACLE CLOUD</Text>
          </View>
        </View>

        <Text style={styles.screenTitle}>Conectar Oracle Cloud</Text>
        <Text style={styles.screenSubtitle}>
          Siga os passos abaixo para vincular sua conta OCI em menos de 1 minuto pelo Cloud Shell,
          sem precisar copiar ou digitar OCIDs no celular.
        </Text>

        {/* Atalho exclusivo caso /api/oci/status indique OWNER_USERNAME */}
        {isOwnerUser && (
          <View style={styles.ownerDemoBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerDemoTitle}>Administrador do Servidor Detectado</Text>
              <Text style={styles.ownerDemoDesc}>
                Você pode conectar instantaneamente usando o Instance Principal da própria VM da OCI.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.ownerDemoBtn}
              onPress={handleOwnerDemoConnect}
              disabled={isActivatingDemo}
            >
              {isActivatingDemo ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.ownerDemoBtnText}>Usar a conta da VM (demo)</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* PASSO 1: GERAR COMANDO */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Gere seu comando de uso único</Text>
          </View>

          {!pairingSession ? (
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerateCommand}
              disabled={isGeneratingCommand}
              activeOpacity={0.85}
            >
              {isGeneratingCommand ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.generateBtnText}>Gerar comando de conexão</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.commandContainer}>
              <View style={styles.timerRow}>
                <Text style={styles.timerLabel}>CÓDIGO DE USO ÚNICO</Text>
                <Text
                  style={[
                    styles.timerValue,
                    remainingSeconds < 90 && { color: '#F29900' },
                    remainingSeconds === 0 && { color: '#F28B82' },
                  ]}
                >
                  {remainingSeconds > 0
                    ? `Expira em ${formatCountdown(remainingSeconds)}`
                    : 'Comando expirado'}
                </Text>
              </View>

              <View style={styles.selectableCommandBox}>
                <Text selectable style={styles.commandMonoText}>
                  {pairingSession.command}
                </Text>
              </View>

              <View style={styles.commandActionsRow}>
                <TouchableOpacity
                  style={styles.copyActionBtn}
                  onPress={handleCopyCommand}
                  activeOpacity={0.8}
                >
                  <Text style={styles.copyActionBtnText}>
                    {copiedFeedback ? '✓ Copiado!' : 'Copiar'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareActionBtn}
                  onPress={handleShareCommand}
                  activeOpacity={0.8}
                >
                  <Text style={styles.shareActionBtnText}>Compartilhar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {commandError && (
            <View style={styles.errorAlertBox}>
              <Text style={styles.errorAlertText}>{commandError}</Text>
            </View>
          )}
        </View>

        {/* PASSO 2: ABRIR CONSOLE DA ORACLE CLOUD */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Text style={styles.stepTitle}>Abra o Console da Oracle Cloud</Text>
          </View>
          <Text style={styles.stepBodyText}>
            No computador, acesse <Text style={styles.inlineHighlight}>cloud.oracle.com</Text> e faça
            login normalmente na sua conta.
          </Text>
          <View style={styles.onboardingImageSlot}>
            <Text style={styles.onboardingImageSlotTitle}>Espaço para imagem do Passo 2</Text>
            <Text style={styles.onboardingImageSlotPath}>
              assets/onboarding/step2-console-login.png
            </Text>
          </View>
        </View>

        {/* PASSO 3: ABRIR O CLOUD SHELL */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <Text style={styles.stepTitle}>Abra o Cloud Shell</Text>
          </View>
          <Text style={styles.stepBodyText}>
            No canto superior direito do painel da Oracle Cloud, clique no ícone{' '}
            <Text style={styles.inlineHighlight}>{'>_'}</Text> (Developer Tools → Cloud Shell).
          </Text>
          <View style={styles.onboardingImageSlot}>
            <Text style={styles.onboardingImageSlotTitle}>Espaço para imagem do Passo 3</Text>
            <Text style={styles.onboardingImageSlotPath}>
              assets/onboarding/step3-open-cloudshell.png
            </Text>
          </View>
        </View>

        {/* PASSO 4: COLAR O COMANDO E PRESSIONAR ENTER */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>4</Text>
            </View>
            <Text style={styles.stepTitle}>Cole o comando e aperte Enter</Text>
          </View>
          <Text style={styles.stepBodyText}>
            Cole o comando do Passo 1 no terminal do Cloud Shell e aperte{' '}
            <Text style={styles.inlineHighlight}>Enter</Text>. Você também pode rodar sem o{' '}
            <Text style={styles.inlineMono}>| bash</Text> antes, se quiser inspecionar o script.
          </Text>
          <View style={styles.onboardingImageSlot}>
            <Text style={styles.onboardingImageSlotTitle}>Espaço para imagem do Passo 4</Text>
            <Text style={styles.onboardingImageSlotPath}>
              assets/onboarding/step4-paste-command.png
            </Text>
          </View>
        </View>

        {/* PASSO 5: AGUARDANDO CONFIRMACAO EM TEMPO REAL */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>5</Text>
            </View>
            <Text style={styles.stepTitle}>Confirmação automática</Text>
          </View>

          {!pairingSession && (
            <Text style={styles.stepMutedNote}>
              Gere o comando no Passo 1 para iniciar a verificação automática a cada 2 segundos.
            </Text>
          )}

          {currentStatus === 'PENDING' && (
            <View style={styles.waitingStatusBox}>
              <ActivityIndicator size="small" color="#8AB4F8" />
              <Text style={styles.waitingStatusText}>
                Aguardando você colar o comando...
              </Text>
            </View>
          )}

          {currentStatus === 'CONNECTED' && pairingStatus && (
            <View style={styles.connectedResultBox}>
              <Text style={styles.connectedResultTitle}>✓ Conta Oracle Cloud conectada!</Text>
              <View style={styles.connectedMetaGrid}>
                <Text style={styles.connectedMetaLine}>
                  Tenancy: <Text style={styles.connectedMetaStrong}>{pairingStatus.tenancyName}</Text>
                </Text>
                <Text style={styles.connectedMetaLine}>
                  Região: <Text style={styles.connectedMetaStrong}>{pairingStatus.region}</Text>
                </Text>
                <Text style={styles.connectedMetaLine}>
                  Instâncias visíveis:{' '}
                  <Text style={styles.connectedMetaStrong}>
                    {pairingStatus.instanceCount ?? 0}
                  </Text>
                </Text>
              </View>

              {pairingStatus.permissionStatus === 'NO_PERMISSION' && (
                <View style={styles.policyWarningBox}>
                  <Text style={styles.policyWarningTitle}>
                    ⚠️ Falta permissão de leitura (IAM Policy)
                  </Text>
                  <Text style={styles.policyWarningText}>
                    A autenticação funcionou, mas seu usuário OCI ainda não tem permissão para
                    listar instâncias e métricas. Adicione estas policies na Tenancy:
                  </Text>
                  <Text selectable style={styles.policyCodeBlock}>
                    {pairingStatus.hint || READONLY_IAM_POLICIES}
                  </Text>
                  <TouchableOpacity
                    style={styles.copyPoliciesSmallBtn}
                    onPress={() =>
                      copyToSystemClipboard(
                        READONLY_IAM_POLICIES,
                        'Policies copiadas para a área de transferência!'
                      )
                    }
                  >
                    <Text style={styles.copyPoliciesSmallBtnText}>Copiar Policies</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.primaryProceedBtn}
                onPress={handleFinishToDashboard}
              >
                <Text style={styles.primaryProceedBtnText}>Abrir Painel de Instâncias</Text>
              </TouchableOpacity>
            </View>
          )}

          {(currentStatus === 'EXPIRED' || currentStatus === 'FAILED') && (
            <View style={styles.failedResultBox}>
              <Text style={styles.failedResultTitle}>
                {currentStatus === 'EXPIRED'
                  ? '⏱️ O comando de conexão expirou'
                  : '❌ Não foi possível conectar a conta OCI'}
              </Text>
              <Text style={styles.failedResultReason}>
                {pairingStatus?.errorMessage ||
                  'O código expirou após 10 minutos sem confirmação. Nenhuma credencial foi salva.'}
              </Text>
              <TouchableOpacity
                style={styles.regenerateBtn}
                onPress={handleGenerateCommand}
                disabled={isGeneratingCommand}
              >
                <Text style={styles.regenerateBtnText}>Gerar novo comando</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* CAIXA: POR QUE ISSO E SEGURO? */}
        <View style={styles.securityInfoCard}>
          <Text style={styles.securityInfoTitle}>🔒 Por que isso é seguro?</Text>
          <Text style={styles.securityInfoBullet}>
            • O comando cria uma chave de API exclusiva para o aplicativo e apaga a chave local do
            Cloud Shell imediatamente ao terminar.
          </Text>
          <Text style={styles.securityInfoBullet}>
            • A chave privada nunca fica salva no seu celular: somente o servidor BFF a guarda,
            criptografada com AES-256-GCM.
          </Text>
          <Text style={styles.securityInfoBullet}>
            • Você mantém controle total e pode revogar o acesso quando quiser no Console da OCI em{' '}
            <Text style={styles.inlineHighlight}>
              Configurações do usuário → Chaves de API
            </Text>
            .
          </Text>
        </View>

        {/* SECAO EXPANSIVEL: DEU ERRO? */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setShowErrorHelp((v) => !v)}
          >
            <Text style={styles.accordionTitle}>Deu erro?</Text>
            <Text style={styles.accordionChevron}>{showErrorHelp ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showErrorHelp && (
            <View style={styles.accordionBody}>
              <Text style={styles.faqQuestion}>1. Conta federada (Identity Domain / SSO)</Text>
              <Text style={styles.faqAnswer}>
                Contas federadas no Cloud Shell não expõem um OCID direto `ocid1.user...` para upload
                via CLI. Use a seção "Prefiro conectar manualmente" abaixo com um usuário IAM de
                leitura.
              </Text>

              <Text style={styles.faqQuestion}>2. Limite máximo de chaves de API atingido</Text>
              <Text style={styles.faqAnswer}>
                A Oracle Cloud permite até 3 chaves de API por usuário. Abra Perfil → Configurações
                do usuário → Chaves de API no Console OCI, apague uma chave antiga e gere um novo
                comando.
              </Text>

              <Text style={styles.faqQuestion}>3. O Cloud Shell não abre</Text>
              <Text style={styles.faqAnswer}>
                Usuários não administradores precisam da policy `Allow group {'<grupo>'} to use
                cloud-shell in tenancy`, ou podem conectar pela opção manual abaixo.
              </Text>

              <Text style={styles.faqQuestion}>4. Comando expirado ou já utilizado</Text>
              <Text style={styles.faqAnswer}>
                Por segurança, cada código vale por 10 minutos e funciona uma única vez. Toque em
                "Gerar novo comando" no Passo 1.
              </Text>
            </View>
          )}
        </View>

        {/* SECAO EXPANSIVEL: PREFIRO CONECTAR MANUALMENTE */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setShowManualForm((v) => !v)}
          >
            <Text style={styles.accordionTitle}>Prefiro conectar manualmente</Text>
            <Text style={styles.accordionChevron}>{showManualForm ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showManualForm && (
            <View style={styles.accordionBody}>
              <Text style={styles.manualHelperText}>
                Cole abaixo o bloco <Text style={styles.inlineMono}>[DEFAULT]</Text> do seu arquivo{' '}
                <Text style={styles.inlineMono}>~/.oci/config</Text> (o campo{' '}
                <Text style={styles.inlineMono}>key_file</Text> será ignorado automaticamente):
              </Text>

              <Text style={styles.fieldLabel}>COLAR CONFIGURAÇÃO (~/.oci/config)</Text>
              <TextInput
                style={[styles.textInput, styles.multilineConfigInput]}
                value={configPasteText}
                onChangeText={handleConfigPasteChange}
                placeholder={'[DEFAULT]\nuser=ocid1.user.oc1..aaaa...\nfingerprint=aa:bb:cc:...\ntenancy=ocid1.tenancy.oc1..aaaa...\nregion=sa-saopaulo-1'}
                placeholderTextColor="#5F6368"
                multiline
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>TENANCY OCID</Text>
              <TextInput
                style={styles.textInput}
                value={manualTenancyOcid}
                onChangeText={setManualTenancyOcid}
                placeholder="ocid1.tenancy.oc1..aaaa..."
                placeholderTextColor="#5F6368"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>USER OCID</Text>
              <TextInput
                style={styles.textInput}
                value={manualUserOcid}
                onChangeText={setManualUserOcid}
                placeholder="ocid1.user.oc1..aaaa..."
                placeholderTextColor="#5F6368"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>FINGERPRINT</Text>
              <TextInput
                style={styles.textInput}
                value={manualFingerprint}
                onChangeText={setManualFingerprint}
                placeholder="aa:bb:cc:dd:ee:ff:..."
                placeholderTextColor="#5F6368"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>REGIÃO OCI</Text>
              <TextInput
                style={styles.textInput}
                value={manualRegion}
                onChangeText={setManualRegion}
                placeholder="sa-saopaulo-1"
                placeholderTextColor="#5F6368"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>CHAVE PRIVADA (.PEM)</Text>
              <TextInput
                style={[styles.textInput, styles.multilinePemInput]}
                value={manualPem}
                onChangeText={setManualPem}
                placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                placeholderTextColor="#5F6368"
                multiline
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>PASSPHRASE DA CHAVE (OPCIONAL)</Text>
              <TextInput
                style={styles.textInput}
                value={manualPassphrase}
                onChangeText={setManualPassphrase}
                placeholder="Deixe em branco se a chave não tiver senha"
                placeholderTextColor="#5F6368"
                secureTextEntry
                autoCapitalize="none"
              />

              {manualError && (
                <View style={styles.errorAlertBox}>
                  <Text style={styles.errorAlertText}>{manualError}</Text>
                </View>
              )}

              {manualSuccessInfo && (
                <View style={styles.connectedResultBox}>
                  <Text style={styles.connectedResultTitle}>
                    ✓ Credenciais verificadas na OCI e salvas com segurança!
                  </Text>
                  {manualSuccessInfo.permissionStatus === 'NO_PERMISSION' && (
                    <View style={styles.policyWarningBox}>
                      <Text style={styles.policyWarningTitle}>
                        ⚠️ Conta autenticada sem policies de leitura
                      </Text>
                      <Text selectable style={styles.policyCodeBlock}>
                        {manualSuccessInfo.hint || READONLY_IAM_POLICIES}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.primaryProceedBtn}
                    onPress={handleFinishToDashboard}
                  >
                    <Text style={styles.primaryProceedBtnText}>Ir para o Painel</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.manualSubmitBtn}
                onPress={handleManualConnect}
                disabled={isSubmittingManual}
              >
                {isSubmittingManual ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.manualSubmitBtnText}>Validar na OCI e Conectar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* SECAO EXPANSIVEL: COMO CRIAR UM USUARIO SOMENTE LEITURA */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setShowReadOnlyGuide((v) => !v)}
          >
            <Text style={styles.accordionTitle}>Como criar um usuário somente leitura</Text>
            <Text style={styles.accordionChevron}>{showReadOnlyGuide ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showReadOnlyGuide && (
            <View style={styles.accordionBody}>
              <Text style={styles.faqAnswer}>
                Para seguir o princípio do menor privilégio na Oracle Cloud, crie um grupo{' '}
                <Text style={styles.inlineMono}>CloudWatchReaders</Text>, adicione seu usuário de
                monitoramento a ele e aplique estas policies na raiz da Tenancy:
              </Text>

              <Text selectable style={styles.policyCodeBlock}>
                {READONLY_IAM_POLICIES}
              </Text>

              <TouchableOpacity
                style={styles.copyPoliciesSmallBtn}
                onPress={() =>
                  copyToSystemClipboard(
                    READONLY_IAM_POLICIES,
                    'Policies de somente leitura copiadas!'
                  )
                }
              >
                <Text style={styles.copyPoliciesSmallBtnText}>Copiar Policies</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F1318',
  },
  container: {
    padding: 18,
    paddingBottom: 42,
  },
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#282E38',
  },
  backBtnText: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '600',
  },
  ociHeaderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(248, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 0, 0, 0.3)',
  },
  ociHeaderChipText: {
    color: '#FF6B6B',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  introHeader: {
    marginBottom: 20,
    marginTop: 8,
  },
  kickerBadge: {
    color: '#81C995',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
  },
  screenTitle: {
    color: '#E8EAED',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  screenSubtitle: {
    color: '#9AA0A6',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  providerCard: {
    backgroundColor: '#181C22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 16,
    marginBottom: 12,
  },
  providerCardOci: {
    borderColor: '#5C2323',
  },
  providerCardDisabled: {
    opacity: 0.65,
  },
  providerCardTop: {
    marginBottom: 14,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerName: {
    color: '#E8EAED',
    fontSize: 15,
    fontWeight: '700',
  },
  providerDesc: {
    color: '#9AA0A6',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  providerNameMuted: {
    color: '#BDC1C6',
    fontSize: 14,
    fontWeight: '700',
  },
  providerDescMuted: {
    color: '#80868B',
    fontSize: 11,
    marginTop: 2,
  },
  soonBadge: {
    backgroundColor: '#202630',
    borderWidth: 1,
    borderColor: '#3C4043',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  soonBadgeText: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '700',
  },
  ociConnectBtn: {
    backgroundColor: '#C74634',
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ociConnectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  connectedTag: {
    backgroundColor: 'rgba(129, 201, 149, 0.14)',
    borderColor: 'rgba(129, 201, 149, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  connectedTagText: {
    color: '#81C995',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  skipBtn: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#282E38',
    alignItems: 'center',
    backgroundColor: '#14181F',
  },
  skipBtnText: {
    color: '#BDC1C6',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryProceedBtn: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1A73E8',
  },
  primaryProceedBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  ownerDemoBox: {
    backgroundColor: '#16202E',
    borderColor: '#2B4C7E',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  ownerDemoTitle: {
    color: '#8AB4F8',
    fontSize: 13,
    fontWeight: '700',
  },
  ownerDemoDesc: {
    color: '#BDC1C6',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  ownerDemoBtn: {
    backgroundColor: '#1A73E8',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  ownerDemoBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepCard: {
    backgroundColor: '#181C22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 15,
    marginBottom: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#C74634',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepTitle: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  stepBodyText: {
    color: '#BDC1C6',
    fontSize: 12,
    lineHeight: 18,
  },
  stepMutedNote: {
    color: '#80868B',
    fontSize: 12,
    lineHeight: 18,
  },
  inlineHighlight: {
    color: '#E8EAED',
    fontWeight: '700',
  },
  inlineMono: {
    color: '#8AB4F8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  onboardingImageSlot: {
    marginTop: 10,
    height: 96,
    borderRadius: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#363E4C',
    backgroundColor: '#11151B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  onboardingImageSlotTitle: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '700',
  },
  onboardingImageSlotPath: {
    color: '#5F6368',
    fontSize: 10,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  generateBtn: {
    backgroundColor: '#C74634',
    paddingVertical: 13,
    borderRadius: 9,
    alignItems: 'center',
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  commandContainer: {
    marginTop: 4,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerLabel: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timerValue: {
    color: '#81C995',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  selectableCommandBox: {
    backgroundColor: '#0B0E12',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2F3642',
    padding: 12,
  },
  commandMonoText: {
    color: '#8AB4F8',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  commandActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  copyActionBtn: {
    flex: 1,
    backgroundColor: '#1A73E8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  shareActionBtn: {
    flex: 1,
    backgroundColor: '#232832',
    borderWidth: 1,
    borderColor: '#3C4043',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareActionBtnText: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
  },
  waitingStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#11161F',
    borderWidth: 1,
    borderColor: '#243248',
    borderRadius: 9,
    padding: 12,
  },
  waitingStatusText: {
    color: '#8AB4F8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  connectedResultBox: {
    backgroundColor: 'rgba(129, 201, 149, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(129, 201, 149, 0.35)',
    borderRadius: 10,
    padding: 13,
    marginTop: 6,
  },
  connectedResultTitle: {
    color: '#81C995',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  connectedMetaGrid: {
    gap: 4,
    marginBottom: 6,
  },
  connectedMetaLine: {
    color: '#BDC1C6',
    fontSize: 12,
  },
  connectedMetaStrong: {
    color: '#E8EAED',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  policyWarningBox: {
    marginTop: 10,
    backgroundColor: 'rgba(242, 153, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(242, 153, 0, 0.4)',
    borderRadius: 8,
    padding: 11,
  },
  policyWarningTitle: {
    color: '#FDD663',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  policyWarningText: {
    color: '#E8EAED',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  policyCodeBlock: {
    backgroundColor: '#0B0E12',
    color: '#8AB4F8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    lineHeight: 16,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#282E38',
  },
  copyPoliciesSmallBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#232832',
    borderWidth: 1,
    borderColor: '#3C4043',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  copyPoliciesSmallBtnText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
  },
  failedResultBox: {
    backgroundColor: 'rgba(242, 139, 130, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(242, 139, 130, 0.35)',
    borderRadius: 10,
    padding: 13,
  },
  failedResultTitle: {
    color: '#F28B82',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  failedResultReason: {
    color: '#E8EAED',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  regenerateBtn: {
    backgroundColor: '#C74634',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  regenerateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  errorAlertBox: {
    marginTop: 10,
    backgroundColor: 'rgba(242, 139, 130, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242, 139, 130, 0.4)',
    borderRadius: 8,
    padding: 11,
  },
  errorAlertText: {
    color: '#F28B82',
    fontSize: 12,
    lineHeight: 17,
  },
  securityInfoCard: {
    backgroundColor: '#141A22',
    borderWidth: 1,
    borderColor: '#243142',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    gap: 6,
  },
  securityInfoTitle: {
    color: '#8AB4F8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  securityInfoBullet: {
    color: '#BDC1C6',
    fontSize: 12,
    lineHeight: 18,
  },
  accordionCard: {
    backgroundColor: '#181C22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
    marginBottom: 10,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  accordionTitle: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '700',
  },
  accordionChevron: {
    color: '#9AA0A6',
    fontSize: 12,
  },
  accordionBody: {
    paddingHorizontal: 15,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#232832',
    paddingTop: 12,
  },
  faqQuestion: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 3,
  },
  faqAnswer: {
    color: '#9AA0A6',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  manualHelperText: {
    color: '#BDC1C6',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 10,
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#0F1318',
    borderWidth: 1,
    borderColor: '#282E38',
    borderRadius: 8,
    color: '#E8EAED',
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  multilineConfigInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  multilinePemInput: {
    minHeight: 104,
    textAlignVertical: 'top',
  },
  manualSubmitBtn: {
    marginTop: 14,
    backgroundColor: '#C74634',
    paddingVertical: 12,
    borderRadius: 9,
    alignItems: 'center',
  },
  manualSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default OciOnboardingScreen;

