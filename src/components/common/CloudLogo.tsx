import React from 'react';
import { ImageSourcePropType } from 'react-native';
import { VectorAssetRenderer } from './VectorAssetRenderer';

// Mapeamento dos arquivos oficiais SVG em src/assets/images/
const CLOUD_ASSETS: Record<'OCI' | 'AWS' | 'GCP', ImageSourcePropType> = {
  OCI: require('../../assets/images/Oracle-Cloud-Logo-PNG-SVG_001.svg'),
  AWS: require('../../assets/images/Amazon-Web-Services-Logo-SVG_001.svg'),
  GCP: require('../../assets/images/Google_Cloud-Logo-7.svg'),
};

export interface CloudLogoProps {
  provider: 'OCI' | 'AWS' | 'GCP';
  size?: number;
}

export const CloudLogo: React.FC<CloudLogoProps> = ({ provider, size = 32 }) => {
  return (
    <VectorAssetRenderer
      label={provider}
      size={size}
      source={CLOUD_ASSETS[provider]}
    />
  );
};

export default CloudLogo;
