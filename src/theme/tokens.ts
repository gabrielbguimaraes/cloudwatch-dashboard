// src/theme/tokens.ts

export interface BrandPalette {
  name: string;
  provider: 'OCI' | 'AWS' | 'GCP';
  primary: string;
  primaryLight: string;
  primaryDark: string;
  surfaceHeader: string;
  borderFocus: string;
  badgeBg: string;
  badgeText: string;
  defaultRegion: string;
}

export const CLOUD_PALETTES: Record<'OCI' | 'AWS' | 'GCP', BrandPalette> = {
  OCI: {
    name: 'Oracle Cloud Infrastructure',
    provider: 'OCI',
    primary: '#C74634', // Oracle Redwood Terracotta
    primaryLight: '#FDF2F0',
    primaryDark: '#8F2618',
    surfaceHeader: '#1A1514',
    borderFocus: '#C74634',
    badgeBg: '#2D1816',
    badgeText: '#F28B82',
    defaultRegion: 'sa-saopaulo-1',
  },
  AWS: {
    name: 'Amazon Web Services',
    provider: 'AWS',
    primary: '#FF9900', // AWS Amber
    primaryLight: '#FFF8EB',
    primaryDark: '#B26B00',
    surfaceHeader: '#1A1814',
    borderFocus: '#FF9900',
    badgeBg: '#2E2210',
    badgeText: '#FDD663',
    defaultRegion: 'us-east-1',
  },
  GCP: {
    name: 'Google Cloud Platform',
    provider: 'GCP',
    primary: '#1A73E8', // Google Blue
    primaryLight: '#E8F0FE',
    primaryDark: '#1557B0',
    surfaceHeader: '#141822',
    borderFocus: '#1A73E8',
    badgeBg: '#152438',
    badgeText: '#8AB4F8',
    defaultRegion: 'southamerica-east1',
  },
};

export const NEUTRAL_THEME = {
  background: '#0F1318',
  surfaceCard: '#181C22',
  surfaceElevated: '#20242C',
  borderDefault: '#282E38',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#E8EAED',
  textSecondary: '#9AA0A6',
  textTertiary: '#5F6368',
  statusRunning: { text: '#81C995', bg: '#132B1D', border: '#1E462E' },
  statusDegraded: { text: '#FDD663', bg: '#2E230B', border: '#4D3A12' },
  statusStopped: { text: '#F28B82', bg: '#2D1515', border: '#4D1F1F' },
};
