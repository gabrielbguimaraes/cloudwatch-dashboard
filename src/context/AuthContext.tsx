// src/context/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LayoutAnimation, Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  SupportedCloud,
  MasterProfile,
  CloudCredentialConfig,
  UserSessionState,
} from '../types/auth';
import type { UserSession, CloudProvider } from '../types';

interface AuthContextData {
  masterUser: MasterProfile | null;
  cloudAccounts: Record<SupportedCloud, CloudCredentialConfig>;
  activeProvider: SupportedCloud;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: UserSession | null;
  registerMasterAccount: (
    username: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  linkCloudProvider: (
    provider: SupportedCloud,
    credentials: Record<string, string>,
    enableBiometrics: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  toggleBiometrics: (provider: SupportedCloud, enabled: boolean) => Promise<boolean>;
  unlinkCloudProvider: (provider: SupportedCloud) => Promise<boolean>;
  switchActiveProvider: (provider: SupportedCloud) => Promise<boolean>;
  loginMaster: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginWithBiometrics: () => Promise<{ success: boolean; error?: string }>;
  logoutMaster: () => Promise<void>;
  logout: () => void;
  // Compatibilidade com fluxos legados
  hasStoredCredentials: boolean;
  storedCredentials: any;
  selectedLoginProvider: CloudProvider;
  setSelectedLoginProvider: (p: CloudProvider) => void;
  loginWithCredentials: (payload: any) => Promise<any>;
  loginWithQrCodePayload: (raw: string) => any;
  verifyTwoFactorToken: (token: string) => Promise<boolean>;
  clearStoredCredentials: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const STORAGE_KEY_MASTER_USER = '@master_user_profile';
const STORAGE_KEY_MASTER_PASS = '@master_user_secret';
const STORAGE_KEY_CLOUD_ACCOUNTS = '@cloud_accounts_config';
const KEYCHAIN_SERVICE = 'cloudwatch_master_auth';
const KEYCHAIN_USER = 'cloudwatch_master';

const DEFAULT_ACCOUNTS: Record<SupportedCloud, CloudCredentialConfig> = {
  OCI: {
    provider: 'OCI',
    isConfigured: true, // Inicialmente disponivel com credenciais nativas
    biometricsEnabled: false,
    accountIdentifier: 'ocid1.tenancy.oc1..aaaaaaaab1234567890',
    region: 'sa-saopaulo-1',
    credentials: {
      tenancyOcid: 'ocid1.tenancy.oc1..aaaaaaaab1234567890',
      userOcid: 'ocid1.user.oc1..aaaaaaaax74n9b2k3l4m',
      fingerprint: '0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59',
      region: 'sa-saopaulo-1',
    },
    lastSyncedAt: new Date().toISOString(),
  },
  AWS: {
    provider: 'AWS',
    isConfigured: false,
    biometricsEnabled: false,
    accountIdentifier: '',
    region: 'us-east-1',
    credentials: {},
  },
  GCP: {
    provider: 'GCP',
    isConfigured: false,
    biometricsEnabled: false,
    accountIdentifier: '',
    region: 'southamerica-east1',
    credentials: {},
  },
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [masterUser, setMasterUser] = useState<MasterProfile | null>(null);
  const [cloudAccounts, setCloudAccounts] = useState<Record<SupportedCloud, CloudCredentialConfig>>(DEFAULT_ACCOUNTS);
  const [activeProvider, setActiveProvider] = useState<SupportedCloud>('OCI');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Inicializacao da sessao e contas em disco seguro
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedUser = await EncryptedStorage.getItem(STORAGE_KEY_MASTER_USER);
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setMasterUser(parsed);
        }

        const storedAccounts = await AsyncStorage.getItem(STORAGE_KEY_CLOUD_ACCOUNTS);
        if (storedAccounts) {
          const parsedAccounts = JSON.parse(storedAccounts);
          setCloudAccounts(parsedAccounts);
          // Determina a primeira nuvem configurada
          const firstConfigured = (['OCI', 'AWS', 'GCP'] as SupportedCloud[]).find(
            (c) => parsedAccounts[c]?.isConfigured
          );
          if (firstConfigured) {
            setActiveProvider(firstConfigured);
          }
        }
      } catch (err) {
        console.warn('Falha no bootstrap de autenticacao:', err);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  /**
   * Registro da Conta Mestre Local
   */
  const registerMasterAccount = async (
    username: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      return { success: false, error: 'Preencha todos os campos obrigatorios.' };
    }

    try {
      const profile: MasterProfile = {
        id: `usr-${Date.now().toString(36)}`,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
      };

      await EncryptedStorage.setItem(STORAGE_KEY_MASTER_USER, JSON.stringify(profile));
      await EncryptedStorage.setItem(STORAGE_KEY_MASTER_PASS, password);

      // Vincula Keychain token leve para autorizacao biometrica
      try {
        await Keychain.setGenericPassword(KEYCHAIN_USER, profile.id, {
          service: KEYCHAIN_SERVICE,
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
        });
      } catch (kcErr) {
        console.log('Keychain inicial configurado:', kcErr);
      }

      setMasterUser(profile);
      setIsAuthenticated(true);
      return { success: true };
    } catch (err: any) {
      console.warn('Erro ao registrar conta mestre:', err);
      return { success: false, error: err?.message || 'Falha ao gravar conta mestre.' };
    }
  };

  /**
   * Vincula ou Atualiza um Provedor de Nuvem (1:N)
   */
  const linkCloudProvider = async (
    provider: SupportedCloud,
    credentials: Record<string, string>,
    enableBiometrics: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Criptografa chaves isoladas no EncryptedStorage
      await EncryptedStorage.setItem(`@cloud_creds_${provider}`, JSON.stringify(credentials));

      // 2. Se biometria ativada, dispara prompt nativo para validar digital
      let bioSuccess = false;
      if (enableBiometrics) {
        try {
          const auth = await Keychain.getGenericPassword({
            service: KEYCHAIN_SERVICE,
            authenticationPrompt: {
              title: `Ativar Biometria (${provider})`,
              subtitle: 'Autorizacao de credencial em nuvem',
              description: `Confirme sua digital para autorizar operacoes na conta ${provider}`,
              cancel: 'Cancelar',
            },
          });
          bioSuccess = !!(auth && auth.username);
        } catch {
          bioSuccess = false;
        }
      }

      // 3. Atualiza estado da conta
      let identifier = '';
      let region = 'sa-saopaulo-1';

      if (provider === 'OCI') {
        identifier = credentials.tenancyOcid || credentials.tenancyId || 'Tenancy OCI';
        region = credentials.region || 'sa-saopaulo-1';
      } else if (provider === 'AWS') {
        identifier = credentials.accessKeyId || credentials.accountId || 'AWS Account';
        region = credentials.region || 'us-east-1';
      } else if (provider === 'GCP') {
        identifier = credentials.projectId || 'GCP Project';
        region = credentials.region || 'southamerica-east1';
      }

      const updatedAccount: CloudCredentialConfig = {
        provider,
        isConfigured: true,
        biometricsEnabled: bioSuccess,
        accountIdentifier: identifier,
        region,
        credentials,
        lastSyncedAt: new Date().toISOString(),
      };

      const newAccounts = {
        ...cloudAccounts,
        [provider]: updatedAccount,
      };

      setCloudAccounts(newAccounts);
      await AsyncStorage.setItem(STORAGE_KEY_CLOUD_ACCOUNTS, JSON.stringify(newAccounts));

      // Se a nuvem ativa atual nao estiver configurada, seleciona a nova
      if (!cloudAccounts[activeProvider]?.isConfigured) {
        setActiveProvider(provider);
      }

      return { success: true };
    } catch (err: any) {
      console.warn(`Erro ao vincular ${provider}:`, err);
      return { success: false, error: err?.message || 'Falha ao vincular provedor.' };
    }
  };

