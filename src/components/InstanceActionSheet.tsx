/**
 * InstanceActionSheet - Menu Rápido de Ações da Instância
 * Focado em ações diretas (sem duplicar sondagem de portas ou tabelas extensas já presentes na tela de detalhes):
 *  - Ver Métricas, Portas & Containers
 *  - Abrir Terminal SSH (Modo Bitvise)
 *  - Fixar / Desafixar Instância no Topo
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import type { CloudResource } from '../types';
import { NEUTRAL_THEME } from '../theme/tokens';
import {
  MetricsIcon,
  TerminalIcon,
  PinIcon,
  TrashIcon,
} from './common/AppIcons';

interface InstanceActionSheetProps {
  visible: boolean;
  instance: CloudResource | null;
  onClose: () => void;
  onShowToast: (msg: string) => void;
  onViewMetrics?: (instance: CloudResource) => void;
  isPinned?: boolean;
  onTogglePin?: (id: string) => void;
  onRestart?: (id: string) => void;
  onEdit?: (id: string, newName: string, shape?: string) => void;
  onDelete?: (id: string) => void;
  onOpenTerminal?: (instance: CloudResource) => void;
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
  onDelete,
}) => {
  if (!instance) return null;

  const metadata = (instance.metadata || {}) as Record<string, any>;
  const publicIp: string | null = metadata.publicIp || null;
  const privateIp: string | null = metadata.privateIp || null;
  const shape: string = metadata.shape || 'VM.Standard.A1.Flex';
  const ipDisplay = publicIp || privateIp || 'Sem IP';

  const handleViewMetrics = () => {
    onClose();
    if (onViewMetrics) {
      onViewMetrics(instance);
    }
  };

  const getLifecycleStyle = (lifecycleState: string, healthStatus: string) => {
    if (
      lifecycleState === 'STOPPED' ||
      lifecycleState === 'STOPPING' ||
      healthStatus === 'OFFLINE'
    ) {
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

          {/* Cabeçalho enxuto da Instância */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.instanceName} numberOfLines={1}>
                {instance.name}
              </Text>
              <Text style={styles.instanceSub} numberOfLines={1}>
                {instance.provider} • {instance.region || 'sa-saopaulo-1'} • {shape}
              </Text>
              <Text style={styles.instanceIp} numberOfLines={1}>
                IP: {ipDisplay}
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

          {/* Ações Rápidas */}
          <View style={styles.actionsList}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleViewMetrics}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#122D24' }]}>
                <MetricsIcon size={18} color="#34D399" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Ver Métricas, Portas & Containers</Text>
                <Text style={styles.actionSubtitle}>
                  Séries de CPU e RAM, portas TCP, containers Docker e auditoria
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
                activeOpacity={0.75}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#0F2942' }]}>
                  <TerminalIcon size={18} color="#38BDF8" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Abrir Terminal SSH (Modo Bitvise)</Text>
                  <Text style={styles.actionSubtitle}>
                    Executar comandos de diagnóstico remoto ({ipDisplay}:22)
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
                      ? `${instance.name} removida do topo`
                      : `${instance.name} fixada no topo`
                  );
                  onClose();
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#1E2F4D' }]}>
                  <PinIcon size={17} color="#93C5FD" focused={Boolean(isPinned)} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>
                    {isPinned ? 'Desafixar Instância do Topo' : 'Fixar Instância no Topo'}
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    {isPinned
                      ? 'Remove o destaque desta instância na listagem principal'
                      : 'Mantém esta instância sempre no topo do painel'}
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
                activeOpacity={0.75}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#3A1A20' }]}>
                  <TrashIcon size={17} color="#FB7185" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: '#FCA5A5' }]}>
                    Remover Instância ({instance.provider})
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    Remove este nó da visualização {instance.provider}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>Fechar</Text>
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  grabber: {
    width: 38,
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
  instanceIp: {
    color: '#93C5FD',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsList: {
    gap: 8,
    marginBottom: 14,
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
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 15,
  },
  cancelBtn: {
    backgroundColor: '#20242C',
    paddingVertical: 12,
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
