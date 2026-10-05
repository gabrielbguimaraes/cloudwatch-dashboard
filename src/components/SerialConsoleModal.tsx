import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import type { CloudResource } from '../types';

interface SerialConsoleModalProps {
  visible: boolean;
  onClose: () => void;
  instance: CloudResource | null;
  onRestartInstance?: (id: string) => void;
}

interface TerminalLine {
  id: string;
  type: 'prompt' | 'output' | 'system' | 'error';
  text: string;
}

export const SerialConsoleModal: React.FC<SerialConsoleModalProps> = ({
  visible,
  onClose,
  instance,
  onRestartInstance,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const instanceName = instance?.name || 'srv-prod';
  const provider = instance?.provider || 'OCI';
  const shape =
    (instance?.metadata as any)?.shape ||
    instance?.tags?.Shape ||
    (provider === 'OCI'
      ? 'VM.Standard.A1.Flex'
      : provider === 'AWS'
      ? 't3.medium'
      : 'e2-standard-4');

  // Prompt Dinamico conforme especificacao
  const promptUser =
    provider === 'AWS'
      ? `ec2-user@${instanceName}:~$`
      : provider === 'GCP'
      ? `sa_admin@${instanceName}:~$`
      : `opc@${instanceName}:~$`;

  // Inicializacao do buffer do console com banner de boot limpo
  useEffect(() => {
    if (visible && instance) {
      setLines([
        {
          id: 'b-1',
          type: 'system',
          text: `Linux version 6.5.0-oracle-aarch64 (root@builder) #1 SMP PREEMPT GNU/Linux`,
        },
        {
          id: 'b-2',
          type: 'system',
          text: `systemd[1]: Reached target Network (Pre). Telemetry socket listening.`,
        },
        {
          id: 'b-3',
          type: 'system',
          text: `cloudwatch-probe: Attached to ${instanceName} [${provider}]. Digite 'help' para ajuda.`,
        },
      ]);
      setCommandInput('');
    }
  }, [visible, instance?.id]);

  // Rolagem automatica para o fim a cada nova linha
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [lines, visible]);

  const executeCommand = (cmdText: string) => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;

    const promptEntry: TerminalLine = {
      id: `p-${Date.now()}`,
      type: 'prompt',
      text: `${promptUser} ${trimmed}`,
    };

    const lower = trimmed.toLowerCase();

    // 10. clear
    if (lower === 'clear') {
      setLines([]);
      setCommandInput('');
      return;
    }

    const newLines: TerminalLine[] = [promptEntry];

    // Identificadores da maquina ativa consumidos dinamicamente
    const privateIp =
      (instance?.metadata as any)?.privateIp ||
      instance?.tags?.PrivateIp ||
      '10.0.0.14';
    const publicIp =
      (instance?.metadata as any)?.publicIp ||
      instance?.tags?.PublicIp ||
      '140.238.180.22';

    const totalMb =
      (instance?.metadata as any)?.memoryGb
        ? (instance?.metadata as any).memoryGb * 1024
        : provider === 'OCI'
        ? 12288
        : provider === 'AWS'
        ? 4096
        : 16384;

    const memPercent = instance?.metricsSummary?.memoryPercent || 48;
    const cpuPercent = instance?.metricsSummary?.cpuPercent ?? 12;
    const usedMb = Math.round(totalMb * (memPercent / 100));
    const freeMb = Math.max(256, totalMb - usedMb);
    const availMb = Math.max(512, freeMb + 1200);

    // Interpretador de Comandos Emulados (Command Parser)
    if (lower === 'help') {
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'output',
        text: `Lista comandos: help, uname -a, uptime, df -h, free -m, top -n 1, ip a, clear, reboot, systemctl status`,
      });
    } else if (lower === 'uname -a') {
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'output',
        text: `Linux ${instanceName} 6.5.0-oracle-aarch64 #1 SMP PREEMPT GNU/Linux`,
      });
    } else if (lower === 'uptime') {
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'output',
        text: `18:42:10 up 14 days, 3:22, 1 user, load average: 0.18, 0.22, 0.15`,
      });
    } else if (lower === 'free -m' || lower === 'free') {
      const formattedTable = [
        '               total        used        free      shared  buff/cache   available',
        `Mem:           ${String(totalMb).padEnd(8)} ${String(usedMb).padEnd(8)} ${String(freeMb).padEnd(8)}       12        2140        ${String(availMb)}`,
        'Swap:           2048           0        2048',
      ].join('\n');
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'output',
        text: formattedTable,
      });
    } else if (lower === 'df -h' || lower === 'df') {
      const dfOutput = [
        'Filesystem      Size  Used Avail Use% Mounted on',
        '/dev/sda1        45G   12G   31G  28% /',
        'tmpfs           1.2G     0  1.2G   0% /run',
        '/dev/sda15      105M  6.1M   99M   6% /boot/efi',
      ].join('\n');
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'output',
        text: dfOutput,
      });
    } else if (lower === 'top -n 1' || lower === 'top') {
      const topOutput = [
        `top - 18:42:15 up 14 days,  3:22,  1 user,  load average: 0.18, 0.22, 0.15`,
        `Tasks: 112 total,   1 running, 111 sleeping,   0 stopped,   0 zombie`,
        `%Cpu(s):  ${cpuPercent.toFixed(1)} us,  1.2 sy,  0.0 ni, ${(Math.max(0, 100 - cpuPercent - 1.2)).toFixed(1)} id,  0.1 wa,  0.0 hi`,
        `MiB Mem :  ${totalMb}.0 total,   ${freeMb}.0 free,   ${usedMb}.0 used,   2140.0 buff/cache`,
        ``,
        `  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND`,
        ` 1042 root      20   0  312450  45210  12400 S  ${cpuPercent.toFixed(1)}   ${memPercent.toFixed(1)}   4:12.30 cloudwatch-mon`,
        `  782 opc       20   0  145890  22100   8400 S   0.8   1.8   1:05.12 oci-agent`,
        `    1 root      20   0  168420  11420   8120 S   0.0   0.9   0:14.88 systemd`,
      ].join('\n');
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'output',
        text: topOutput,
      });
    } else if (lower === 'ip a' || lower === 'ip addr') {
      const ipOutput = [
        '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000',
        '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00',
        '    inet 127.0.0.1/8 scope host lo',
        '       valid_lft forever preferred_lft forever',
        '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000 qdisc mq state UP group default qlen 1000',
        '    link/ether 02:00:17:01:2d:4a brd ff:ff:ff:ff:ff:ff',
        `    inet ${privateIp}/24 brd 10.0.0.255 scope global eth0`,
        '       valid_lft forever preferred_lft forever',
        `    inet ${publicIp}/32 scope global eth0:pub`,
        '       valid_lft forever preferred_lft forever',
      ].join('\n');
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'output',
        text: ipOutput,
      });
    } else if (
      lower.startsWith('systemctl status') ||
      lower === 'systemctl status cloudwatch-agent'
    ) {
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'output',
        text: `Active: active (running) since Tue 2024-09-24; Telemetry sync interval: 10s;\nStatus: HEALTHY`,
      });
    } else if (lower === 'reboot') {
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'output',
        text: `Broadcast message from root@${instanceName}: System will reboot now!`,
      });
      setLines((prev) => [...prev, ...newLines]);
      setCommandInput('');

      if (instance && onRestartInstance) {
        setTimeout(() => {
          onRestartInstance(instance.id);
        }, 600);
      }
      return;
    } else {
      newLines.push({
        id: `out-${Date.now()}-1`,
        type: 'error',
        text: `bash: ${trimmed}: command not found.\nDigite 'help' para comandos suportados.`,
      });
    }

    setLines((prev) => [...prev, ...newLines]);
    setCommandInput('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.terminalCard}>
          {/* Cabecalho do Terminal */}
          <View style={styles.terminalHeader}>
            <View style={styles.terminalTitleGroup}>
              <View style={styles.terminalDot} />
              <Text style={styles.terminalTitle} numberOfLines={1}>
                Console Serial ({instanceName} - {shape})
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtnText}>Fechar Terminal</Text>
            </TouchableOpacity>
          </View>

          {/* Buffer de Saida (ScrollView) */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.terminalOutputBuffer}
            contentContainerStyle={styles.terminalOutputContent}
            showsVerticalScrollIndicator={true}
          >
            {lines.map((line) => {
              if (line.type === 'prompt') {
                return (
                  <Text key={line.id} style={styles.promptLine}>
                    {line.text}
                  </Text>
                );
              }
              if (line.type === 'error') {
                return (
                  <Text key={line.id} style={styles.errorLine}>
                    {line.text}
                  </Text>
                );
              }
              if (line.type === 'system') {
                return (
                  <Text key={line.id} style={styles.systemLine}>
                    {line.text}
                  </Text>
                );
              }
              return (
                <Text key={line.id} style={styles.outputLine}>
                  {line.text}
                </Text>
              );
            })}
          </ScrollView>

          {/* Linha de Comando e Prompt Ativo */}
          <View style={styles.inputRow}>
            <Text style={styles.activePromptText}>{promptUser} </Text>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={commandInput}
              onChangeText={setCommandInput}
              onSubmitEditing={() => executeCommand(commandInput)}
              placeholder="digite um comando (ex: help)"
              placeholderTextColor="#5F6368"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardAppearance="dark"
              returnKeyType="send"
            />
            <TouchableOpacity
              style={styles.executeBtn}
              onPress={() => executeCommand(commandInput)}
              activeOpacity={0.7}
            >
              <Text style={styles.executeBtnText}>Executar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 12,
  },
  terminalCard: {
    flex: 1,
    maxHeight: '92%',
    backgroundColor: '#0A0D12',
    borderWidth: 1,
    borderColor: '#1E242C',
    borderRadius: 12,
    overflow: 'hidden',
  },
  terminalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141820',
    borderBottomWidth: 1,
    borderBottomColor: '#1E242C',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  terminalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  terminalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#81C995',
  },
  terminalTitle: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  closeBtn: {
    backgroundColor: '#20242C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  closeBtnText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  terminalOutputBuffer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  terminalOutputContent: {
    paddingBottom: 16,
  },
  promptLine: {
    color: '#8AB4F8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 6,
    marginBottom: 2,
    lineHeight: 16,
  },
  outputLine: {
    color: '#E8EAED',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  systemLine: {
    color: '#9AA0A6',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  errorLine: {
    color: '#F28B82',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10141C',
    borderTopWidth: 1,
    borderTopColor: '#1E242C',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  activePromptText: {
    color: '#81C995',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    flex: 1,
    color: '#81C995',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  executeBtn: {
    backgroundColor: '#20242C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3C4043',
  },
  executeBtnText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
