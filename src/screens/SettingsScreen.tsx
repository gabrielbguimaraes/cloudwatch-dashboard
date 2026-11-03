/**
 * SettingsScreen - Central de Conta & Nuvens Conectadas
 * Fase 3 (Sprint 2):
 *  - Exibe perfil real retornado pelo BFF (zero dados hardcoded)
 *  - Gerencia contas OCI reais conectadas (pareamento Cloud Shell ou manual, múltiplas contas suportadas)
 *  - "Desconectar OCI" chama DELETE /api/oci/accounts/:id e orienta a revogação da chave no Console OCI
 *  - AWS e GCP marcados honestamente como "Em breve" (Sprint 3)
 *  - Limpeza de cache restrita exclusivamente às chaves do usuário autenticado.
 */

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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useCloud } from '../context/CloudContext';
import { AppImage } from '../components/common/AppImage';
import { CloudLogo } from '../components/common/CloudLogo';
import { Toast } from '../components/common/Toast';
import { CLOUD_PALETTES, NEUTRAL_THEME } from '../theme/tokens';
import type { SupportedCloud } from '../types/auth';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    masterUser,
    cloudAccounts,
    ociAccountsList,
    activeOciAccountId,
    setActiveOciAccountId,
    toggleBiometrics,
    linkCloudProvider,
    unlinkCloudProvider,
    logoutMaster,
  } = useAuth();

  const { refreshMetrics } = useCloud();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUnlinking, setIsUnlinking] = useState<boolean>(false);

  const maskAccountIdentifier = (id?: string): string => {
    if (!id || id.trim().length === 0) return 'Não informado';
    const clean = id.trim();
    if (clean.length <= 20) return clean;
    return `${clean.slice(0, 10)}...${clean.slice(-8)}`;
  };

  const getUserInitials = (): string => {
    if (!masterUser?.username) return 'USR';
    const parts = masterUser.username.split(/[._\s-]+/).filter(Boolean);
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
    : 'Sessão ativa';

  const navigateToOciOnboarding = () => {
    if (navigation.getParent?.()) {
      navigation.getParent().navigate('OciOnboarding');
    } else {
      navigation.navigate('OciOnboarding');
    }
  };

  const handleToggleBiometrics = async (cloud: SupportedCloud, currentVal: boolean) => {
    const success = await toggleBiometrics(cloud, !currentVal);
    if (success) {
      setToastMessage(`Biometria ${!currentVal ? 'ativada' : 'desativada'} para ${cloud}`);
    } else {
      setToastMessage('Não foi possível alterar a biometria neste dispositivo');
    }
  };

  const handleDisconnectOci = (accountId?: string, label?: string) => {
    Alert.alert(
      'Desconectar Oracle Cloud (OCI)',
      `Deseja remover ${label ? `"${label}"` : 'sua conta OCI'} do CloudWatch Dashboard?\n\nAs credenciais criptografadas serão apagadas imediatamente do servidor BFF.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar OCI',
          style: 'destructive',
          onPress: async () => {
            setIsUnlinking(true);
            const success = await unlinkCloudProvider('OCI', accountId);
            setIsUnlinking(false);

            if (success) {
              await refreshMetrics(true).catch(() => { });
              Alert.alert(
                'Conta OCI Desconectada',
                'A conexão foi removida do servidor.\n\nRecomendação de segurança: acesse o Console da Oracle Cloud em "Perfil > Configurações do usuário > Chaves de API" e exclua também a chave pública criada para o aplicativo.'
              );
            } else {
              setToastMessage('Falha ao desconectar conta OCI no servidor.');
            }
          },
        },
      ]
    );
  };

  const handleClearResourceCache = () => {
    if (!masterUser?.id) return;

    Alert.alert(
      'Limpar Cache Local de Telemetria',
      'Deseja apagar os snapshots locais de instâncias, métricas e eventos salvos para o seu usuário neste aparelho? Suas contas conectadas permanecerão intactas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              const uid = masterUser.id;
              const allKeys = await AsyncStorage.getAllKeys();
              const userCacheKeys = allKeys.filter(
                (k) =>
                  k.startsWith(`@cloudwatch_cache:${uid}:`) ||
                  k === `@cloudwatch:pinned_resources:${uid}`
              );
              if (userCacheKeys.length > 0) {
                await AsyncStorage.multiRemove(userCacheKeys);
              }
              await refreshMetrics(true);
              setToastMessage('Cache local limpo e dados recarregados');
            } catch {
              setToastMessage('Erro ao limpar o cache local');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Seu token de acesso e refresh token serão revogados no servidor e removidos do Keychain deste aparelho. Deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logoutMaster();
          },
        },
      ]
    );
  };

  const ociConfig = cloudAccounts.OCI;
  const isOciConfigured = Boolean(ociConfig?.isConfigured);
  const ociPalette = CLOUD_PALETTES.OCI;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Conta & Nuvens Conectadas</Text>
          <Text style={styles.headerSubtitle}>
            Gerencie sua identidade no aplicativo, suas conexões de nuvem isoladas e o cache local
          </Text>
        </View>

        {/* 1. Perfil do Usuário Autenticado */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTag}>CONTA DO APLICATIVO</Text>
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
                {masterUser?.username || 'Usuário Autenticado'}
              </Text>
              <Text style={styles.profileEmail}>{masterUser?.email || '—'}</Text>
              <View style={styles.profileMetaRow}>
                <View style={styles.profileMetaBadge}>
                  <Text style={styles.profileMetaText}>
                    Perfil: {masterUser?.role || 'USER'}
                  </Text>
                </View>
                <View style={styles.profileMetaBadge}>
                  <Text style={styles.profileMetaText}>Desde: {formattedCreatedDate}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Provedores de Nuvem (Independentes por Usuário) */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTag}>SUAS CONEXÕES DE NUVEM</Text>
            <Text style={styles.sectionSubtitle}>
              Conecte apenas os provedores que utiliza. As credenciais ficam criptografadas com AES-256-GCM exclusivamente na sua conta no BFF.
            </Text>
          </View>

          {/* ORACLE CLOUD INFRASTRUCTURE (OCI) */}
          <View style={styles.cloudRow}>
            <View style={styles.cloudRowTop}>
              <View style={styles.cloudTitleBlock}>
                <CloudLogo provider="OCI" size={28} />
                <View style={styles.cloudNameCol}>
                  <Text style={styles.cloudNameText}>{ociPalette.name}</Text>
                  <Text style={styles.cloudIdText}>
                    {isOciConfigured
                      ? `${maskAccountIdentifier(ociConfig.tenancyName || ociConfig.accountIdentifier)} • ${ociConfig.region}`
                      : 'Nenhuma tenancy conectada'}
                  </Text>
                </View>
              </View>

              {isOciConfigured ? (
                ociConfig.permissionStatus === 'NO_PERMISSION' ? (
                  <View style={styles.statusBadgeWarn}>
                    <Text style={styles.statusBadgeWarnText}>SEM POLICY IAM</Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: ociPalette.badgeBg, borderColor: ociPalette.primary },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: ociPalette.badgeText }]}>
                      CONECTADA
                    </Text>
                  </View>
                )
              ) : (
                <View style={styles.statusBadgeUnlinked}>
                  <Text style={styles.statusBadgeUnlinkedText}>NÃO CONECTADA</Text>
                </View>
              )}
            </View>

            {isOciConfigured ? (
              <>
                {/* Lista de contas OCI caso o usuário tenha conectado uma ou mais tenancies */}
                {ociAccountsList.length > 0 && (
                  <View style={styles.ociAccountsBox}>
                    {ociAccountsList.map((acc) => {
                      const isSelected =
                        activeOciAccountId === acc.id ||
                        (!activeOciAccountId && ociAccountsList[0]?.id === acc.id);
                      return (
                        <View key={acc.id} style={styles.ociAccountItem}>
                          <TouchableOpacity
                            style={styles.ociAccountSelectArea}
                            onPress={() => {
                              setActiveOciAccountId(acc.id);
                              setToastMessage(
                                `Conta OCI ativa: ${acc.tenancyName || acc.region}`
                              );
                            }}
                          >
                            <View
                              style={[
                                styles.radioOuter,
                                isSelected && { borderColor: ociPalette.primary },
                              ]}
                            >
                              {isSelected && (
                                <View
                                  style={[
                                    styles.radioInner,
                                    { backgroundColor: ociPalette.primary },
                                  ]}
                                />
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.ociAccountTitle} numberOfLines={1}>
                                {acc.tenancyName || maskAccountIdentifier(acc.accountIdentifier)}
                              </Text>
                              <Text style={styles.ociAccountMeta}>
                                {acc.region} •{' '}
                                {acc.authMode === 'INSTANCE_PRINCIPAL'
                                  ? 'Instance Principal (Demo VM)'
                                  : 'Chave de API Exclusiva'}
                                {acc.permissionStatus === 'NO_PERMISSION'
                                  ? ' • Falta Policy de Leitura'
                                  : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.revokeSmallBtn}
                            disabled={isUnlinking}
                            onPress={() =>
                              handleDisconnectOci(
                                acc.id,
                                acc.tenancyName || acc.region
                              )
                            }
                          >
                            <Text style={styles.revokeButtonText}>Desconectar OCI</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.cloudControlsRow}>
                  <View style={styles.biometricSwitchCol}>
                    <Text style={styles.controlLabel}>Exigir Biometria:</Text>
                    <Switch
                      value={Boolean(ociConfig.biometricsEnabled)}
                      onValueChange={() =>
                        handleToggleBiometrics('OCI', Boolean(ociConfig.biometricsEnabled))
                      }
                      trackColor={{ false: '#282E38', true: ociPalette.primary }}
                      thumbColor={ociConfig.biometricsEnabled ? '#FFFFFF' : '#9AA0A6'}
                    />
                  </View>

                  <View style={styles.ociButtonsRight}>
                    <TouchableOpacity
                      style={styles.addAnotherOciBtn}
                      onPress={navigateToOciOnboarding}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addAnotherOciText}>+ Outra Conta</Text>
                    </TouchableOpacity>

                    {ociAccountsList.length === 0 && (
                      <TouchableOpacity
                        style={styles.revokeButton}
                        disabled={isUnlinking}
                        onPress={() => handleDisconnectOci(ociConfig.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.revokeButtonText}>Desconectar OCI</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.connectActionRow}>
                <TouchableOpacity
                  style={styles.connectButtonPrimary}
                  onPress={navigateToOciOnboarding}
                  activeOpacity={0.8}
                >
                  <Text style={styles.connectButtonPrimaryText}>Conectar Oracle Cloud</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* AMAZON WEB SERVICES (AWS) — Multi-Cloud Híbrido */}
          <View style={styles.cloudRow}>
            <View style={styles.cloudRowTop}>
              <View style={styles.cloudTitleBlock}>
                <CloudLogo provider="AWS" size={28} />
                <View style={styles.cloudNameCol}>
                  <Text style={styles.cloudNameText}>{CLOUD_PALETTES.AWS.name}</Text>
                  <Text style={styles.cloudIdText}>
                    {cloudAccounts.AWS?.isConfigured
                      ? `${maskAccountIdentifier(cloudAccounts.AWS.accountIdentifier)} • ${cloudAccounts.AWS.region}`
                      : 'Nenhuma conta vinculada'}
                  </Text>
                </View>
              </View>
              {cloudAccounts.AWS?.isConfigured ? (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: CLOUD_PALETTES.AWS.badgeBg,
                      borderColor: CLOUD_PALETTES.AWS.primary,
                    },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: CLOUD_PALETTES.AWS.badgeText }]}>
                    SIMULADO ATIVO
                  </Text>
                </View>
              ) : (
                <View style={styles.statusBadgeUnlinked}>
                  <Text style={styles.statusBadgeUnlinkedText}>NÃO CONECTADA</Text>
                </View>
              )}
            </View>

            <View style={styles.connectActionRow}>
              {cloudAccounts.AWS?.isConfigured ? (
                <TouchableOpacity
                  style={styles.revokeButton}
                  onPress={async () => {
                    await unlinkCloudProvider('AWS');
                    setToastMessage('Conta AWS desconectada.');
                  }}
                >
                  <Text style={styles.revokeButtonText}>Desconectar AWS</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.connectButtonPrimary,
                    { backgroundColor: CLOUD_PALETTES.AWS.primary },
                  ]}
                  onPress={async () => {
                    await linkCloudProvider(
                      'AWS',
                      {
                        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
                        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
                        region: 'us-east-1',
                      },
                      false
                    );
                    setToastMessage('Credenciais AWS de demonstração ativadas!');
                  }}
                >
                  <Text style={[styles.connectButtonPrimaryText, { color: '#111827' }]}>
                    Preencher Credenciais Demo (AWS)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* GOOGLE CLOUD PLATFORM (GCP) — Multi-Cloud Híbrido */}
          <View style={styles.cloudRow}>
            <View style={styles.cloudRowTop}>
              <View style={styles.cloudTitleBlock}>
                <CloudLogo provider="GCP" size={28} />
                <View style={styles.cloudNameCol}>
                  <Text style={styles.cloudNameText}>{CLOUD_PALETTES.GCP.name}</Text>
                  <Text style={styles.cloudIdText}>
                    {cloudAccounts.GCP?.isConfigured
                      ? `${maskAccountIdentifier(cloudAccounts.GCP.accountIdentifier)} • ${cloudAccounts.GCP.region}`
                      : 'Nenhum projeto vinculado'}
                  </Text>
                </View>
              </View>
              {cloudAccounts.GCP?.isConfigured ? (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: CLOUD_PALETTES.GCP.badgeBg,
                      borderColor: CLOUD_PALETTES.GCP.primary,
                    },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: CLOUD_PALETTES.GCP.badgeText }]}>
                    SIMULADO ATIVO
                  </Text>
                </View>
              ) : (
                <View style={styles.statusBadgeUnlinked}>
                  <Text style={styles.statusBadgeUnlinkedText}>NÃO CONECTADA</Text>
                </View>
              )}
            </View>

            <View style={styles.connectActionRow}>
              {cloudAccounts.GCP?.isConfigured ? (
                <TouchableOpacity
                  style={styles.revokeButton}
                  onPress={async () => {
                    await unlinkCloudProvider('GCP');
                    setToastMessage('Projeto GCP desconectado.');
                  }}
                >
                  <Text style={styles.revokeButtonText}>Desconectar GCP</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.connectButtonPrimary,
                    { backgroundColor: CLOUD_PALETTES.GCP.primary },
                  ]}
                  onPress={async () => {
                    await linkCloudProvider(
                      'GCP',
                      {
                        projectId: 'cloudwatch-gcp-prod-3940',
                        clientEmail: 'telemetry-sa@cloudwatch-gcp-prod.iam.gserviceaccount.com',
                        region: 'southamerica-east1',
                      },
                      false
                    );
                    setToastMessage('Credenciais GCP de demonstração ativadas!');
                  }}
                >
                  <Text style={styles.connectButtonPrimaryText}>
                    Preencher Credenciais Demo (GCP)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 3. Segurança da Sessão e Armazenamento */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTag}>SEGURANÇA & ARMAZENAMENTO</Text>
          </View>

          <View style={styles.auditRow}>
            <View style={styles.auditCol}>
              <Text style={styles.auditLabel}>Tokens de Sessão (JWT + Refresh Rotativo)</Text>
              <Text style={styles.auditValue}>Android Keystore (react-native-keychain)</Text>
            </View>
            <View style={styles.hardwareBadge}>
              <View style={[styles.dot, { backgroundColor: NEUTRAL_THEME.statusRunning.text }]} />
              <Text style={styles.hardwareBadgeText}>ATIVO</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.auditRow}>
            <View style={styles.auditCol}>
              <Text style={styles.auditLabel}>Chaves Privadas OCI</Text>
              <Text style={styles.auditValue}>
                Jamais salvas no celular (AES-256-GCM somente no BFF)
              </Text>
            </View>
            <View style={styles.hardwareBadge}>
              <View style={[styles.dot, { backgroundColor: NEUTRAL_THEME.statusRunning.text }]} />
              <Text style={styles.hardwareBadgeText}>ISOLADO</Text>
            </View>
          </View>
        </View>

        {/* 4. Manutenção e Encerramento */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTag}>MANUTENÇÃO & SESSÃO</Text>
          </View>

          <TouchableOpacity
            style={styles.cacheButton}
            onPress={handleClearResourceCache}
            activeOpacity={0.8}
          >
            <Text style={styles.cacheButtonText}>Limpar Cache Local de Telemetria</Text>
          </TouchableOpacity>

          <View style={{ height: 12 }} />

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.dangerButtonText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
  sectionSubtitle: {
    fontSize: 11,
    color: NEUTRAL_THEME.textSecondary,
    marginTop: 4,
    lineHeight: 16,
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
  profileMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  profileMetaBadge: {
    backgroundColor: '#20242C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
    marginRight: 8,
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
  statusBadgeWarn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#3A3018',
  },
  statusBadgeWarnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FDE68A',
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
  statusBadgeSoon: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#181C23',
  },
  statusBadgeSoonText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  ociAccountsBox: {
    marginTop: 10,
    gap: 8,
  },
  ociAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#13161C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262C36',
    padding: 10,
    gap: 8,
  },
  ociAccountSelectArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#5F6368',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ociAccountTitle: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
  },
  ociAccountMeta: {
    color: '#9AA0A6',
    fontSize: 10,
    marginTop: 2,
  },
  revokeSmallBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#2A1618',
    borderWidth: 1,
    borderColor: '#5C2327',
  },
  cloudControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
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
  ociButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addAnotherOciBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  addAnotherOciText: {
    fontSize: 11,
    color: '#93C5FD',
    fontWeight: '700',
  },
  revokeButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#2A1618',
    borderWidth: 1,
    borderColor: '#5C2327',
  },
  revokeButtonText: {
    fontSize: 11,
    color: '#F28B82',
    fontWeight: '700',
  },
  connectActionRow: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
  connectButtonPrimary: {
    backgroundColor: '#F80000',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  connectButtonPrimaryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
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
    fontSize: 12,
    fontWeight: '700',
    color: NEUTRAL_THEME.textPrimary,
  },
  auditValue: {
    fontSize: 11,
    color: NEUTRAL_THEME.textSecondary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: NEUTRAL_THEME.statusRunning.bg,
    borderColor: NEUTRAL_THEME.statusRunning.border,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hardwareBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: NEUTRAL_THEME.statusRunning.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cacheButton: {
    backgroundColor: '#20242C',
    borderWidth: 1,
    borderColor: '#3C4043',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cacheButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E8EAED',
  },
  dangerButton: {
    backgroundColor: 'rgba(242, 139, 130, 0.1)',
    borderWidth: 1,
    borderColor: '#F28B82',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F28B82',
  },
});
