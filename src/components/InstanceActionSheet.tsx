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
  Image,
} from 'react-native';
import type { CloudResource } from '../types';
import { NEUTRAL_THEME } from '../theme/tokens';
import { VectorAssetRenderer } from './common/VectorAssetRenderer';

interface InstanceActionSheetProps {
  visible: boolean;
  instance: CloudResource | null;
  onClose: () => void;
  onRestart: (id: string) => void;
  onEdit: (id: string, newName: string, shape?: string) => void;
  onDelete: (id: string) => void;
  onShowToast: (msg: string) => void;
}

export const InstanceActionSheet: React.FC<InstanceActionSheetProps> = ({
  visible,
  instance,
  onClose,
  onRestart,
  onEdit,
  onDelete,
  onShowToast,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editShape, setEditShape] = useState('');

  if (!instance) return null;

  const handleOpenEdit = () => {
    setEditName(instance.name);
    setEditShape(
      (instance.metadata as any)?.shape ||
        instance.tags?.Shape ||
        'VM.Standard.A1.Flex'
    );
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
    onShowToast(`Instancia ${editName} atualizada com sucesso`);
  };

  const handleRestart = () => {
    onClose();
    onRestart(instance.id);
    onShowToast(`Reiniciando instancia ${instance.name}...`);
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
          <View style={styles.sheetContainer}>
            {/* Grabber visual corporativo */}
            <View style={styles.grabber} />

            {/* Cabecalho da Maquina */}
            <View style={styles.sheetHeader}>
              <View style={styles.headerLeft}>
                <Text style={styles.instanceName} numberOfLines={1}>
                  {instance.name}
                </Text>
                <Text style={styles.instanceIp}>
                  IP: {(instance.metadata as any)?.privateIp || '10.0.0.4'}
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

            {/* Opcoes de Acao Operacional (Zero Emojis) */}
            <View style={styles.actionsList}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleRestart}
                activeOpacity={0.7}
              >
                <View style={styles.actionIconPlaceholder}>
                  <VectorAssetRenderer
                    label="R"
                    size={18}
                    source={require('../assets/images/power-512.png')}
                    tintColor="#8AB4F8"
                  />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Reiniciar Instancia</Text>
                  <Text style={styles.actionSubtitle}>
                    Executa reboot e reestabelece CPU normalizada (~12%)
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleOpenEdit}
                activeOpacity={0.7}
              >
                <View style={styles.actionIconPlaceholder}>
                  <Text style={styles.actionLetter}>E</Text>
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionTitle}>Editar Especificacoes</Text>
                  <Text style={styles.actionSubtitle}>
                    Renomear host ou atualizar shape/memoria
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDanger]}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconPlaceholder, styles.dangerIconBox]}>
                  <Text style={[styles.actionLetter, styles.dangerText]}>X</Text>
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, styles.dangerText]}>
                    Terminar / Excluir Servidor
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    Desprovisiona e remove permanentemente do storage
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Botao Fechar */}
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Fechar Painel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Compacto de Edicao de Especificacoes */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalCenterOverlay}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Editar Especificacoes da Instancia</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>NOME DO NÓ</Text>
              <TextInput
                style={styles.formInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Ex: oracle-db-primary"
                placeholderTextColor="#5F6368"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>SHAPE / ARQUITETURA</Text>
              <TextInput
                style={styles.formInput}
                value={editShape}
                onChangeText={setEditShape}
                placeholder="Ex: VM.Standard.A1.Flex"
                placeholderTextColor="#5F6368"
              />
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.editCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.editSaveBtn} onPress={handleSaveEdit}>
                <Text style={styles.editSaveText}>Salvar Alteracoes</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1A1D24',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 20,
    paddingBottom: 32,
  },
  grabber: {
    width: 36,
    height: 4,
    backgroundColor: '#5F6368',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#282E38',
    marginBottom: 16,
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
  instanceIp: {
    color: '#9AA0A6',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsList: {
    gap: 10,
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20242C',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 12,
    gap: 12,
  },
  actionItemDanger: {
    borderColor: '#4D1F1F',
    backgroundColor: '#2D151520',
  },
  actionIconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#282E38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIconBox: {
    backgroundColor: '#4D1F1F',
  },
  actionLetter: {
    color: '#E8EAED',
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
    fontSize: 10,
    marginTop: 2,
  },
  dangerText: {
    color: '#F28B82',
  },
  cancelBtn: {
    backgroundColor: '#282E38',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
  },
  modalCenterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 20,
  },
  editTitle: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#0F1318',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3139',
    color: '#E8EAED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#282E38',
    borderRadius: 8,
    alignItems: 'center',
  },
  editCancelText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '700',
  },
  editSaveBtn: {
    flex: 1.4,
    paddingVertical: 10,
    backgroundColor: '#132B1D',
    borderWidth: 1,
    borderColor: '#1E462E',
    borderRadius: 8,
    alignItems: 'center',
  },
  editSaveText: {
    color: '#81C995',
    fontSize: 12,
    fontWeight: '800',
  },
});
