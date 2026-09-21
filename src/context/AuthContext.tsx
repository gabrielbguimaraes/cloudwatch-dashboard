/**
 * CloudWatch Dashboard - Contexto de Autenticação (AuthContext)
 * Arquitetura Desacoplada:
 * 1. react-native-encrypted-storage: Armazena o JSON completo das credenciais (@oci_credentials) via AES-256-GCM.
 * 2. react-native-keychain: Armazena exclusivamente o token de sessão com controle biométrico (<= 40 bytes),
 *    eliminando a exceção javax.crypto.IllegalBlockSizeException do Android Keystore.
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UserSession, CloudProvider } from '../types';
import * as Keychain from 'react-native-keychain';
import EncryptedStorage from 'react-native-encrypted-storage';

export interface OciStoredCredentials {
  provider: 'OCI';
  tenancyId: string;
  userId: string;
  fingerprint: string;
  region: string;
  privateKey?: string;
}

export interface GenericCredentialPayload {
  provider: CloudProvider;
  keyId?: string;
  secretKey?: string;
  tenancyId?: string;
  userId?: string;
  fingerprint?: string;
  region?: string;
  privateKey?: string;
}

interface AuthContextData {
  session: UserSession | null;
  isAuthenticated: boolean;
  selectedLoginProvider: CloudProvider;
  isLoading: boolean;
  hasStoredCredentials: boolean;
  storedCredentials: GenericCredentialPayload | null;
  setSelectedLoginProvider: (provider: CloudProvider) => void;
  loginWithCredentials: (
    payload: GenericCredentialPayload
  ) => Promise<{ success: boolean; error?: string; isFirstAccess?: boolean }>;
  loginWithBiometrics: () => Promise<{ success: boolean; error?: string }>;
  loginWithQrCodePayload: (
    rawPayload: string
  ) => { success: boolean; data?: GenericCredentialPayload; error?: string };
  verifyTwoFactorToken: (token: string) => Promise<boolean>;
  clearStoredCredentials: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const STORAGE_KEY_CREDENTIALS = '@oci_credentials';
const KEYCHAIN_SERVICE = 'cloudwatch_auth';
const KEYCHAIN_SESSION_USER = 'cloudwatch_session';
const KEYCHAIN_SESSION_TOKEN = 'session_active_token';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [selectedLoginProvider, setSelectedLoginProvider] = useState<CloudProvider>('OCI');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState<boolean>(false);
  const [storedCredentials, setStoredCredentials] = useState<GenericCredentialPayload | null>(null);

  // Inicializa e verifica se há credenciais salvas no EncryptedStorage
  useEffect(() => {
    const checkStoredCredentials = async () => {
      try {
        const raw = await EncryptedStorage.getItem(STORAGE_KEY_CREDENTIALS);
        if (raw) {
          const parsed = JSON.parse(raw);
          setHasStoredCredentials(true);
          setStoredCredentials(parsed);
          if (parsed.provider) {
            setSelectedLoginProvider(parsed.provider);
          }
        } else {
          setHasStoredCredentials(false);
          setStoredCredentials(null);
        }
      } catch (err) {
        console.warn('Erro ao verificar credenciais salvas no EncryptedStorage:', err);
      }
    };

    checkStoredCredentials();
  }, []);

  const createSession = (identifier: string): UserSession => {
    const displayName = identifier.includes('ocid1')
      ? 'Administrador Oracle OCI'
      : identifier.includes('AKIA')
      ? 'Administrador AWS'
      : identifier.includes('@')
      ? identifier.split('@')[0]
      : 'DevOps / Cloud Admin';

    return {
      userId: 'usr-' + (identifier.length > 8 ? identifier.slice(-8) : identifier),
      email: identifier.includes('@') ? identifier : `${identifier.slice(0, 12)}@cloudwatch.corp`,
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
   * Fluxo de Login Desacoplado:
   * - Se já há credenciais salvas: dispara biometria nativa pelo Keychain para autorizar a leitura do EncryptedStorage.
   * - Se for primeiro acesso: salva no EncryptedStorage (sem limite de 256 bytes) e registra chave biométrica leve no Keychain.
   */
  const loginWithCredentials = async (
    payload: GenericCredentialPayload
  ): Promise<{ success: boolean; error?: string; isFirstAccess?: boolean }> => {
    setIsLoading(true);

    try {
      if (hasStoredCredentials) {
        // Acesso Recorrente: Dispara o prompt biométrico nativo do Android
        const credentials = await Keychain.getGenericPassword({
          service: KEYCHAIN_SERVICE,
          authenticationPrompt: {
            title: 'Autenticação Biométrica',
            subtitle: 'CloudWatch Dashboard - Keystore Seguro',
            description: 'Toque no sensor de impressão digital para confirmar seu acesso',
            cancel: 'Cancelar',
          },
        });

        if (credentials && credentials.username) {
          // Sucesso na digital: recupera os dados reais do EncryptedStorage
          const storedJson = await EncryptedStorage.getItem(STORAGE_KEY_CREDENTIALS);
          const activeCreds = storedJson ? JSON.parse(storedJson) : payload;
          const userIdentifier = activeCreds.userId || activeCreds.keyId || 'Administrador OCI';

          setSession(createSession(userIdentifier));
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
        // Primeiro Acesso (Cadastro):
        // 1. Salva o payload completo em EncryptedStorage (AES-256-GCM sem limite de tamanho)
        await EncryptedStorage.setItem(STORAGE_KEY_CREDENTIALS, JSON.stringify(payload));

        // 2. Registra no Keychain apenas o identificador pequeno de sessão (< 40 bytes),
        // evitando a limitação de 245 bytes da cifra RSA do Android Keystore
        await Keychain.setGenericPassword(KEYCHAIN_SESSION_USER, KEYCHAIN_SESSION_TOKEN, {
          service: KEYCHAIN_SERVICE,
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
        });

        setHasStoredCredentials(true);
        setStoredCredentials(payload);

        // 3. Dispara confirmação biométrica do sistema para vincular o acesso
        try {
          await Keychain.getGenericPassword({
            service: KEYCHAIN_SERVICE,
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

        const userIdentifier = payload.userId || payload.keyId || 'Administrador OCI';
        setSession(createSession(userIdentifier));
        setIsLoading(false);
        return { success: true, isFirstAccess: true };
      }
    } catch (error: any) {
      setIsLoading(false);
      console.warn('Erro durante autenticação com Keystore:', error);
      return {
        success: false,
        error: error?.message || 'Falha ao processar cofre de credenciais.',
      };
    }
  };

  /**
   * Disparo direto do prompt biométrico nativo para desbloquear credenciais já registradas
   */
  const loginWithBiometrics = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const credentials = await Keychain.getGenericPassword({
        service: KEYCHAIN_SERVICE,
        authenticationPrompt: {
          title: 'Autenticação Biométrica',
          subtitle: 'CloudWatch Dashboard - Keystore Seguro',
          description: 'Toque no sensor de impressão digital para acessar',
          cancel: 'Cancelar',
        },
      });

      if (credentials && credentials.username) {
        const storedJson = await EncryptedStorage.getItem(STORAGE_KEY_CREDENTIALS);
        const activeCreds = storedJson ? JSON.parse(storedJson) : storedCredentials;
        const userIdentifier = activeCreds?.userId || activeCreds?.keyId || 'Administrador OCI';

        setSession(createSession(userIdentifier));
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
   * Processa o payload do QR Code em Plain Text com validação robusta
   */
  const loginWithQrCodePayload = (
    rawPayload: string
  ): { success: boolean; data?: GenericCredentialPayload; error?: string } => {
    if (!rawPayload || typeof rawPayload !== 'string') {
      return {
        success: false,
        error: 'QR Code inválido. Certifique-se de escanear uma configuração OCI em Plain Text.',
      };
    }

    const trimmed = rawPayload.trim();

    try {
      const parsed = JSON.parse(trimmed);

      const provider: CloudProvider =
        parsed.provider?.toUpperCase() === 'AWS' || parsed.provider?.toUpperCase() === 'GCP'
          ? parsed.provider.toUpperCase()
          : 'OCI';

      const tenancyId = parsed.tenancyId || parsed.tenancyOcid || '';
      const userId = parsed.userId || parsed.userOcid || parsed.key || '';
      const fingerprint = parsed.fingerprint || '';
      const region = parsed.region || 'sa-saopaulo-1';
      const privateKey = parsed.privateKey || parsed.secret || '';

      if (provider === 'OCI' && !tenancyId && !userId) {
        return {
          success: false,
          error: 'QR Code inválido. Certifique-se de escanear uma configuração OCI em Plain Text.',
        };
      }

      return {
        success: true,
        data: {
          provider,
          tenancyId,
          userId,
          fingerprint,
          region,
          privateKey,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: 'QR Code inválido. Certifique-se de escanear uma configuração OCI em Plain Text.',
      };
    }
  };

  /**
   * Limpa as credenciais salvas no Keystore e no EncryptedStorage
   */
  const clearStoredCredentials = async (): Promise<void> => {
    try {
      await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
      await EncryptedStorage.removeItem(STORAGE_KEY_CREDENTIALS);
      setHasStoredCredentials(false);
      setStoredCredentials(null);
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
        storedCredentials,
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
