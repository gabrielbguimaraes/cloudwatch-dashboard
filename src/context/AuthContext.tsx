// src/context/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { LayoutAnimation } from 'react-native';
import * as Keychain from 'react-native-keychain';
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  SupportedCloud,
  MasterProfile,
  CloudCredentialConfig,
} from '../types/auth';
import type { UserSession, CloudProvider } from '../types';
import { apiService } from '../services/api';
import apiClient, {
  saveAuthTokens,
  getAuthTokens,
  clearAuthTokens,
  setUnauthorizedHandler,
} from '../services/apiClient';
import { BIOMETRIC_REAUTH_WINDOW_MS } from '../config/env';

export interface OciAccountSummary {
  id: string;
  provider: 'OCI';
  accountIdentifier: string;
  tenancyName?: string;
  region: string;
  subscribedRegions?: string[];
  permissionStatus: 'OK' | 'NO_PERMISSION' | 'UNKNOWN';
  authMode: 'USER_API_KEY' | 'INSTANCE_PRINCIPAL';
  biometricsEnabled?: boolean;
  createdAt?: string;
}

interface AuthContextData {
  masterUser: MasterProfile | null;
  cloudAccounts: Record<SupportedCloud, CloudCredentialConfig>;
  ociAccountsList: OciAccountSummary[];
  activeOciAccountId: string | null;
  setActiveOciAccountId: (id: string | null) => void;
  activeProvider: SupportedCloud;
  connectedProviders: SupportedCloud[];
  hasConnectedClouds: boolean;
  justRegistered: boolean;
  clearJustRegistered: () => void;
  isOwnerUser: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: UserSession | null;
  registerMasterAccount: (
    username: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  refreshCloudAccounts: () => Promise<void>;
  linkCloudProvider: (
    provider: SupportedCloud,
    credentials: Record<string, string>,
    enableBiometrics: boolean
  ) => Promise<{ success: boolean; error?: string; permissionStatus?: string; hint?: string }>;
  activateOwnerDemoAccount: () => Promise<{ success: boolean; error?: string }>;
  toggleBiometrics: (provider: SupportedCloud, enabled: boolean) => Promise<boolean>;
  unlinkCloudProvider: (provider: SupportedCloud, accountId?: string) => Promise<boolean>;
  switchActiveProvider: (provider: SupportedCloud) => Promise<boolean>;
  loginMaster: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginWithBiometrics: () => Promise<{ success: boolean; error?: string }>;
  logoutMaster: () => Promise<void>;
  logout: () => void;
  hasStoredCredentials: boolean;
  storedCredentials: null;
  selectedLoginProvider: CloudProvider;
  setSelectedLoginProvider: (p: CloudProvider) => void;
  verifyTwoFactorToken: (token: string) => Promise<boolean>;
  clearStoredCredentials: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const STORAGE_KEY_MASTER_USER = '@master_user_profile';
const LEGACY_STORAGE_KEY_MASTER_PASS = '@master_user_secret';
const BIOMETRIC_GATE_SERVICE = 'cloudwatch_biometric_gate_v2';
const BIOMETRIC_GATE_USER = 'cloudwatch_bio_marker';

const getCloudAccountsStorageKey = (userId: string) => `@cloud_accounts_config:${userId}`;

export const createEmptyAccountsState = (): Record<SupportedCloud, CloudCredentialConfig> => ({
  OCI: {
    provider: 'OCI',
    isConfigured: false,
    biometricsEnabled: false,
    accountIdentifier: '',
    region: 'sa-saopaulo-1',
    credentials: {},
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
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [masterUser, setMasterUser] = useState<MasterProfile | null>(null);
  const [accessTokenState, setAccessTokenState] = useState<string>('');
  const [cloudAccounts, setCloudAccounts] = useState<Record<SupportedCloud, CloudCredentialConfig>>(
    createEmptyAccountsState
  );
  const [ociAccountsList, setOciAccountsList] = useState<OciAccountSummary[]>([]);
  const [activeOciAccountId, setActiveOciAccountId] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<SupportedCloud>('OCI');
  const [unlockedClouds, setUnlockedClouds] = useState<Record<SupportedCloud, number>>({
    OCI: 0,
    AWS: 0,
    GCP: 0,
  });
  const [isOwnerUser, setIsOwnerUser] = useState<boolean>(false);
  const [justRegistered, setJustRegistered] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [biometricAvailableOnDevice, setBiometricAvailableOnDevice] = useState<boolean>(false);

  const connectedProviders = (['OCI', 'AWS', 'GCP'] as SupportedCloud[]).filter(
    (p) => cloudAccounts[p]?.isConfigured
  );
  const hasConnectedClouds = connectedProviders.length > 0;

  /**
   * Purga chaves legadas globais e credenciais locais antigas no dispositivo
   */
  const purgeLegacyDeviceSecrets = useCallback(async () => {
    await EncryptedStorage.removeItem(LEGACY_STORAGE_KEY_MASTER_PASS).catch(() => {});
    await EncryptedStorage.removeItem('@cloud_creds_OCI').catch(() => {});
    await EncryptedStorage.removeItem('@cloud_creds_AWS').catch(() => {});
    await EncryptedStorage.removeItem('@cloud_creds_GCP').catch(() => {});
    await AsyncStorage.removeItem('@cloud_accounts_config').catch(() => {});
    await AsyncStorage.removeItem('@cloudwatch_resources').catch(() => {});
    await AsyncStorage.removeItem('@cloudwatch:pinned_resources').catch(() => {});
  }, []);

  /**
   * Limpa o estado em memoria e o cache local pertencente a um usuario
   */
  const clearUserScopedLocalData = useCallback(async (userId?: string | null) => {
    setCloudAccounts(createEmptyAccountsState());
    setOciAccountsList([]);
    setActiveOciAccountId(null);
    setUnlockedClouds({ OCI: 0, AWS: 0, GCP: 0 });
    setIsOwnerUser(false);
    setActiveProvider('OCI');

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter((k) => {
        if (
          k === '@cloud_accounts_config' ||
          k === '@cloudwatch_resources' ||
          k === '@cloudwatch:pinned_resources' ||
          k.startsWith('@cloudwatch_cache_instances') ||
          k.startsWith('@cloudwatch_cache_metrics') ||
          k.startsWith('@cloudwatch_cache_logs')
        ) {
          return true;
        }
        if (userId && k.includes(`:${userId}`)) {
          return true;
        }
        return false;
      });
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (err) {
      console.warn('[AuthContext] Aviso ao limpar chaves locais:', err);
    }
  }, []);

  /**
   * Carrega o estado real das contas conectadas do usuario a partir do BFF (GET /api/oci/accounts)
   * com fallback para snapshot em cache do proprio usuario se offline
   */
  const loadAccountsForUser = useCallback(async (userId: string) => {
    const storageKey = getCloudAccountsStorageKey(userId);
    let baseAccounts = createEmptyAccountsState();

    // 1. Carrega ultimo estado salvo especificamente para este userId (biometria local + offline cache)
    try {
      const cachedRaw = await AsyncStorage.getItem(storageKey);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed && typeof parsed === 'object') {
          baseAccounts = {
            ...createEmptyAccountsState(),
            ...parsed,
            OCI: { ...createEmptyAccountsState().OCI, ...(parsed.OCI || {}), credentials: {} },
            AWS: { ...createEmptyAccountsState().AWS, ...(parsed.AWS || {}), credentials: {} },
            GCP: { ...createEmptyAccountsState().GCP, ...(parsed.GCP || {}), credentials: {} },
          };
        }
      }
    } catch {
      // ignora erro de parse
    }

    // 2. Consulta o BFF para obter as contas OCI reais vinculadas a este usuario
    const [accountsRes, statusRes] = await Promise.all([
      apiClient.get<{ accounts?: OciAccountSummary[]; isOwner?: boolean }>('/oci/accounts'),
      apiClient.get<{ isOwner?: boolean }>('/oci/status'),
    ]);

    if (statusRes.ok && statusRes.data) {
      setIsOwnerUser(Boolean(statusRes.data.isOwner));
    } else if (accountsRes.ok && accountsRes.data && typeof accountsRes.data.isOwner === 'boolean') {
      setIsOwnerUser(accountsRes.data.isOwner);
    }

    if (accountsRes.ok && accountsRes.data && Array.isArray(accountsRes.data.accounts)) {
      const serverOciAccounts = accountsRes.data.accounts;
      setOciAccountsList(serverOciAccounts);

      if (serverOciAccounts.length > 0) {
        const primary = serverOciAccounts[0];
        setActiveOciAccountId((prev) =>
          prev && serverOciAccounts.some((a) => a.id === prev) ? prev : primary.id
        );

        baseAccounts = {
          ...baseAccounts,
          OCI: {
            id: primary.id,
            provider: 'OCI',
            isConfigured: true,
            biometricsEnabled: Boolean(
              baseAccounts.OCI.biometricsEnabled || primary.biometricsEnabled
            ),
            accountIdentifier:
              primary.tenancyName || primary.accountIdentifier || 'Tenancy OCI',
            tenancyName: primary.tenancyName,
            region: primary.region || 'sa-saopaulo-1',
            subscribedRegions: primary.subscribedRegions || [],
            permissionStatus: primary.permissionStatus || 'OK',
            authMode: primary.authMode || 'USER_API_KEY',
            credentials: {},
            lastSyncedAt: new Date().toISOString(),
          },
        };
      } else {
        setActiveOciAccountId(null);
        baseAccounts = {
          ...baseAccounts,
          OCI: createEmptyAccountsState().OCI,
        };
      }

      await AsyncStorage.setItem(storageKey, JSON.stringify(baseAccounts)).catch(() => {});
    }

    setCloudAccounts(baseAccounts);
    const firstConnected = (['OCI', 'AWS', 'GCP'] as SupportedCloud[]).find(
      (c) => baseAccounts[c]?.isConfigured
    );
    setActiveProvider(firstConnected || 'OCI');
  }, []);

  const refreshCloudAccounts = useCallback(async () => {
    if (masterUser?.id) {
      await loadAccountsForUser(masterUser.id);
    }
  }, [masterUser?.id, loadAccountsForUser]);

  // Handler automatico de 401 nao renovavel no apiClient
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      setAccessTokenState('');
      setIsAuthenticated(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Bootstrap inicial: purga segredos legados e verifica perfil + disponibilidade de biometria
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await purgeLegacyDeviceSecrets();

        const supportedBio = await Keychain.getSupportedBiometryType().catch(() => null);
        setBiometricAvailableOnDevice(Boolean(supportedBio));

        const storedUser = await EncryptedStorage.getItem(STORAGE_KEY_MASTER_USER);
        if (storedUser) {
          const parsed: MasterProfile = JSON.parse(storedUser);
          setMasterUser({
            ...parsed,
            role: parsed.role || 'USER',
          });
        }
      } catch (err) {
        console.warn('[AuthContext] Falha no bootstrap:', err);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [purgeLegacyDeviceSecrets]);

  /**
   * Salva um marcador pequeno (< 64 bytes) protegido por biometria de hardware
   */
  const enrollBiometricMarker = async (userId: string) => {
    try {
      await Keychain.setGenericPassword(BIOMETRIC_GATE_USER, userId, {
        service: BIOMETRIC_GATE_SERVICE,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch {
      // Dispositivo sem biometria cadastrada — segue normalmente com senha
    }
  };

  /**
   * Cadastro de Conta no App (100% dependente do BFF; nunca cria conta local falsa)
   */
  const registerMasterAccount = async (
    username: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      return { success: false, error: 'Informe nome de usuário, e-mail e senha.' };
    }

    const previousUserId = masterUser?.id;
    const remoteRes = await apiService.registerMaster(
      username.trim(),
      email.trim().toLowerCase(),
      password
    );

    if (!remoteRes.success || !remoteRes.data) {
      return {
        success: false,
        error: remoteRes.error || 'Não foi possível concluir o cadastro no servidor.',
      };
    }

    // Limpa completamente qualquer estado, conta ou cache de usuario anterior no mesmo aparelho
    await clearUserScopedLocalData(previousUserId);
    await clearUserScopedLocalData(remoteRes.data.user.id);

    const profile: MasterProfile = {
      id: remoteRes.data.user.id,
      username: remoteRes.data.user.username,
      email: remoteRes.data.user.email,
      role: remoteRes.data.user.role || 'USER',
      createdAt: remoteRes.data.user.createdAt || new Date().toISOString(),
    };

    await saveAuthTokens(remoteRes.data.accessToken, remoteRes.data.refreshToken);
    setAccessTokenState(remoteRes.data.accessToken);
    await EncryptedStorage.setItem(STORAGE_KEY_MASTER_USER, JSON.stringify(profile));
    await enrollBiometricMarker(profile.id);

    setMasterUser(profile);
    setJustRegistered(true);
    setIsAuthenticated(true);

    // Verifica se este usuario recem-criado e o OWNER_USERNAME no BFF
    await loadAccountsForUser(profile.id).catch(() => {});

    return { success: true };
  };

  /**
   * Login com Usuario/E-mail e Senha (depende estritamente da validacao do BFF; sem login offline falso)
   */
  const loginMaster = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!username.trim() || !password) {
      return { success: false, error: 'Informe seu usuário (ou e-mail) e senha.' };
    }

    setIsLoading(true);
    try {
      const previousUserId = masterUser?.id;
      const remoteRes = await apiService.loginMaster(username.trim(), password);

      if (!remoteRes.success || !remoteRes.data) {
        setIsLoading(false);
        return {
          success: false,
          error: remoteRes.error || 'Usuário ou senha inválidos.',
        };
      }

      const incomingUser = remoteRes.data.user;
      if (previousUserId && previousUserId !== incomingUser.id) {
        await clearUserScopedLocalData(previousUserId);
      } else {
        setCloudAccounts(createEmptyAccountsState());
        setOciAccountsList([]);
        setActiveOciAccountId(null);
        setUnlockedClouds({ OCI: 0, AWS: 0, GCP: 0 });
      }

      const profile: MasterProfile = {
        id: incomingUser.id,
        username: incomingUser.username,
        email: incomingUser.email,
        role: incomingUser.role || 'USER',
        createdAt: incomingUser.createdAt || new Date().toISOString(),
      };

      await saveAuthTokens(remoteRes.data.accessToken, remoteRes.data.refreshToken);
      setAccessTokenState(remoteRes.data.accessToken);
      await EncryptedStorage.setItem(STORAGE_KEY_MASTER_USER, JSON.stringify(profile));
      await enrollBiometricMarker(profile.id);

      setMasterUser(profile);
      setJustRegistered(false);
      await loadAccountsForUser(profile.id);
      setIsAuthenticated(true);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err?.message || 'Falha ao autenticar com o servidor.',
      };
    }
  };

  /**
   * Desbloqueio por Biometria: exige sensor biometrico + refresh token valido no Keychain
   */
  const loginWithBiometrics = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const tokens = await getAuthTokens();
      const storedUserJson = await EncryptedStorage.getItem(STORAGE_KEY_MASTER_USER);

      if (!tokens?.refreshToken || !storedUserJson) {
        setIsLoading(false);
        return {
          success: false,
          error: 'Nenhuma sessão ativa encontrada neste dispositivo. Entre com usuário e senha.',
        };
      }

      const bioResult = await Keychain.getGenericPassword({
        service: BIOMETRIC_GATE_SERVICE,
        authenticationPrompt: {
          title: 'Autenticação Biométrica',
          subtitle: 'CloudWatch Dashboard',
          description: 'Confirme sua identidade para retomar a sessão',
          cancel: 'Cancelar',
        },
      }).catch(() => false as const);

      if (!bioResult || !bioResult.password) {
        setIsLoading(false);
        return {
          success: false,
          error: 'Biometria cancelada ou indisponível. Utilize sua senha para entrar.',
        };
      }

      const cachedProfile: MasterProfile = JSON.parse(storedUserJson);
      const refreshRes = await apiService.refreshSession(tokens.refreshToken);

      if (refreshRes.success && refreshRes.data) {
        await saveAuthTokens(refreshRes.data.accessToken, refreshRes.data.refreshToken);
        setAccessTokenState(refreshRes.data.accessToken);

        const refreshedProfile: MasterProfile = refreshRes.data.user
          ? {
              id: refreshRes.data.user.id,
              username: refreshRes.data.user.username,
              email: refreshRes.data.user.email,
              role: refreshRes.data.user.role || 'USER',
              createdAt: refreshRes.data.user.createdAt || cachedProfile.createdAt,
            }
          : cachedProfile;

        await EncryptedStorage.setItem(STORAGE_KEY_MASTER_USER, JSON.stringify(refreshedProfile));
        setMasterUser(refreshedProfile);
        setJustRegistered(false);
        await loadAccountsForUser(refreshedProfile.id);
        setIsAuthenticated(true);
        setIsLoading(false);
        return { success: true };
      }

      // Se o BFF estava inacessivel (modo offline), permite visualizar o cache local da sessao ja autenticada
      if (refreshRes.isNetworkError) {
        setAccessTokenState(tokens.accessToken);
        setMasterUser({ ...cachedProfile, role: cachedProfile.role || 'USER' });
        setJustRegistered(false);
        await loadAccountsForUser(cachedProfile.id);
        setIsAuthenticated(true);
        setIsLoading(false);
        return { success: true };
      }

      // Se o BFF recusou o refresh token (401/expirado/revogado), limpa os tokens e exige senha
      await clearAuthTokens();
      setIsLoading(false);
      return {
        success: false,
        error: refreshRes.error || 'Sua sessão expirou. Entre novamente com usuário e senha.',
      };
    } catch {
      setIsLoading(false);
      return {
        success: false,
        error: 'Não foi possível validar a biometria. Utilize usuário e senha.',
      };
    }
  };

  /**
   * Conexao manual de conta OCI no BFF (POST /api/oci/accounts) — nunca persiste chave privada no celular
   */
  const linkCloudProvider = async (
    provider: SupportedCloud,
    credentials: Record<string, string>,
    enableBiometrics: boolean
  ): Promise<{ success: boolean; error?: string; permissionStatus?: string; hint?: string }> => {
    if (provider !== 'OCI') {
      return {
        success: false,
        error: `Integração com ${provider} estará disponível em breve (Sprint 3).`,
      };
    }

    const res = await apiClient.post<{
      success: boolean;
      account?: OciAccountSummary;
      permissionStatus?: string;
      hint?: string;
      error?: string;
    }>('/oci/accounts', {
      tenancyOcid: credentials.tenancyOcid || credentials.tenancyId || '',
      userOcid: credentials.userOcid || credentials.userId || '',
      fingerprint: credentials.fingerprint || '',
      region: credentials.region || 'sa-saopaulo-1',
      privateKeyPem: credentials.privateKeyPem || '',
      passphrase: credentials.passphrase || undefined,
    });

    // Zera qualquer referencia a chave privada no objeto recebido
    if (credentials.privateKeyPem) {
      credentials.privateKeyPem = '';
    }

    if (!res.ok || !res.data?.success) {
      return {
        success: false,
        error: res.error || 'Falha ao validar credenciais na Oracle Cloud.',
      };
    }

    let bioSuccess = false;
    if (enableBiometrics) {
      try {
        const auth = await Keychain.getGenericPassword({
          service: BIOMETRIC_GATE_SERVICE,
          authenticationPrompt: {
            title: `Ativar Biometria (${provider})`,
            subtitle: 'Proteção adicional no dispositivo',
            description: `Confirme sua digital para proteger o acesso à conta ${provider}`,
            cancel: 'Cancelar',
          },
        });
        bioSuccess = Boolean(auth && auth.username);
      } catch {
        bioSuccess = false;
      }
    }

    if (masterUser?.id) {
      await loadAccountsForUser(masterUser.id);
      if (bioSuccess) {
        await toggleBiometrics('OCI', true);
      }
    }

    return {
      success: true,
      permissionStatus: res.data.permissionStatus,
      hint: res.data.hint,
    };
  };

  /**
   * Ativa o modo de demonstracao Instance Principal para o OWNER_USERNAME
   */
  const activateOwnerDemoAccount = async (): Promise<{ success: boolean; error?: string }> => {
    const res = await apiClient.post<{ success: boolean; error?: string }>('/oci/accounts/demo', {});
    if (!res.ok || !res.data?.success) {
      return {
        success: false,
        error: res.error || 'Não foi possível ativar a conta da VM.',
      };
    }
    if (masterUser?.id) {
      await loadAccountsForUser(masterUser.id);
    }
    return { success: true };
  };

  /**
   * Alterna biometria local por provedor para o usuario autenticado
   */
  const toggleBiometrics = async (provider: SupportedCloud, enabled: boolean): Promise<boolean> => {
    if (!masterUser?.id) return false;
    try {
      if (enabled) {
        const auth = await Keychain.getGenericPassword({
          service: BIOMETRIC_GATE_SERVICE,
          authenticationPrompt: {
            title: `Ativar Biometria (${provider})`,
            subtitle: 'Autenticação segura',
            description: 'Confirme sua digital para ativar o bloqueio biométrico',
            cancel: 'Cancelar',
          },
        }).catch(() => false as const);
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
      await AsyncStorage.setItem(
        getCloudAccountsStorageKey(masterUser.id),
        JSON.stringify(updated)
      );
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Desconecta conta de nuvem no BFF (DELETE /api/oci/accounts/:id) e limpa estado local
   */
  const unlinkCloudProvider = async (
    provider: SupportedCloud,
    accountId?: string
  ): Promise<boolean> => {
    try {
      if (provider === 'OCI') {
        const targetId = accountId || cloudAccounts.OCI.id || activeOciAccountId;
        if (targetId) {
          const delRes = await apiClient.delete(`/oci/accounts/${encodeURIComponent(targetId)}`);
          if (!delRes.ok && !delRes.isNetworkError) {
            return false;
          }
        }
      }

      const updated: Record<SupportedCloud, CloudCredentialConfig> = {
        ...cloudAccounts,
        [provider]: createEmptyAccountsState()[provider],
      };

      setCloudAccounts(updated);
      if (provider === 'OCI') {
        setOciAccountsList((prev) =>
          accountId ? prev.filter((a) => a.id !== accountId) : []
        );
        setActiveOciAccountId(null);
      }

      if (masterUser?.id) {
        await AsyncStorage.setItem(
          getCloudAccountsStorageKey(masterUser.id),
          JSON.stringify(updated)
        );
      }

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
    } catch {
      return false;
    }
  };

  /**
   * Comuta o provedor ativo entre os provedores realmente conectados pelo usuario
   */
  const switchActiveProvider = async (provider: SupportedCloud): Promise<boolean> => {
    const targetConfig = cloudAccounts[provider];
    if (!targetConfig?.isConfigured) {
      return false;
    }

    if (activeProvider === provider) {
      return true;
    }

    const lastUnlocked = unlockedClouds[provider] || 0;
    const isWithinSessionWindow = Date.now() - lastUnlocked < BIOMETRIC_REAUTH_WINDOW_MS;

    if (targetConfig.biometricsEnabled && !isWithinSessionWindow) {
      try {
        const credentials = await Keychain.getGenericPassword({
          service: BIOMETRIC_GATE_SERVICE,
          authenticationPrompt: {
            title: `Acesso à Nuvem: ${provider}`,
            subtitle: 'Validação biométrica de segurança',
            description: `Confirme sua digital para acessar os dados de ${provider}`,
            cancel: 'Cancelar',
          },
        });

        if (!credentials || !credentials.username) {
          return false;
        }
        setUnlockedClouds((prev) => ({ ...prev, [provider]: Date.now() }));
      } catch {
        return false;
      }
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveProvider(provider);
    return true;
  };

  /**
   * Logout: revoga refresh token no BFF, apaga tokens do Keychain e limpa estado e caches do usuario
   */
  const logoutMaster = async (): Promise<void> => {
    const currentUserId = masterUser?.id;
    try {
      const tokens = await getAuthTokens();
      await apiService.logoutSession(tokens?.refreshToken);
    } catch {
      // ignora falha de rede ao deslogar
    } finally {
      await clearAuthTokens();
      await clearUserScopedLocalData(currentUserId);
      setAccessTokenState('');
      setJustRegistered(false);
      setIsAuthenticated(false);
    }
  };

  const logout = () => {
    logoutMaster();
  };

  // Sessao sem valores fabricados: role vem do BFF (padrao USER) e 2FA permanece false ate ser implementado
  const session: UserSession | null =
    isAuthenticated && masterUser
      ? {
          userId: masterUser.id,
          email: masterUser.email,
          name: masterUser.username,
          role: masterUser.role || 'USER',
          token: accessTokenState,
          refreshToken: '',
          twoFactorEnabled: false,
          twoFactorVerified: false,
          biometricEnabled: biometricAvailableOnDevice,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }
      : null;

  return (
    <AuthContext.Provider
      value={{
        masterUser,
        cloudAccounts,
        ociAccountsList,
        activeOciAccountId,
        setActiveOciAccountId,
        activeProvider,
        connectedProviders,
        hasConnectedClouds,
        justRegistered,
        clearJustRegistered: () => setJustRegistered(false),
        isOwnerUser,
        isAuthenticated,
        isLoading,
        session,
        registerMasterAccount,
        refreshCloudAccounts,
        linkCloudProvider,
        activateOwnerDemoAccount,
        toggleBiometrics,
        unlinkCloudProvider,
        switchActiveProvider,
        loginMaster,
        loginWithBiometrics,
        logoutMaster,
        logout,
        hasStoredCredentials: Boolean(masterUser),
        storedCredentials: null,
        selectedLoginProvider: activeProvider,
        setSelectedLoginProvider: (p: CloudProvider) => {
          switchActiveProvider(p);
        },
        verifyTwoFactorToken: async () => false,
        clearStoredCredentials: async () => {
          const uid = masterUser?.id;
          await clearAuthTokens();
          await Keychain.resetGenericPassword({ service: BIOMETRIC_GATE_SERVICE }).catch(() => {});
          await EncryptedStorage.clear().catch(() => {});
          await clearUserScopedLocalData(uid);
          setMasterUser(null);
          setAccessTokenState('');
          setJustRegistered(false);
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
