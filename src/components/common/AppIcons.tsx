import React from 'react';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  focused?: boolean;
}

/**
 * Logo Oficial Vetorial OCI (Oracle Cloud Infrastructure)
 * Emblema em Vermelho Oracle (#F80000 / #C74634)
 */
export const OciLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    {/* Fundo escuro sutil com cantos arredondados */}
    <Rect width="32" height="32" rx="8" fill="#1C1315" />
    {/* Contorno / Silhueta Cloud OCI */}
    <Path
      d="M10 8H22C26.4 8 30 11.1 30 15C30 18.9 26.4 22 22 22H10C5.6 22 2 18.9 2 15C2 11.1 5.6 8 10 8ZM10 12C7.8 12 6 13.3 6 15C6 16.7 7.8 18 10 18H22C24.2 18 26 16.7 26 15C26 13.3 24.2 12 22 12H10Z"
      fill="#F80000"
      fillRule="evenodd"
    />
    {/* Barra de Base OCI */}
    <Rect x="7" y="24" width="18" height="2" rx="1" fill="#C74634" />
  </Svg>
);

/**
 * Logo Oficial Vetorial AWS (Amazon Web Services)
 * Tipografia AWS + Sorriso Curvado Laranja (#FF9900)
 */
export const AwsLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Rect width="32" height="32" rx="8" fill="#141820" />
    <G fill="#FFFFFF">
      {/* A */}
      <Path d="M6 16.5L8.2 10.2C8.3 9.9 8.6 9.7 9 9.7C9.4 9.7 9.7 9.9 9.8 10.2L12 16.5C12.1 16.8 11.9 17.2 11.5 17.2C11.2 17.2 11 17 10.9 16.8L10.4 15.3H7.6L7.1 16.8C7 17 6.8 17.2 6.5 17.2C6.1 17.2 5.9 16.8 6 16.5ZM8 13.9H10L9 11.2L8 13.9Z" />
      {/* W */}
      <Path d="M13.2 10.3C13.3 10 13.6 9.8 13.9 9.8C14.3 9.8 14.6 10.1 14.7 10.5L15.9 15.2L17.1 10.5C17.2 10.1 17.5 9.8 17.9 9.8C18.3 9.8 18.6 10.1 18.7 10.5L19.9 15.2L21.1 10.5C21.2 10.1 21.5 9.8 21.9 9.8C22.2 9.8 22.5 10 22.6 10.3L21.1 16.7C21 17.1 20.7 17.3 20.3 17.3C19.9 17.3 19.6 17 19.5 16.6L18.3 11.8L17.1 16.6C17 17 16.7 17.3 16.3 17.3C15.9 17.3 15.6 17.1 15.5 16.7L13.2 10.3Z" />
      {/* S */}
      <Path d="M23.8 15.5C24.1 15.7 24.6 15.9 25.2 15.9C26 15.9 26.4 15.6 26.4 15.1C26.4 14.6 26.1 14.4 25.4 14.1C24.3 13.7 23.6 13.2 23.6 12.2C23.6 11 24.6 10 26 10C26.7 10 27.3 10.2 27.6 10.4C27.9 10.6 28 10.9 27.9 11.2C27.8 11.5 27.5 11.7 27.2 11.5C26.9 11.3 26.5 11.2 26 11.2C25.3 11.2 24.9 11.5 24.9 11.9C24.9 12.4 25.3 12.6 26 12.9C27.1 13.3 27.8 13.8 27.8 14.8C27.8 16.1 26.8 17.1 25.2 17.1C24.4 17.1 23.7 16.9 23.3 16.6C23 16.4 22.9 16.1 23.1 15.8C23.2 15.5 23.5 15.4 23.8 15.5Z" />
    </G>
    {/* Sorriso Laranja AWS */}
    <Path
      d="M7 20C11.5 23.2 19.5 23.2 24 20"
      stroke="#FF9900"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <Path
      d="M23.2 18.8L25.5 20.2L23.8 22.2"
      stroke="#FF9900"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Logo Oficial Vetorial GCP (Google Cloud Platform)
 * Nuvem Quatro Cores Google (#4285F4, #EA4335, #FBBC04, #34A853)
 */
export const GcpLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Rect width="32" height="32" rx="8" fill="#131722" />
    {/* Lobe Superior Azul */}
    <Path
      d="M19.5 9C16.8 9 14.5 10.7 13.6 13.1C12.8 12.7 11.9 12.5 11 12.5C8.2 12.5 6 14.7 6 17.5C6 18.1 6.1 18.6 6.3 19.1"
      stroke="#4285F4"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* Lobe Esquerdo Vermelho */}
    <Path
      d="M6.3 19.1C5.5 19.8 5 20.8 5 22C5 23.9 6.6 25.5 8.5 25.5H11"
      stroke="#EA4335"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* Base Amarela */}
    <Path
      d="M11 25.5H21C23.5 25.5 25.5 23.5 25.5 21"
      stroke="#FBBC04"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* Lobe Direito Verde */}
    <Path
      d="M25.5 21C25.5 18.7 23.8 16.8 21.6 16.5C21.8 16 22 15.5 22 15C22 11.7 19.3 9 16 9"
      stroke="#34A853"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <Circle cx="16" cy="17" r="2.2" fill="#4285F4" />
  </Svg>
);

/**
 * Icone de Painel / Dashboard (4 Blocos / Telemetria MD3)
 */
export const DashboardIcon: React.FC<IconProps> = ({ size = 20, color = '#8AB4F8' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="7.5" height="7.5" rx="2" fill={color} />
    <Rect x="13.5" y="3" width="7.5" height="5" rx="2" fill={color} opacity={0.7} />
    <Rect x="13.5" y="10.5" width="7.5" height="10.5" rx="2" fill={color} />
    <Rect x="3" y="13" width="7.5" height="8" rx="2" fill={color} opacity={0.7} />
  </Svg>
);

/**
 * Icone de Metricas / Analytics
 */
export const MetricsIcon: React.FC<IconProps> = ({ size = 20, color = '#8AB4F8' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 3V21H21"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M7 16L12 11L16 15L21 8"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="21" cy="8" r="1.5" fill={color} />
  </Svg>
);

/**
 * Icone de Governanca / Seguranca / Configuracoes
 */
export const GovernanceIcon: React.FC<IconProps> = ({ size = 20, color = '#8AB4F8', focused }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2L4 5V11C4 16.5 7.4 21.6 12 22.8C16.6 21.6 20 16.5 20 11V5L12 2Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? color : 'none'}
      fillOpacity={0.25}
    />
    <Path
      d="M9 12L11 14L15 10"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Icone de Editar / Lapis
 */
export const EditIcon: React.FC<IconProps> = ({ size = 18, color = '#FDD663' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z"
      fill={color}
    />
  </Svg>
);

/**
 * Icone de Excluir / Lixeira
 */
export const TrashIcon: React.FC<IconProps> = ({ size = 18, color = '#F28B82' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z"
      fill={color}
    />
  </Svg>
);

/**
 * Icone de Power / Reiniciar
 */
export const PowerIcon: React.FC<IconProps> = ({ size = 18, color = '#8AB4F8' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2V12"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <Path
      d="M18.36 5.64A9 9 0 1 1 5.64 5.64"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </Svg>
);
