import { Platform } from 'react-native';
export * from './providerConfig';
export * from './tokens';

export const colors = {
  // Backdrop Geral (Fundo neutro escuro com 2% de matiz azul-aço; sem preto puro)
  background: '#0F1318',

  // Superfícies Corporativas M3 (Surface 1 para Cards, Surface 2 para Cabeçalho Curvo)
  surface1: '#181C22',
  surfaceCard: '#181C22',
  surfaceCardHover: '#1E232B',
  surface2: '#1F242C',
  surfaceHeader: '#1F242C',
  surfaceBase: '#12161D',

  // Contornos Sóbrios (1px em #282E38 ou rgba(255, 255, 255, 0.08), sem glow neon)
  surfaceBorder: '#282E38',
  surfaceBorderSubtle: 'rgba(255, 255, 255, 0.08)',
  surfaceBorderGlow: '#282E38',

  // Acentos Corporativos
  primaryBlue: '#38BDF8',
  accentBlue: '#2563EB',
  neonBlue: '#38BDF8',
  neonCyan: '#38BDF8',
  neonElectric: '#38BDF8',

  // Theming Provedores (OCI Redwood, AWS Amber, GCP Blue)
  oci: {
    primary: '#C74634',
    badgeBg: '#7F1D1D20',
    badgeBorder: '#C7463450',
    badgeText: '#F87171',
  },
  aws: {
    primary: '#FF9900',
    badgeBg: '#78350F20',
    badgeBorder: '#FF990050',
    badgeText: '#FBBF24',
  },
  gcp: {
    primary: '#4285F4',
    badgeBg: '#1E3A8A20',
    badgeBorder: '#4285F450',
    badgeText: '#60A5FA',
  },

  // Semáforo Sóbrio (Padrão Google Cloud Monitoring)
  status: {
    healthy: '#81C995',
    healthyBg: '#132B1D',
    healthyBorder: '#1E462E',
    warning: '#FDD663',
    warningBg: '#2E230B',
    warningBorder: '#4D3A12',
    danger: '#F28B82',
    critical: '#F28B82',
    dangerBg: '#2D1515',
    criticalBg: '#2D1515',
    dangerBorder: '#4D1F1F',
    criticalBorder: '#4D1F1F',
    rebooting: '#38BDF8',
    rebootingBg: '#0C1B33',
    rebootingBorder: '#38BDF8',
  },

  // Tipografia
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textCyan: '#38BDF8',
  textGreen: '#81C995',
  textAmber: '#FDD663',
  textRed: '#F28B82',
  provider: {
    oci: '#C74634',
    aws: '#FF9900',
    gcp: '#4285F4',
  },
};

export const typography = {
  fontFamilyRegular: Platform.OS === 'ios' ? 'System' : 'normal',
  fontFamilyMono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};

export const fonts = {
  regular: Platform.OS === 'ios' ? 'System' : 'normal',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};
