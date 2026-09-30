import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ImageSourcePropType, Platform } from 'react-native';

interface AppImageProps {
  source: ImageSourcePropType;
  fallbackLabel: string;
  size?: number;
  isCircular?: boolean;
}

export const AppImage: React.FC<AppImageProps> = ({
  source,
  fallbackLabel,
  size = 40,
  isCircular = false,
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <View
        style={[
          styles.fallbackBox,
          {
            width: size,
            height: size,
            borderRadius: isCircular ? size / 2 : 8,
          },
        ]}
      >
        <Text style={[styles.fallbackLabel, { fontSize: Math.max(10, size * 0.32) }]}>
          {fallbackLabel.substring(0, 3).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={{
        width: size,
        height: size,
        borderRadius: isCircular ? size / 2 : 8,
      }}
      onError={() => setHasError(true)}
    />
  );
};

const styles = StyleSheet.create({
  fallbackBox: {
    backgroundColor: '#20242C',
    borderColor: '#3C4043',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLabel: {
    color: '#9AA0A6',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
