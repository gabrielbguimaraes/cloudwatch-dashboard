/**
 * InstanceActionSheet - Bottom Sheet Corporativo de Detalhes e Ciclo de Vida
 * Progressive Disclosure Nivel 2: Detalhes tecnicos (OCID, IPs, Shape, OCPUs/RAM)
 * e acoes operacionais completas de ciclo de vida.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import type { CloudResource } from '../types';
import { NEUTRAL_THEME, CLOUD_PALETTES } from '../theme/tokens';
import { EditIcon, TrashIcon } from './common/AppIcons';
import { VectorAssetRenderer } from './common/VectorAssetRenderer';
import { telemetryRepository, NetworkPortProbe } from '../services/telemetryRepository';

interface InstanceActionSheetProps {
  visible: boolean;
  instance: CloudResource | null;
  onClose: () => void;
  onRestart: (id: string) => void;
  onEdit: (id: string, newName: string, shape?: string) => void;
  onDelete: (id: string) => void;
  onShowToast: (msg: string) => void;
  onOpenTerminal?: (instance: CloudResource) => void;
  onStressTest?: (id: string) => void;
  onViewMetrics?: (instance: CloudResource) => void;
}

export const InstanceActionSheet: React.FC<InstanceActionSheetProps> = ({
  visible,
  instance,
  onClose,
  onRestart,
  onEdit,
  onDelete,
  onShowToast,
  onOpenTerminal,
  onStressTest,
  onViewMetrics,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editShape, setEditShape] = useState('');
  const [editOcpus, setEditOcpus] = useState('4');
  const [editRam, setEditRam] = useState('24');
  const [probedPorts, setProbedPorts] = useState<NetworkPortProbe[] | null>(null);
  const [isProbing, setIsProbing] = useState(false);

  const handleProbe = async () => {
    if (!instance) return;
    setIsProbing(true);
    try {
      const ip = (instance.metadata as any)?.publicIp || '167.234.241.171';
      const res = await telemetryRepository.probeNetwork(ip, instance.id);
      setProbedPorts(res.ports);
      onShowToast(`Sondagem Zabbix concluída no IP ${ip}`);
    } catch {
      onShowToast('Falha na sondagem de rede');
    } finally {
      setIsProbing(false);
    }
  };

  if (!instance) return null;

  const metadata = (instance.metadata || {}) as any;
  const ocid = instance.ocid || instance.arn || instance.id;
  const privateIp = metadata.privateIp || '10.0.0.128';
  const publicIp = metadata.publicIp || '167.234.241.171';
  const shape = metadata.shape || instance.tags?.Shape || (instance.provider === 'OCI' ? 'VM.Standard.A1.Flex' : 't3.xlarge');
  const ocpus = metadata.ocpuCount || 4;
  const ramGb = metadata.memoryInGBs || 24;

  const handleOpenEdit = () => {
    setEditName(instance.name);
    setEditShape(shape);
    setEditOcpus(String(ocpus));
    setEditRam(String(ramGb));
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      onShowToast('Nome da instancia nao pode ser vazio');
      return;
    }
    onEdit(instance.id, editName.trim(), editShape.trim());
    setIsEditModalOpen(false);
    onClose();
    onShowToast(`Especificacoes da instancia ${editName} atualizadas`);
  };

  const handleRestart = () => {
    onClose();
    onRestart(instance.id);
    onShowToast(`Reiniciando instancia ${instance.name}...`);
  };

  const handleStressTest = () => {
    onClose();
    if (onStressTest) {
      onStressTest(instance.id);
    }
    onShowToast(`Pico de carga (98% CPU) simulado em ${instance.name}`);
  };

  const handleTerminal = () => {
    onClose();
    if (onOpenTerminal) {
      onOpenTerminal(instance);
    }
  };

  const handleViewMetrics = () => {
    onClose();
    if (onViewMetrics) {
      onViewMetrics(instance);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Encerrar Servidor',
      `Confirma a remocao definitiva da instancia ${instance.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: () => {
            onClose();
            onDelete(instance.id);
            onShowToast(`Instancia ${instance.name} encerrada e removida`);
          },
        },
      ]
    );
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'RUNNING':
      case 'HEALTHY':
        return NEUTRAL_THEME.statusRunning;
      case 'REBOOTING':
      case 'WARNING':
      case 'DEGRADED':
        return NEUTRAL_THEME.statusDegraded;
      case 'STOPPED':
      case 'CRITICAL':
      default:
        return NEUTRAL_THEME.statusStopped;
    }
  };

  const statusStyle = getStatusStyle(instance.status);
  const palette = CLOUD_PALETTES[instance.provider] || CLOUD_PALETTES.OCI;

  return (
    <>
      <Modal
        visible={visible && !isEditModalOpen}
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

            {/* Cabecalho da Bottom Sheet */}
            <View style={styles.sheetHeader}>
              <View style={styles.headerLeft}>
                <Text style={styles.instanceName} numberOfLines={1}>
                  {instance.name}
                </Text>
                <Text style={styles.instanceSub}>
                  {instance.provider} • {instance.region}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                  {instance.status}
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
              {/* Card de Especificacoes Tecnicas (Progressive Disclosure Nivel 2) */}
              <View style={styles.specsCard}>
                <Text style={styles.specsCardTitle}>ESPECIFICAÇÕES TÉCNICAS DO HOST</Text>

                <View style={styles.specRow}>
                  <Text style={styles.specKey}>OCID / ID:</Text>
                  <Text style={styles.specValMono} numberOfLines={1} ellipsizeMode="middle">
                    {ocid}
                  </Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specKey}>IP Público:</Text>
                  <Text style={styles.specValMono}>{publicIp}</Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specKey}>IP Privado:</Text>
                  <Text style={styles.specValMono}>{privateIp}</Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specKey}>Shape / VM:</Text>
                  <Text style={styles.specVal}>{shape}</Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specKey}>Capacidade:</Text>
                  <Text style={styles.specValHighlight}>
                    {ocpus} OCPUs (ARM) • {ramGb} GB RAM
                  </Text>
                </View>
              </View>

              {/* Painel Zabbix TCP Probe Rapido */}
              <View style={styles.sheetProbeContainer}>
                <View style={styles.sheetProbeHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetProbeTitle}>SONDAGEM DE REDE ZABBIX TCP</Text>
                    <Text style={styles.sheetProbeSubtitle}>Host: {publicIp}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.sheetProbeBtn, isProbing && { opacity: 0.6 }]}
                    onPress={handleProbe}
                    disabled={isProbing}
                  >
                    <Text style={styles.sheetProbeBtnText}>
                      {isProbing ? 'Sondando...' : 'Sondar Agora'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.sheetPortRow}>
                  {(probedPorts || [
                    { port: 22, status: 'OPEN', latencyMs: 3.8 },
                    { port: 80, status: 'CLOSED', latencyMs: 15 },
                    { port: 443, status: 'CLOSED', latencyMs: 14 },
                    { port: 3000, status: 'OPEN', latencyMs: 1.4 },
                    { port: 5432, status: 'OPEN', latencyMs: 2.2 },
                  ]).map((p) => {
                    const isOpen = p.status === 'OPEN';
                    return (
                      <View key={p.port} style={[styles.sheetPortPill, isOpen ? styles.sheetPortOpen : styles.sheetPortClosed]}>
                        <Text style={[styles.sheetPortText, { color: isOpen ? '#4ADE80' : '#9CA3AF' }]}>
                          :{p.port} {isOpen ? `${p.latencyMs}ms` : 'OFF'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Lista de Acoes de Ciclo de Vida */}
              <Text style={styles.actionsSectionTitle}>AÇÕES DE CICLO DE VIDA</Text>
              <View style={styles.actionsList}>
                {/* 1. Reiniciar Servidor */}
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={handleRestart}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, { backgroundColor: '#1E3A5F' }]}>
                    <Text style={[styles.actionLetter, { color: '#8AB4F8' }]}>R</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Reiniciar Servidor</Text>
                    <Text style={styles.actionSubtitle}>
                      Executa reboot gracioso e reestabelece CPU normalizada
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Ajustar Capacidade (OCPUs/RAM) */}
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={handleOpenEdit}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, { backgroundColor: '#3A321A' }]}>
                    <EditIcon size={16} color="#FDD663" />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Ajustar Capacidade (OCPUs/RAM)</Text>
                    <Text style={styles.actionSubtitle}>
                      Redimensionar shape flexivel e memória alocada
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 3. Abrir Console Terminal Linux */}
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={handleTerminal}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, { backgroundColor: '#1E293B' }]}>
                    <Text style={[styles.actionLetter, { color: '#38BDF8' }]}>{'>_'}</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Abrir Console Terminal Linux</Text>
                    <Text style={styles.actionSubtitle}>
                      Sessao interativa com shell opc@vnic-sidebrain
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 4. Simular Pico de Carga (Teste de Estresse) */}
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={handleStressTest}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, { backgroundColor: '#3F1F1F' }]}>
                    <Text style={[styles.actionLetter, { color: '#F87171' }]}>ST</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Simular Pico de Carga (Teste de Estresse)</Text>
                    <Text style={styles.actionSubtitle}>
                      Eleva CPU a 98% para testar resiliencia e limites de SLA
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 5. Ver Metricas e Graficos */}
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={handleViewMetrics}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, { backgroundColor: '#133529' }]}>
                    <Text style={[styles.actionLetter, { color: '#34D399' }]}>MG</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Análise de Métricas & Logs Insights</Text>
                    <Text style={styles.actionSubtitle}>
                      Gráficos de tendência, correlação CPU×RAM e logs centralizados
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 6. Remover Instancia */}
                <TouchableOpacity
                  style={[styles.actionItem, styles.actionItemDanger]}
                  onPress={handleDelete}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconPlaceholder, styles.dangerIconBox]}>
                    <TrashIcon size={16} color="#F28B82" />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={[styles.actionTitle, styles.dangerText]}>
                      Remover Instância
                    </Text>
                    <Text style={styles.actionSubtitle}>
                      Terminacao definitiva e desprovisionamento seguro
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Fechar Painel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de Ajuste de Capacidade */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalCenterOverlay}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Ajustar Capacidade da Instância</Text>
            <Text style={styles.editSubtitle}>Redimensionamento dinâmico de recursos computacionais</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>NOME DO NÓ</Text>
              <TextInput
                style={styles.formInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Ex: vnic-sidebrain-prd"
                placeholderTextColor="#5F6368"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>SHAPE DA VM</Text>
              <TextInput
                style={styles.formInput}
                value={editShape}
                onChangeText={setEditShape}
                placeholder="Ex: VM.Standard.A1.Flex"
                placeholderTextColor="#5F6368"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.formLabel}>OCPUS</Text>
                <TextInput
                  style={styles.formInput}
                  value={editOcpus}
                  onChangeText={setEditOcpus}
                  placeholder="4"
                  placeholderTextColor="#5F6368"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>RAM (GB)</Text>
                <TextInput
                  style={styles.formInput}
                  value={editRam}
                  onChangeText={setEditRam}
                  placeholder="24"
                  placeholderTextColor="#5F6368"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.editCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.editSaveBtn} onPress={handleSaveEdit}>
                <Text style={styles.editSaveText}>Aplicar Capacidade</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    marginBottom: 14,
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
    backgroundColor: '#0F291E',
    borderWidth: 1,
    borderColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sheetProbeBtnText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '700',
  },
  sheetPortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  sheetPortPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  sheetPortOpen: {
    backgroundColor: '#0F382A',
    borderColor: '#22C55E40',
  },
  sheetPortClosed: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  sheetPortText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsSectionTitle: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  actionsList: {
    gap: 10,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E232B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 12,
    gap: 12,
  },
  actionItemDanger: {
    borderColor: '#4D1F1F',
    backgroundColor: '#2D151520',
  },
  actionIconPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIconBox: {
    backgroundColor: '#4D1F1F',
  },
  actionLetter: {
    fontSize: 12,
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
  dangerText: {
    color: '#F28B82',
  },
  cancelBtn: {
    backgroundColor: '#20242C',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3139',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelBtnText: {
    color: '#9AA0A6',
    fontSize: 13,
    fontWeight: '700',
  },
  modalCenterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  editCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  editTitle: {
    color: '#E8EAED',
    fontSize: 16,
    fontWeight: '700',
  },
  editSubtitle: {
    color: '#9AA0A6',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
  },
  formLabel: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: '#0F1318',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3139',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E8EAED',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  editCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3139',
  },
  editCancelText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '600',
  },
  editSaveBtn: {
    backgroundColor: '#8AB4F8',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  editSaveText: {
    color: '#0F1318',
    fontSize: 12,
    fontWeight: '700',
  },
});
