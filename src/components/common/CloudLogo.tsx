import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ImageSourcePropType, Platform } from 'react-native';

interface CloudLogoProps {
  provider: 'OCI' | 'AWS' | 'GCP';
  size?: number;
}

const LOCAL_ASSETS: Record<string, ImageSourcePropType> = {
  OCI: require('../../assets/oci.png'),
  AWS: require('../../assets/aws.png'),
  GCP: require('../../assets/gcp.png'),
};

export const CloudLogo: React.FC<CloudLogoProps> = ({ provider, size = 32 }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !LOCAL_ASSETS[provider]) {
    return (
      <View
        style={[
          styles.fallbackContainer,
          { width: size, height: size, borderRadius: size / 4 },
        ]}
      >
        <Text style={[styles.fallbackText, { fontSize: Math.max(9, size * 0.3) }]}>
          {provider}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={LOCAL_ASSETS[provider]}
      style={{ width: size, height: size, resizeMode: 'contain' }}
      onError={() => setHasError(true)}
    />
  );
};

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#282E38',
    borderColor: '#3C4043',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#E8EAED',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
