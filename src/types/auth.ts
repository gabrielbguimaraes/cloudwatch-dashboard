// src/types/auth.ts

export type SupportedCloud = 'OCI' | 'AWS' | 'GCP';

export type UserRole = 'USER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface MasterProfile {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface CloudCredentialConfig {
  id?: string;
  provider: SupportedCloud;
  isConfigured: boolean;
  biometricsEnabled: boolean;
  accountIdentifier: string;
  tenancyName?: string;
  region: string;
  subscribedRegions?: string[];
  permissionStatus?: 'OK' | 'NO_PERMISSION' | 'UNKNOWN';
  authMode?: 'USER_API_KEY' | 'INSTANCE_PRINCIPAL';
  credentials: Record<string, string>;
  lastSyncedAt?: string;
}

export interface UserSessionState {
  masterUser: MasterProfile | null;
  isAuthenticated: boolean;
  activeProvider: SupportedCloud;
  cloudAccounts: Record<SupportedCloud, CloudCredentialConfig>;
}
