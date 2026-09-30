// src/types/auth.ts

export type SupportedCloud = 'OCI' | 'AWS' | 'GCP';

export interface MasterProfile {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface CloudCredentialConfig {
  provider: SupportedCloud;
  isConfigured: boolean;
  biometricsEnabled: boolean; // Flag individual de biometria para este provedor
  accountIdentifier: string; // Tenancy OCID (OCI), Account ID (AWS), Project ID (GCP)
  region: string; // sa-saopaulo-1, us-east-1, southamerica-east1
  credentials: Record<string, string>; // Chaves seguras armazenadas no EncryptedStorage
  lastSyncedAt?: string;
}

export interface UserSessionState {
  masterUser: MasterProfile | null;
  isAuthenticated: boolean;
  activeProvider: SupportedCloud;
  cloudAccounts: Record<SupportedCloud, CloudCredentialConfig>;
}
