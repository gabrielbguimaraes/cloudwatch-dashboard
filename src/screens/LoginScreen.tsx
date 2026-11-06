import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { useAuth } from '../context/AuthContext';
import { AppImage } from '../components/common/AppImage';
import { FingerprintIcon } from '../components/common/AppIcons';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { loginMaster, loginWithBiometrics, masterUser } = useAuth();

  const [username, setUsername] = useState(masterUser?.username || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);

  useEffect(() => {
    if (masterUser?.username) {
      setUsername((prev) => prev || masterUser.username);
      return;
    }
    let mounted = true;
    EncryptedStorage.getItem('@master_user_profile')
      .then((raw) => {
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.username) {
          setUsername((prev) => prev || parsed.username);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [masterUser?.username]);

  const handlePasswordLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Campos Obrigatórios', 'Informe seu usuário (ou e-mail) e senha para entrar.');
      return;
    }

    setIsLoading(true);
    const result = await loginMaster(username, password);
    setIsLoading(false);

    if (result.success) {
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
      Alert.alert('Falha na Autenticação', result.error || 'Credenciais inválidas.');
    }
  };

  const handleBiometricLogin = async () => {
    setIsBioLoading(true);
    const result = await loginWithBiometrics();
    setIsBioLoading(false);

    if (result.success) {
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
      Alert.alert(
        'Autenticação Biométrica',
        result.error || 'Biometria cancelada ou indisponível neste dispositivo. Utilize sua senha para entrar.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Cabecalho Corporativo */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <AppImage
              source={require('../assets/logo.png')}
              fallbackLabel="CW"
              size={56}
              isCircular={false}
            />
          </View>
          <Text style={styles.title}>CloudWatch Mobile</Text>
          <Text style={styles.subtitle}>Autentique-se para gerenciar sua infraestrutura</Text>
        </View>

        {/* Card Principal de Autenticacao */}
        <View style={styles.loginCard}>
          {/* Botao Primario: Acesso Biometrico Nativo */}
          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={handleBiometricLogin}
            disabled={isBioLoading}
            activeOpacity={0.8}
          >
            {isBioLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.biometricBtnContent}>
                <FingerprintIcon size={18} color="#FFFFFF" />
                <Text style={styles.biometricBtnText}>Entrar com Biometria</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OU ENTRE COM SENHA</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Formulario de Login com Senha */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>USUÁRIO OU E-MAIL</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="ex: seu.usuario ou nome@empresa.com"
              placeholderTextColor="#5F6368"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>SENHA</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Senha da sua conta"
              placeholderTextColor="#5F6368"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handlePasswordLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.loginBtnText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Rodape Limpo com Link Sutil */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.7}
        >
          <Text style={styles.registerLinkText}>Criar nova conta</Text>
        </TouchableOpacity>
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBox: {
    width: 56,
    height: 56,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#E8EAED',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#9AA0A6',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  loginCard: {
    backgroundColor: '#181C22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 20,
  },
  biometricBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  biometricIconBadge: {
    backgroundColor: '#1557B0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  biometricIconText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  biometricBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#282E38',
  },
  dividerText: {
    color: '#5F6368',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  formGroup: {
    marginBottom: 14,
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
  loginBtn: {
    backgroundColor: '#282E38',
    borderWidth: 1,
    borderColor: '#3C4043',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
  },
  registerLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
  registerLinkText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '600',
  },
});
