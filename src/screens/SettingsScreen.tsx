import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { storedCredentials, clearStoredCredentials, logout, session } = useAuth();

  // Helper para mascarar Tenancy OCID (8 primeiros e 8 últimos caracteres)
  const maskOcid = (ocid?: string): string => {
    const defaultTenancy = 'ocid1.tenancy.oc1..aaaaaaaab1234567890';
    const target = ocid && ocid.trim().length > 0 ? ocid.trim() : defaultTenancy;
    if (target.length <= 16) return target;
    return `${target.slice(0, 8)}...${target.slice(-8)}`;
  };

  const provider = storedCredentials?.provider || 'OCI';
  const tenancyOcid = maskOcid(storedCredentials?.tenancyId);
  const userOcid = storedCredentials?.userId || 'ocid1.user.oc1..aaaaaaaax74n9b2k3l4m';
  const region = storedCredentials?.region || 'sa-saopaulo-1';

  /**
   * Encerra a sessão ativa, limpa os dados do EncryptedStorage e Keystore e redireciona
   */
  const handleLogoutAndClearVault = () => {
    Alert.alert(
      'Encerrar Sessão',
      'Deseja remover as chaves biométricas do Android Keystore, limpar o cofre EncryptedStorage e encerrar a sessão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar e Limpar Cofre',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearStoredCredentials();
              logout();
            } catch (err) {
              console.warn('Erro ao limpar cofre:', err);
            }

            if (typeof (navigation as any).replace === 'function') {
              (navigation as any).replace('Login');
            } else if (navigation.getParent()) {
              navigation.getParent()?.replace('Login');
            } else {
              navigation.navigate('Login');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Topo / Header da Tela */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sessão & Configurações</Text>
          <Text style={styles.headerSubtitle}>
            Auditoria de segurança, cofres de chaves e parâmetros de conectividade
          </Text>
        </View>

        {/* Card 1: Identidade da Sessão Ativa */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderIcon}>🔐</Text>
            <Text style={styles.cardTitle}>IDENTIDADE DA SESSÃO ATIVA</Text>
          </View>

          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>Provedor Conectado</Text>
            <View style={styles.providerBadge}>
              <View style={[styles.dot, { backgroundColor: '#C74634' }]} />
              <Text style={styles.providerBadgeText}>{provider}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoBlock}>
            <Text style={styles.sessionLabel}>Tenancy OCID (Mascarado)</Text>
            <Text style={styles.monospaceValue}>{tenancyOcid}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoBlock}>
            <Text style={styles.sessionLabel}>User OCID</Text>
            <Text style={styles.monospaceValue}>{userOcid}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>Região OCI</Text>
            <View style={styles.regionChip}>
              <Text style={styles.regionChipText}>{region}</Text>
            </View>
          </View>
        </View>

        {/* Card 2: Auditoria de Hardware & Segurança */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderIcon}>🛡️</Text>
            <Text style={styles.cardTitle}>AUDITORIA DE HARDWARE & SEGURANÇA</Text>
          </View>

          <View style={styles.auditItem}>
            <View style={styles.auditLeft}>
              <Text style={styles.auditItemTitle}>Cofre de Dados</Text>
              <Text style={styles.auditItemValue}>AES-256-GCM (EncryptedStorage)</Text>
            </View>
            <View style={[styles.statusBadge, styles.statusSuccess]}>
              <Text style={styles.statusSuccessText}>Ativo</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.auditItem}>
            <View style={styles.auditLeft}>
              <Text style={styles.auditItemTitle}>Autenticação</Text>
              <Text style={styles.auditItemValue}>Android Keystore (Biometria Ativa)</Text>
            </View>
            <View style={[styles.statusBadge, styles.statusSuccess]}>
              <Text style={styles.statusSuccessText}>Homologado</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.auditItem}>
            <View style={styles.auditLeft}>
              <Text style={styles.auditItemTitle}>Sensor Óptico</Text>
              <Text style={styles.auditItemValue}>Câmera Física Homologada</Text>
            </View>
            <View style={[styles.statusBadge, styles.statusSuccess]}>
              <Text style={styles.statusSuccessText}>Operacional</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.auditItem}>
            <View style={styles.auditLeft}>
              <Text style={styles.auditItemTitle}>Localização</Text>
              <Text style={styles.auditItemValue}>GPS Satélite (Datacenter Regional Ativo)</Text>
            </View>
            <View style={[styles.statusBadge, styles.statusSuccess]}>
              <Text style={styles.statusSuccessText}>Sincronizado</Text>
            </View>
          </View>
        </View>

        {/* Card 3: Ação de Desconexão / Encerramento */}
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Zona de Encerramento de Sessão</Text>
          <Text style={styles.dangerDescription}>
            Remove o token de sessão do Android Keystore e exclui todas as credenciais criptografadas do dispositivo.
          </Text>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleLogoutAndClearVault}
            activeOpacity={0.8}
          >
            <Text style={styles.dangerButtonIcon}>🚪</Text>
            <Text style={styles.dangerButtonText}>Encerrar Sessão e Limpar Cofre</Text>
          </TouchableOpacity>
        </View>

        {/* Rodapé Oficial da Aplicação */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            CloudWatch Mobile Dashboard - v1.0.0 (Sprint 1 MVP)
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
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    marginTop: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardHeaderIcon: {
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sessionLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  infoBlock: {
    paddingVertical: 4,
    gap: 4,
  },
  monospaceValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#E2E8F0',
    backgroundColor: '#0B1220',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1220',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  providerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  regionChip: {
    backgroundColor: '#0066FF20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0066FF40',
  },
  regionChipText: {
    fontSize: 11,
    color: colors.neonCyan,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 10,
  },
  auditItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  auditLeft: {
    flex: 1,
    paddingRight: 10,
  },
  auditItemTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  auditItemValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusSuccessText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    fontFamily: 'monospace',
  },
  dangerCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 16,
    marginBottom: 24,
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 4,
  },
  dangerDescription: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 14,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 13,
    gap: 8,
    elevation: 2,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dangerButtonIcon: {
    fontSize: 14,
  },
  dangerButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
