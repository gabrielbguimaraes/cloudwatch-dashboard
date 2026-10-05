import React from 'react';
import { VectorAssetRenderer } from './VectorAssetRenderer';

// Mapeamento dos arquivos oficiais SVG em src/assets/images/
import OciSvg from '../../assets/images/Oracle-Cloud-Logo-PNG-SVG_001.svg';
import AwsSvg from '../../assets/images/Amazon-Web-Services-Logo-SVG_001.svg';
import GcpSvg from '../../assets/images/Google_Cloud-Logo-7.svg';

const CLOUD_SVG_MAP: Record<'OCI' | 'AWS' | 'GCP', React.FC<any>> = {
  OCI: OciSvg,
  AWS: AwsSvg,
  GCP: GcpSvg,
};

export interface CloudLogoProps {
  provider: 'OCI' | 'AWS' | 'GCP';
  size?: number;
}

export const CloudLogo: React.FC<CloudLogoProps> = ({ provider, size = 32 }) => {
  const SvgComp = CLOUD_SVG_MAP[provider];

  return (
    <VectorAssetRenderer
      label={provider}
      size={size}
      renderSvg={() => {
        if (!SvgComp) return null;
        return <SvgComp width={size} height={size} />;
      }}
    />
  );
};

export default CloudLogo;
