import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  ImageSourcePropType,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface VectorAssetRendererProps {
  label: string;
  size?: number;
  width?: number;
  height?: number;
  source?: ImageSourcePropType;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tintColor?: string;
}

export const VectorAssetRenderer: React.FC<VectorAssetRendererProps> = ({
  label,
  size = 32,
  width,
  height,
  source,
  containerStyle,
  textStyle,
  tintColor,
}) => {
  const [hasError, setHasError] = useState(false);
  const finalWidth = width || size;
  const finalHeight = height || size;

  if (hasError || !source) {
    return (
      <View
        style={[
          styles.safeBox,
          {
            width: finalWidth,
            height: finalHeight,
            borderRadius: Math.min(finalWidth, finalHeight) / 4,
          },
          containerStyle,
        ]}
      >
        <Text
          style={[
            styles.safeText,
            { fontSize: Math.max(8, Math.min(finalWidth, finalHeight) * 0.3) },
            textStyle,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[
        {
          width: finalWidth,
          height: finalHeight,
          resizeMode: 'contain',
        },
        tintColor ? { tintColor } : undefined,
      ]}
      onError={() => setHasError(true)}
    />
  );
};

const styles = StyleSheet.create({
  safeBox: {
    backgroundColor: '#282E38',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeText: {
    color: '#E8EAED',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
});

export default VectorAssetRenderer;
