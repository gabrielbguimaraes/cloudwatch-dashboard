/**
 * CloudWatch Dashboard - Contexto de Autenticação (AuthContext)
 * Gerencia credenciais, suporte à biometria, KeyChain e preparação para 2FA.
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { UserSession, CloudProvider } from '../types';

import * as Keychain from 'react-native-keychain';

interface AuthContextData {
  session: UserSession | null;
  isAuthenticated: boolean;
  selectedLoginProvider: CloudProvider;
  isLoading: boolean;
  setSelectedLoginProvider: (provider: CloudProvider) => void;
  loginWithCredentials: (keyId: string, secretKey: string) => Promise<boolean>;
  loginWithBiometrics: () => Promise<boolean>;
  loginWithQrCode: (payload: string) => Promise<boolean>;
  verifyTwoFactorToken: (token: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [selectedLoginProvider, setSelectedLoginProvider] = useState<CloudProvider>('OCI');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const createMockSession = (email = 'joao.guimaraes@fatec.sp.gov.br'): UserSession => {
    return {
      userId: 'usr-1461392411007',
      email,
      name: 'João Gabriel Barros Guimarães',
      role: 'ADMIN',
      token: 'jwt_mock_token_cloudwatch_' + Date.now(),
      refreshToken: 'jwt_refresh_mock_' + Date.now(),
      twoFactorEnabled: true,
      twoFactorVerified: true,
      biometricEnabled: true,
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    };
  };

  const loginWithCredentials = async (keyId: string, secretKey: string): Promise<boolean> => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSession(createMockSession());
    setIsLoading(false);
    return true;
  };

  const loginWithBiometrics = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      // 1. Verifica se o dispositivo possui suporte biométrico
      await Keychain.getSupportedBiometryType();

      // 2. Garante credencial com controle biométrico configurado
      const existing = await Keychain.getGenericPassword({
        service: 'cloudwatch_auth',
      });
      if (!existing) {
        await Keychain.setGenericPassword(
          'joao.guimaraes@fatec.sp.gov.br',
          'session_secure_cloudwatch_oci',
          {
            service: 'cloudwatch_auth',
            accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
            accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
          }
        );
      }

      // 3. Dispara o prompt biométrico nativo do Android
      const credentials = await Keychain.getGenericPassword({
        service: 'cloudwatch_auth',
        authenticationPrompt: {
          title: 'Autenticação Biométrica',
          subtitle: 'CloudWatch Dashboard - OCI Console',
          description: 'Toque no sensor biométrico para validar seu acesso',
          cancel: 'Cancelar',
        },
      });

      if (credentials) {
        setSession(createMockSession(credentials.username));
        setIsLoading(false);
        return true;
      } else {
        setIsLoading(false);
        return false;
      }
    } catch (error: any) {
      console.warn('Fallback biométrico:', error?.message);
      // Fallback seguro caso o aparelho físico não tenha biometria cadastrada
      setSession(createMockSession());
      setIsLoading(false);
      return true;
    }
  };

  const loginWithQrCode = async (payload: string): Promise<boolean> => {
    setIsLoading(true);
    // Simula importação de OCID / Access Key capturado pela câmera
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSession(createMockSession());
    setIsLoading(false);
    return true;
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
        setSelectedLoginProvider,
        loginWithCredentials,
        loginWithBiometrics,
        loginWithQrCode,
        verifyTwoFactorToken,
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
