import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { OciLogo, AwsLogo, GcpLogo } from './AppIcons';

// Mapeamento dos arquivos oficiais PNG de alta resolucao em src/assets/images/
const CLOUD_PNG_MAP: Record<'OCI' | 'AWS' | 'GCP', any> = {
  OCI: require('../../assets/images/Oracle-Cloud-Emblem.png'),
  AWS: require('../../assets/images/Amazon-Web-Services-Logo.png'),
  GCP: require('../../assets/images/Google_Cloud_logo_PNG2.png'),
};

const CLOUD_FALLBACK_MAP: Record<'OCI' | 'AWS' | 'GCP', React.FC<{ size?: number }>> = {
  OCI: OciLogo,
  AWS: AwsLogo,
  GCP: GcpLogo,
};

export interface CloudLogoProps {
  provider: 'OCI' | 'AWS' | 'GCP';
  size?: number;
}

export const CloudLogo: React.FC<CloudLogoProps> = ({ provider, size = 32 }) => {
  const [hasError, setHasError] = useState(false);
  const pngSource = CLOUD_PNG_MAP[provider];
  const FallbackVector = CLOUD_FALLBACK_MAP[provider];

  if (!hasError && pngSource) {
    const borderRadius = Math.max(4, Math.round(size * 0.22));
    const innerSize = Math.round(size * 0.82);

    return (
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
      >
        <Image
          source={pngSource}
          style={{ width: innerSize, height: innerSize }}
          resizeMode="contain"
          onError={() => setHasError(true)}
        />
      </View>
    );
  }

  if (FallbackVector) {
    return <FallbackVector size={size} />;
  }

  return null;
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});

export default CloudLogo;
