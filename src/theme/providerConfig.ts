import { CloudProvider } from '../types';

export interface ProviderThemeConfig {
  id: CloudProvider;
  name: string;
  fullName: string;
  primaryColor: string;
  primaryBg: string;
  borderColor: string;
  defaultRegion: string;
  regionLabel: string;
  accentColor: string;
}

export const providerConfigs: Record<CloudProvider, ProviderThemeConfig> = {
  OCI: {
    id: 'OCI',
    name: 'OCI',
    fullName: 'Oracle Cloud (OCI)',
    primaryColor: '#C74634', // Redwood
    primaryBg: '#7F1D1D20',
    borderColor: '#C7463450',
    defaultRegion: 'sa-saopaulo-1',
    regionLabel: 'São Paulo (sa-saopaulo-1)',
    accentColor: '#F87171',
  },
  AWS: {
    id: 'AWS',
    name: 'AWS',
    fullName: 'Amazon Web Services (AWS)',
    primaryColor: '#FF9900', // AWS Amber
    primaryBg: '#78350F20',
    borderColor: '#FF990050',
    defaultRegion: 'us-east-1',
    regionLabel: 'N. Virginia (us-east-1)',
    accentColor: '#FBBF24',
  },
  GCP: {
    id: 'GCP',
    name: 'GCP',
    fullName: 'Google Cloud Platform (GCP)',
    primaryColor: '#4285F4', // Google Blue
    primaryBg: '#1E3A8A20',
    borderColor: '#4285F450',
    defaultRegion: 'southamerica-east1',
    regionLabel: 'São Paulo (southamerica-east1)',
    accentColor: '#60A5FA',
  },
};

export const getProviderTheme = (provider: CloudProvider): ProviderThemeConfig => {
  return providerConfigs[provider] || providerConfigs.OCI;
};