  /**
   * Alterna a exigencia de biometria para uma nuvem
   */
  const toggleBiometrics = async (provider: SupportedCloud, enabled: boolean): Promise<boolean> => {
    try {
      if (enabled) {
        const auth = await Keychain.getGenericPassword({
          service: KEYCHAIN_SERVICE,
          authenticationPrompt: {
            title: `Ativar Biometria (${provider})`,
            subtitle: 'Autenticacao segura',
            description: 'Confirme sua digital para ativar o bloqueio biometrico',
            cancel: 'Cancelar',
          },
        });
        if (!auth || !auth.username) return false;
      }

      const updated = {
        ...cloudAccounts,
        [provider]: {
          ...cloudAccounts[provider],
          biometricsEnabled: enabled,
        },
      };

      setCloudAccounts(updated);
      await AsyncStorage.setItem(STORAGE_KEY_CLOUD_ACCOUNTS, JSON.stringify(updated));
      return true;
    } catch (err) {
      console.warn('Erro ao alternar biometria:', err);
      return false;
    }
  };

  /**
   * Desconecta e purga credenciais do provedor selecionado
   */
  const unlinkCloudProvider = async (provider: SupportedCloud): Promise<boolean> => {
    try {
      await EncryptedStorage.removeItem(`@cloud_creds_${provider}`);

      const resetAccount: CloudCredentialConfig = {
        provider,
        isConfigured: false,
        biometricsEnabled: false,
        accountIdentifier: '',
        region: provider === 'AWS' ? 'us-east-1' : provider === 'GCP' ? 'southamerica-east1' : 'sa-saopaulo-1',
        credentials: {},
      };

      const updated = {
        ...cloudAccounts,
        [provider]: resetAccount,
      };

      setCloudAccounts(updated);
      await AsyncStorage.setItem(STORAGE_KEY_CLOUD_ACCOUNTS, JSON.stringify(updated));

      // Se a nuvem ativa for a desconectada, comuta para outra configurada
      if (activeProvider === provider) {
        const remaining = (['OCI', 'AWS', 'GCP'] as SupportedCloud[]).find(
          (c) => c !== provider && updated[c]?.isConfigured
        );
        if (remaining) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setActiveProvider(remaining);
        }
      }

      return true;
    } catch (err) {
      console.warn('Erro ao desvincular nuvem:', err);
      return false;
    }
  };

  /**
   * Comuta o provedor ativo com Step-Up Biometric Authentication se ativada
   */
  const switchActiveProvider = async (provider: SupportedCloud): Promise<boolean> => {
    const targetConfig = cloudAccounts[provider];
    if (!targetConfig?.isConfigured) {
      return false;
    }

    if (activeProvider === provider) {
      return true;
    }

    // Se a nuvem alvo exige biometria, valida no leitor nativo
    if (targetConfig.biometricsEnabled) {
      try {
        const credentials = await Keychain.getGenericPassword({
          service: KEYCHAIN_SERVICE,
          authenticationPrompt: {
            title: `Acesso a Nuvem: ${provider}`,
            subtitle: 'Validacao biometrica de seguranca',
            description: `Toque no sensor digital para desbloquear o console ${provider}`,
            cancel: 'Cancelar',
          },
        });

        if (!credentials || !credentials.username) {
          return false;
        }
      } catch (err) {
        console.warn('Autenticacao biometrica step-up cancelada:', err);
        return false;
      }
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveProvider(provider);
    return true;
  };

  /**
   * Login Mestre com usuario e senha
   */
  const loginMaster = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const storedUserJson = await EncryptedStorage.getItem(STORAGE_KEY_MASTER_USER);
      const storedPass = await EncryptedStorage.getItem(STORAGE_KEY_MASTER_PASS);

      if (!storedUserJson || !storedPass) {
        setIsLoading(false);
        return { success: false, error: 'Nenhuma conta mestre cadastrada no dispositivo.' };
      }

      const parsed: MasterProfile = JSON.parse(storedUserJson);

      const isMatch =
        (username.trim().toLowerCase() === parsed.username.toLowerCase() ||
          username.trim().toLowerCase() === parsed.email.toLowerCase()) &&
        password === storedPass;

      if (isMatch) {
        setMasterUser(parsed);
        setIsAuthenticated(true);
        setIsLoading(false);
        return { success: true };
      } else {
        setIsLoading(false);
        return { success: false, error: 'Credenciais mestre invalidas.' };
      }
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err?.message || 'Falha ao autenticar conta mestre.' };
    }
  };

  /**
   * Login Mestre por Biometria
   */
  const loginWithBiometrics = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const credentials = await Keychain.getGenericPassword({
        service: KEYCHAIN_SERVICE,
        authenticationPrompt: {
          title: 'Autenticacao Biometrica',
          subtitle: 'Estacao de Comando Multi-Cloud',
          description: 'Toque no sensor de impressao digital para acessar',
          cancel: 'Cancelar',
        },
      });

      if (credentials && credentials.username) {
        const storedUserJson = await EncryptedStorage.getItem(STORAGE_KEY_MASTER_USER);
        if (storedUserJson) {
          setMasterUser(JSON.parse(storedUserJson));
        } else {
          // Fallback para conta mestre padrao
          const defaultUser: MasterProfile = {
            id: 'usr-admin',
            username: 'joao.guimaraes',
            email: 'joao.guimaraes@fatec.sp.gov.br',
            createdAt: new Date().toISOString(),
          };
          setMasterUser(defaultUser);
        }

        setIsAuthenticated(true);
        setIsLoading(false);
        return { success: true };
      } else {
        setIsLoading(false);
        return { success: false, error: 'Biometria cancelada ou nao reconhecida.' };
      }
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err?.message || 'Falha na validacao biometrica.' };
    }
  };

  /**
   * Logout Mestre: Destroi sessao e zera memoria
   */
  const logoutMaster = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem('@cloudwatch_resources');
      await AsyncStorage.removeItem('@cloudwatch:pinned_resources');
      setIsAuthenticated(false);
    } catch (err) {
      console.warn('Erro ao efetuar logout mestre:', err);
    }
  };

  const logout = () => {
    logoutMaster();
  };

  // Objeto de sessao adaptado para retrocompatibilidade
  const session: UserSession | null = isAuthenticated
    ? {
        userId: masterUser?.id || 'usr-master',
        email: masterUser?.email || 'admin@cloudwatch.corp',
        name: masterUser?.username || 'Administrador Master',
        role: 'ADMIN',
        token: 'master_token_' + Date.now(),
        refreshToken: 'refresh_' + Date.now(),
        twoFactorEnabled: true,
        twoFactorVerified: true,
        biometricEnabled: true,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        masterUser,
        cloudAccounts,
        activeProvider,
        isAuthenticated,
        isLoading,
        session,
        registerMasterAccount,
        linkCloudProvider,
        toggleBiometrics,
        unlinkCloudProvider,
        switchActiveProvider,
        loginMaster,
        loginWithBiometrics,
        logoutMaster,
        logout,
        // Compatibilidade legada
        hasStoredCredentials: !!masterUser,
        storedCredentials: null,
        selectedLoginProvider: activeProvider,
        setSelectedLoginProvider: (p: CloudProvider) => switchActiveProvider(p),
        loginWithCredentials: async () => ({ success: true }),
        loginWithQrCodePayload: () => ({ success: false, error: 'QR Code descontinuado.' }),
        verifyTwoFactorToken: async () => true,
        clearStoredCredentials: async () => {
          await EncryptedStorage.clear();
          await AsyncStorage.clear();
          setMasterUser(null);
          setIsAuthenticated(false);
        },
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
