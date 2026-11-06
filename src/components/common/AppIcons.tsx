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

/**
 * Icone de Impressao Digital (Biometria)
 */
export const FingerprintIcon: React.FC<IconProps> = ({ size = 18, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 10C10.9 10 10 10.9 10 12C10 14.8 9.2 17.4 7.8 19.6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <Path
      d="M14 12C14 15.3 13 18.4 11.3 21"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <Path
      d="M6.2 15.5C6.7 14.4 7 13.2 7 12C7 9.2 9.2 7 12 7C14.8 7 17 9.2 17 12C17 14.2 16.5 16.3 15.6 18.2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <Path
      d="M4.5 10C5.4 6.5 8.4 4 12 4C15.6 4 18.6 6.5 19.5 10"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Icone de Relatorio / Exportacao PDF
 */
export const FileReportIcon: React.FC<IconProps> = ({ size = 15, color = '#93C5FD' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M14 2V8H20"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8 13H16M8 17H13"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Icone de Sobreposicao de Curvas (CPU + Memoria)
 */
export const ChartOverlayIcon: React.FC<IconProps> = ({ size = 14, color = '#9AA0A6' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 17L9 11L13 15L21 7"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M3 21L9 16L14 19L21 13"
      stroke={color}
      strokeWidth="1.8"
      strokeDasharray="3 3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Icone de Terminal / Console SSH
 */
export const TerminalIcon: React.FC<IconProps> = ({ size = 18, color = '#38BDF8' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="2.5"
      y="4"
      width="19"
      height="16"
      rx="3"
      stroke={color}
      strokeWidth="2"
    />
    <Path
      d="M7 9L10.5 12L7 15"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12.5 15H17"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Icone de Fixar / Destaque no Topo
 */
export const PinIcon: React.FC<IconProps> = ({ size = 16, color = '#93C5FD', focused }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M16 3L21 8L19 10L16.5 9.5L13 13L13.5 17.5L11.5 19.5L8 16L3.5 20.5L3.5 20.5M8 16L4.5 12.5L6.5 10.5L11 11L14.5 7.5L14 5L16 3Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? color : 'none'}
      fillOpacity={focused ? 0.3 : 0}
    />
  </Svg>
);

/**
 * Icone de Reiniciar / Refresh (Docker Restart)
 */
export const RefreshCwIcon: React.FC<IconProps> = ({ size = 14, color = '#4ADE80' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 4V10H15"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M20.49 15A9 9 0 1 1 18.36 5.64L21 10"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Icone de Copiar para Area de Transferencia
 */
export const CopyIcon: React.FC<IconProps> = ({ size = 14, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="9"
      y="9"
      width="13"
      height="13"
      rx="2"
      stroke={color}
      strokeWidth="2"
    />
    <Path
      d="M5 15H4C2.9 15 2 14.1 2 13V4C2 2.9 2.9 2 4 2H13C14.1 2 15 2.9 15 4V5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Icone de Enviar por E-mail
 */
export const MailSendIcon: React.FC<IconProps> = ({ size = 14, color = '#E8EAED' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="2"
      y="4"
      width="20"
      height="16"
      rx="2.5"
      stroke={color}
      strokeWidth="2"
    />
    <Path
      d="M22 6.5L12 13L2 6.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Icone de Compartilhar Nativo
 */
export const ShareIcon: React.FC<IconProps> = ({ size = 14, color = '#E8EAED' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth="2" />
    <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth="2" />
    <Circle cx="18" cy="19" r="3" stroke={color} strokeWidth="2" />
    <Path
      d="M8.6 13.5L15.4 17.5M15.4 6.5L8.6 10.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Icone de Ampliar Imagem (Lupa / Zoom)
 */
export const ZoomInIcon: React.FC<IconProps> = ({ size = 13, color = '#93C5FD' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
    <Path
      d="M21 21L16.35 16.35M11 8V14M8 11H14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Icone de Menu de Tres Pontos Horizontais
 */
export const MoreHorizontalIcon: React.FC<IconProps> = ({ size = 16, color = '#9AA0A6' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="5" cy="12" r="1.8" fill={color} />
    <Circle cx="12" cy="12" r="1.8" fill={color} />
    <Circle cx="19" cy="12" r="1.8" fill={color} />
  </Svg>
);

