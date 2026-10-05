import React, { Component, ReactNode } from 'react';
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

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class SafeAssetErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('VectorAssetRenderer render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export interface VectorAssetRendererProps {
  label: string;
  size?: number;
  width?: number;
  height?: number;
  source?: ImageSourcePropType;
  renderSvg?: () => ReactNode;
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
  renderSvg,
  containerStyle,
  textStyle,
  tintColor,
}) => {
  const finalWidth = width || size;
  const finalHeight = height || size;

  const fallback = (
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

  if (renderSvg) {
    return (
      <SafeAssetErrorBoundary fallback={fallback}>
        <View
          style={[
            {
              width: finalWidth,
              height: finalHeight,
              alignItems: 'center',
              justifyContent: 'center',
            },
            containerStyle,
          ]}
        >
          {renderSvg()}
        </View>
      </SafeAssetErrorBoundary>
    );
  }

  if (source) {
    return (
      <SafeAssetErrorBoundary fallback={fallback}>
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
        />
      </SafeAssetErrorBoundary>
    );
  }

  return fallback;
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
