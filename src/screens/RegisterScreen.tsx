/**
 * CloudWatch Mobile - Tela de Cadastro de Conta do App
 * Fase 3 (Item 7):
 *  - Cria exclusivamente a conta individual do usuario no aplicativo (usuario, e-mail e senha)
 *  - Nenhum campo pre-preenchido, nenhum botao "Configurar OCI/AWS/GCP" ou preenchimento demo
 *  - Nao exige conectar nenhuma nuvem para cadastrar; apos o cadastro abre a etapa "Conecte sua nuvem" (com "Pular por enquanto").
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AppImage } from '../components/common/AppImage';

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { registerMasterAccount } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinalize = async () => {
    setErrorMessage(null);

    if (!username.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Informe nome de usuário, e-mail e senha para criar sua conta.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('A confirmação de senha não coincide com a senha informada.');
      return;
    }

    setIsSubmitting(true);
    const res = await registerMasterAccount(username, email, password);
    setIsSubmitting(false);

    if (!res.success) {
      const msg = res.error || 'Não foi possível concluir o cadastro no servidor.';
      setErrorMessage(msg);
      Alert.alert('Erro no Cadastro', msg);
    }
    // Em caso de sucesso, AuthContext define isAuthenticated = true e justRegistered = true,
    // abrindo automaticamente a etapa "Conecte sua nuvem" (ConnectCloudsIntroScreen).
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <AppImage
              source={require('../assets/logo.png')}
              fallbackLabel="CW"
              size={52}
              isCircular={false}
            />
          </View>
          <Text style={styles.title}>Criar Conta no CloudWatch</Text>
          <Text style={styles.subtitle}>
            Cada usuário possui sua própria conta isolada e conecta apenas as nuvens que desejar.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>NOME DE USUÁRIO</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="ex: maria.silva"
              placeholderTextColor="#5F6368"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-MAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ex: maria@empresa.com"
              placeholderTextColor="#5F6368"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>SENHA (MÍN. 6 CARACTERES)</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Crie uma senha forte"
              placeholderTextColor="#5F6368"
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CONFIRMAR SENHA</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repita a senha"
              placeholderTextColor="#5F6368"
              secureTextEntry
            />
          </View>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleFinalize}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Criar Conta e Continuar</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.7}
        >
          <Text style={styles.loginLinkText}>Já possui uma conta? Fazer login</Text>
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
    padding: 22,
  },
  header: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoBox: {
    width: 52,
    height: 52,
    marginBottom: 14,
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
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#181C22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#9AA0A6',
    fontSize: 10,
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
  errorBox: {
    backgroundColor: 'rgba(242, 139, 130, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242, 139, 130, 0.4)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#F28B82',
    fontSize: 12,
    lineHeight: 17,
  },
  submitBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loginLink: {
    marginTop: 22,
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginLinkText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '600',
  },
});
