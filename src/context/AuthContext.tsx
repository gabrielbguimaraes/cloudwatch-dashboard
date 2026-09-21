/**
 * CloudWatch Dashboard - Contexto de Autenticação (AuthContext)
 * Gerencia credenciais reais via Android Keystore (react-native-keychain),
 * autenticação biométrica nativa integrada ao login e importação de QR Code.
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UserSession, CloudProvider } from '../types';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QrCredentialPayload {
  provider?: CloudProvider;
  key?: string;
  secret?: string;
  region?: string;
}

interface AuthContextData {
  session: UserSession | null;
  isAuthenticated: boolean;
  selectedLoginProvider: CloudProvider;
  isLoading: boolean;
  hasStoredCredentials: boolean;
  storedUsername: string | null;
  setSelectedLoginProvider: (provider: CloudProvider) => void;
  loginWithCredentials: (
    keyId: string,
    secretKey: string
  ) => Promise<{ success: boolean; error?: string; isFirstAccess?: boolean }>;
  loginWithBiometrics: () => Promise<{ success: boolean; error?: string }>;
  loginWithQrCodePayload: (
    payloadJson: string
  ) => { success: boolean; data?: QrCredentialPayload; error?: string };
  verifyTwoFactorToken: (token: string) => Promise<boolean>;
  clearStoredCredentials: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const STORAGE_KEY_USERNAME = '@cloudwatch:saved_key_id';
const STORAGE_KEY_FLAG = '@cloudwatch:has_keystore_credentials';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [selectedLoginProvider, setSelectedLoginProvider] = useState<CloudProvider>('OCI');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState<boolean>(false);
  const [storedUsername, setStoredUsername] = useState<string | null>(null);

  // Inicializa e verifica se há credenciais salvas no Keystore / AsyncStorage
  useEffect(() => {
    const checkSavedCredentials = async () => {
      try {
        const savedId = await AsyncStorage.getItem(STORAGE_KEY_USERNAME);
        const flag = await AsyncStorage.getItem(STORAGE_KEY_FLAG);
        const services = await Keychain.getAllGenericPasswordServices();
        const existsInKeychain = services && services.includes('cloudwatch_auth');

        if (savedId || flag === 'true' || existsInKeychain) {
          setHasStoredCredentials(true);
          if (savedId) {
            setStoredUsername(savedId);
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar credenciais salvas:', err);
      }
    };

    checkSavedCredentials();
  }, []);

  const createSession = (username: string): UserSession => {
    const displayName = username.includes('ocid1')
      ? 'Administrador Oracle OCI'
      : username.includes('AKIA')
      ? 'Administrador AWS'
      : username.includes('@')
      ? username.split('@')[0]
      : 'DevOps / Cloud Admin';

    return {
      userId: 'usr-' + (username.length > 8 ? username.slice(-8) : username),
      email: username.includes('@') ? username : `${username.slice(0, 12)}@cloudwatch.corp`,
      name: displayName,
      role: 'ADMIN',
      token: 'jwt_keystore_secure_' + Date.now(),
      refreshToken: 'jwt_refresh_secure_' + Date.now(),
      twoFactorEnabled: true,
      twoFactorVerified: true,
      biometricEnabled: true,
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    };
  };

  /**
   * Fluxo Unificado:
   * 1. Se já existirem credenciais salvas: dispara o prompt nativo de biometria para descriptografar.
   * 2. Se for primeiro acesso: salva no Android Keystore com BIOMETRY_ANY e dispara confirmação biométrica.
   */
  const loginWithCredentials = async (
    keyId: string,
    secretKey: string
  ): Promise<{ success: boolean; error?: string; isFirstAccess?: boolean }> => {
    if (!keyId || !keyId.trim()) {
      return { success: false, error: 'O identificador de chave (Key ID / OCID) é obrigatório.' };
    }
    if (!secretKey || !secretKey.trim()) {
      return { success: false, error: 'A chave secreta (Secret Key / Token) é obrigatória.' };
    }

    setIsLoading(true);

    try {
      if (hasStoredCredentials) {
        // Acesso Recorrente: Dispara o prompt biométrico nativo do Android
        const credentials = await Keychain.getGenericPassword({
          service: 'cloudwatch_auth',
          authenticationPrompt: {
            title: 'Autenticação Biométrica',
            subtitle: 'CloudWatch Dashboard - Keystore Seguro',
            description: 'Toque no sensor de impressão digital para confirmar seu acesso',
            cancel: 'Cancelar',
          },
        });

        if (credentials && credentials.username) {
          setSession(createSession(credentials.username));
          setIsLoading(false);
          return { success: true, isFirstAccess: false };
        } else {
          setIsLoading(false);
          return {
            success: false,
            error: 'Autenticação biométrica cancelada ou não reconhecida.',
          };
        }
      } else {
        // Primeiro Acesso (Cadastro no Keystore):
        // 1. Salva com controle biométrico
        await Keychain.setGenericPassword(keyId.trim(), secretKey.trim(), {
          service: 'cloudwatch_auth',
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
        });

        await AsyncStorage.setItem(STORAGE_KEY_USERNAME, keyId.trim());
        await AsyncStorage.setItem(STORAGE_KEY_FLAG, 'true');
        setHasStoredCredentials(true);
        setStoredUsername(keyId.trim());

        // 2. Dispara confirmação biométrica do sistema para vincular
        try {
          await Keychain.getGenericPassword({
            service: 'cloudwatch_auth',
            authenticationPrompt: {
              title: 'Vincular Biometria',
              subtitle: 'Registro no Android Keystore',
              description: 'Confirme sua digital para vincular suas credenciais ao dispositivo',
              cancel: 'Pular',
            },
          });
        } catch (bioConfirmErr) {
          console.log('Confirmação biométrica inicial ignorada/concluída:', bioConfirmErr);
        }

        setSession(createSession(keyId.trim()));
        setIsLoading(false);
        return { success: true, isFirstAccess: true };
      }
    } catch (error: any) {
      setIsLoading(false);
      console.warn('Erro durante autenticação com Keystore:', error);
      return {
        success: false,
        error: error?.message || 'Falha ao acessar o Android Keystore ou leitor biométrico.',
      };
    }
  };

  /**
   * Disparo direto do prompt biométrico nativo para credenciais já registradas
   */
  const loginWithBiometrics = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const credentials = await Keychain.getGenericPassword({
        service: 'cloudwatch_auth',
        authenticationPrompt: {
          title: 'Autenticação Biométrica',
          subtitle: 'CloudWatch Dashboard - Keystore Seguro',
          description: 'Toque no sensor de impressão digital para acessar',
          cancel: 'Cancelar',
        },
      });

      if (credentials && credentials.username) {
        setSession(createSession(credentials.username));
        setIsLoading(false);
        return { success: true };
      } else {
        setIsLoading(false);
        return {
          success: false,
          error: 'Biometria cancelada ou nenhuma credencial encontrada.',
        };
      }
    } catch (error: any) {
      setIsLoading(false);
      console.warn('Erro no prompt biométrico:', error);
      return {
        success: false,
        error: error?.message || 'Falha na validação biométrica do dispositivo.',
      };
    }
  };

  /**
   * Processa o payload JSON lido pela câmera via QR Code real
   */
  const loginWithQrCodePayload = (
    payloadJson: string
  ): { success: boolean; data?: QrCredentialPayload; error?: string } => {
    try {
      const parsed = JSON.parse(payloadJson);
      const provider = parsed.provider?.toUpperCase();
      const validProvider: CloudProvider =
        provider === 'AWS' || provider === 'GCP' ? provider : 'OCI';

      const key = parsed.key || parsed.accessKey || parsed.ocid || parsed.userOcid || '';
      const secret = parsed.secret || parsed.privateKey || parsed.secretKey || '';
      const region = parsed.region || 'sa-saopaulo-1';

      if (!key) {
        return {
          success: false,
          error: 'QR Code lido não possui campo de chave ou identificador ("key" ou "ocid").',
        };
      }

      return {
        success: true,
        data: {
          provider: validProvider,
          key,
          secret,
          region,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'Payload do QR Code inválido. Deve ser um JSON válido.',
      };
    }
  };

  /**
   * Limpa as credenciais salvas no Keystore e no AsyncStorage
   */
  const clearStoredCredentials = async (): Promise<void> => {
    try {
      await Keychain.resetGenericPassword({ service: 'cloudwatch_auth' });
      await AsyncStorage.removeItem(STORAGE_KEY_USERNAME);
      await AsyncStorage.removeItem(STORAGE_KEY_FLAG);
      setHasStoredCredentials(false);
      setStoredUsername(null);
    } catch (err) {
      console.warn('Erro ao limpar credenciais salvas:', err);
    }
  };

  const verifyTwoFactorToken = async (token: string): Promise<boolean> => {
    if (session) {
      setSession({ ...session, twoFactorVerified: true });
      return true;
    }
    return false;
  };

  const logout = () => {
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: !!session,
        selectedLoginProvider,
        isLoading,
        hasStoredCredentials,
        storedUsername,
        setSelectedLoginProvider,
        loginWithCredentials,
        loginWithBiometrics,
        loginWithQrCodePayload,
        verifyTwoFactorToken,
        clearStoredCredentials,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextData => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
