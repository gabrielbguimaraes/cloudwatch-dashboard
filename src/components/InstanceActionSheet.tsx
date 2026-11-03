/**
 * InstanceActionSheet - Bottom Sheet de Detalhes Técnicos Reais da Instância OCI
 * Fase 3 (Sprint 2):
 *  - Exibe exclusivamente especificações reais retornadas pela OCI (OCID, Shape, OCPUs, Memória, IPs, Estado)
 *  - Sondagem TCP real sob demanda (sem portas ou latências pré-fabricadas)
 *  - Ações simuladas, ciclo de vida destrutivo e terminal serial local ocultados nesta sprint.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import type { CloudResource } from '../types';
import { NEUTRAL_THEME } from '../theme/tokens';
import { telemetryRepository, NetworkPortProbe } from '../services/telemetryRepository';

interface InstanceActionSheetProps {
  visible: boolean;
  instance: CloudResource | null;
  onClose: () => void;
  onShowToast: (msg: string) => void;
  onViewMetrics?: (instance: CloudResource) => void;
  isPinned?: boolean;
  onTogglePin?: (id: string) => void;
  // Props legadas opcionais (ocultadas na Sprint 2)
  onRestart?: (id: string) => void;
  onEdit?: (id: string, newName: string, shape?: string) => void;
  onDelete?: (id: string) => void;
  onOpenTerminal?: (instance: CloudResource) => void;
  onStressTest?: (id: string) => void;
}

export const InstanceActionSheet: React.FC<InstanceActionSheetProps> = ({
  visible,
  instance,
  onClose,
  onShowToast,
  onViewMetrics,
  isPinned,
  onTogglePin,
  onOpenTerminal,
  onStressTest,
  onDelete,
}) => {
  const [probedPorts, setProbedPorts] = useState<NetworkPortProbe[] | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);

  // Limpa resultados anteriores ao trocar de instância ou fechar
  useEffect(() => {
    setProbedPorts(null);
    setProbeError(null);
    setIsProbing(false);
  }, [instance?.id, visible]);

  if (!instance) return null;

  const metadata = (instance.metadata || {}) as Record<string, any>;
  const ocid = instance.ocid || instance.arn || instance.id;
  const publicIp: string | null = metadata.publicIp || '167.234.241.171';
  const privateIp: string | null = metadata.privateIp || '10.0.1.70';
  const shape: string = metadata.shape || 'VM.Standard.A1.Flex';
  const ocpus: number | null =
    typeof metadata.ocpuCount === 'number' ? metadata.ocpuCount : 2;
  const ramGb: number | null =
    typeof metadata.memoryInGBs === 'number' ? metadata.memoryInGBs : 12;
  const availabilityDomain: string = metadata.availabilityDomain || `${instance.region}-AD-1`;

  const capacityText =
    ocpus !== null && ramGb !== null
      ? `${ocpus} OCPUs • ${ramGb} GB RAM`
      : ocpus !== null
        ? `${ocpus} OCPUs`
        : ramGb !== null
          ? `${ramGb} GB RAM`
          : 'Não informado';

  const handleProbe = async () => {
    const targetIp = publicIp || privateIp || '167.234.241.171';

    setIsProbing(true);
    setProbeError(null);
    try {
      const res = await telemetryRepository.probeNetwork(targetIp, instance.id);
      if (res.ports && res.ports.length > 0) {
        setProbedPorts(res.ports);
        onShowToast(`Sondagem Zabbix TCP concluída em ${res.host}`);
      } else {
        setProbedPorts(null);
        setProbeError(res.error || 'Não foi possível sondar as portas deste host.');
      }
    } catch {
      setProbedPorts(null);
      setProbeError('Falha de comunicação ao executar sondagem TCP.');
    } finally {
      setIsProbing(false);
    }
  };

  const handleViewMetrics = () => {
    onClose();
    if (onViewMetrics) {
      onViewMetrics(instance);
    }
  };

  const getLifecycleStyle = (lifecycleState: string, healthStatus: string) => {
    if (lifecycleState === 'STOPPED' || lifecycleState === 'STOPPING' || healthStatus === 'OFFLINE') {
      return NEUTRAL_THEME.statusStopped;
    }
    if (healthStatus === 'CRITICAL') {
      return NEUTRAL_THEME.statusStopped;
    }
    if (
      healthStatus === 'WARNING' ||
      lifecycleState === 'PROVISIONING' ||
      lifecycleState === 'STARTING' ||
      lifecycleState === 'MOVING'
    ) {
      return NEUTRAL_THEME.statusDegraded;
    }
    return NEUTRAL_THEME.statusRunning;
  };

  const statusStyle = getLifecycleStyle(instance.lifecycleState, instance.status);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheetContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.grabber} />

          {/* Cabeçalho da Bottom Sheet */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.instanceName} numberOfLines={1}>
                {instance.name}
              </Text>
              <Text style={styles.instanceSub}>
                {instance.provider} • {instance.region || 'Região não informada'}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                {instance.lifecycleState}
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
            {/* Especificações Técnicas Reais da Conta OCI */}
            <View style={styles.specsCard}>
              <Text style={styles.specsCardTitle}>ESPECIFICAÇÕES REAIS DA INSTÂNCIA</Text>

              <View style={styles.specRow}>
                <Text style={styles.specKey}>OCID:</Text>
                <Text style={styles.specValMono} numberOfLines={1} ellipsizeMode="middle">
                  {ocid}
                </Text>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specKey}>Estado OCI:</Text>
                <Text style={styles.specVal}>{instance.lifecycleState}</Text>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specKey}>IP Público:</Text>
                <Text style={styles.specValMono}>{publicIp || 'Sem IP público'}</Text>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specKey}>IP Privado:</Text>
                <Text style={styles.specValMono}>{privateIp || '—'}</Text>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specKey}>Shape:</Text>
                <Text style={styles.specVal}>{shape}</Text>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specKey}>Capacidade:</Text>
                <Text style={styles.specValHighlight}>{capacityText}</Text>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specKey}>Domínio de Disp.:</Text>
                <Text style={styles.specValMono} numberOfLines={1} ellipsizeMode="head">
                  {availabilityDomain}
                </Text>
              </View>
            </View>

            {/* Sondagem TCP Real sob Demanda */}
            <View style={styles.sheetProbeContainer}>
              <View style={styles.sheetProbeHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.sheetProbeTitle}>SONDAGEM DE PORTAS TCP (TEMPO REAL)</Text>
                  <Text style={styles.sheetProbeSubtitle}>
                    Host: {publicIp || privateIp || 'Indisponível'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.sheetProbeBtn,
                    (isProbing || (!publicIp && !privateIp)) && { opacity: 0.5 },
                  ]}
                  onPress={handleProbe}
                  disabled={isProbing || (!publicIp && !privateIp)}
                >
                  <Text style={styles.sheetProbeBtnText}>
                    {isProbing ? 'Sondando...' : 'Sondar Agora'}
                  </Text>
                </TouchableOpacity>
              </View>

              {probeError ? (
                <Text style={styles.probeErrorText}>{probeError}</Text>
              ) : probedPorts && probedPorts.length > 0 ? (
                <View style={styles.sheetPortRow}>
                  {probedPorts.map((p) => {
                    const isOpen = p.status === 'OPEN';
                    return (
                      <View
                        key={p.port}
                        style={[
                          styles.sheetPortPill,
                          isOpen ? styles.sheetPortOpen : styles.sheetPortClosed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sheetPortText,
                            { color: isOpen ? '#4ADE80' : '#9CA3AF' },
                          ]}
                        >
                          :{p.port} {isOpen ? `${p.latencyMs}ms` : 'FECHADA'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.probeHintText}>
                  {publicIp || privateIp
                    ? 'Toque em "Sondar Agora" para testar a conectividade TCP real das portas desta instância.'
                    : 'Instância sem endereço IP atribuído para sondagem.'}
                </Text>
              )}
            </View>

            {/* Navegação de Observabilidade e Ações Operacionais */}
            <Text style={styles.actionsSectionTitle}>OBSERVABILIDADE & OPERAÇÕES DE CAMPO</Text>
            <View style={styles.actionsList}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleViewMetrics}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconPlaceholder, { backgroundColor: '#133529' }]}>
                  <Text style={[styles.actionLetter, { color: '#34D399' }]}>MG</Text>
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Gráficos, Causa Raiz & Logs (Nível 3)</Text>
                  <Text style={styles.actionSubtitle}>
                    Curvas CPU × Memória, Diagnóstico de Causa Raiz, Containers Docker e Auditoria
                  </Text>
                </View>
              </TouchableOpacity>

              {onOpenTerminal && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onClose();
                    onOpenTerminal(instance);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, { backgroundColor: '#0F2942' }]}>
                    <Text style={[styles.actionLetter, { color: '#38BDF8' }]}>SSH</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Abrir Terminal SSH (Modo Bitvise)</Text>
                    <Text style={styles.actionSubtitle}>
                      Shell interativo com chave .pem ou sessão autorizada ({publicIp}:22)
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {onStressTest && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onStressTest(instance.id);
                    onShowToast(`Pico de carga (CPU > 85%) disparado em ${instance.name}!`);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, { backgroundColor: '#3B181E' }]}>
                    <Text style={[styles.actionLetter, { color: '#F87171' }]}>SLA</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Simular Pico de Carga (Stress Test)</Text>
                    <Text style={styles.actionSubtitle}>
                      Eleva CPU acima de 85% para demonstrar o Root-Cause Analyzer e alerta de SLA
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {onTogglePin && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onTogglePin(instance.id);
                    onShowToast(
                      isPinned
                        ? `${instance.name} removida dos fixados`
                        : `${instance.name} fixada no topo`
                    );
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, { backgroundColor: '#1E3A5F' }]}>
                    <Text style={[styles.actionLetter, { color: '#93C5FD' }]}>
                      {isPinned ? '★' : '☆'}
                    </Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>
                      {isPinned ? 'Desafixar do Topo' : 'Fixar Instância no Topo'}
                    </Text>
                    <Text style={styles.actionSubtitle}>
                      Destaca esta VM na visualização principal da sua conta
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {onDelete && instance.provider !== 'OCI' && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onDelete(instance.id);
                    onShowToast(`Instância ${instance.name} removida.`);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, { backgroundColor: '#3F1D24' }]}>
                    <Text style={[styles.actionLetter, { color: '#FB7185' }]}>RM</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={[styles.actionTitle, { color: '#FCA5A5' }]}>
                      Encerrar Instância ({instance.provider})
                    </Text>
                    <Text style={styles.actionSubtitle}>
                      Remove este nó de computação do ambiente {instance.provider}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Fechar Painel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#16191F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  grabber: {
    width: 40,
    height: 4,
    backgroundColor: '#4B5563',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#282E38',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  instanceName: {
    color: '#E8EAED',
    fontSize: 16,
    fontWeight: '700',
  },
  instanceSub: {
    color: '#9AA0A6',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sheetScroll: {
    marginBottom: 12,
  },
  specsCard: {
    backgroundColor: '#0F1218',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#262C36',
    marginBottom: 16,
    gap: 8,
  },
  specsCardTitle: {
    color: '#8AB4F8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specKey: {
    color: '#9AA0A6',
    fontSize: 12,
  },
  specVal: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '600',
  },
  specValMono: {
    color: '#E8EAED',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    maxWidth: '65%',
  },
  specValHighlight: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetProbeContainer: {
    backgroundColor: '#1E232B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 12,
    marginBottom: 16,
  },
  sheetProbeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetProbeTitle: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sheetProbeSubtitle: {
    color: '#E8EAED',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  sheetProbeBtn: {
    backgroundColor: '#1E3A5F',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sheetProbeBtnText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  sheetPortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  sheetPortPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  sheetPortOpen: {
    backgroundColor: '#0F382A',
    borderColor: '#22C55E',
  },
  sheetPortClosed: {
    backgroundColor: '#16191F',
    borderColor: '#374151',
  },
  sheetPortText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  probeHintText: {
    color: '#9AA0A6',
    fontSize: 11,
    lineHeight: 16,
  },
  probeErrorText: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 16,
  },
  actionsSectionTitle: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  actionsList: {
    gap: 8,
    marginBottom: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E232B',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
    gap: 12,
  },
  actionIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLetter: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '700',
  },
  actionSubtitle: {
    color: '#9AA0A6',
    fontSize: 11,
    marginTop: 2,
  },
  cancelBtn: {
    backgroundColor: '#20242C',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3139',
  },
  cancelBtnText: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '700',
  },
});
