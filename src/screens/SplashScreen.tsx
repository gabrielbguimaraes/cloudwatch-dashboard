import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { AppImage } from '../components/common/AppImage';

export const SplashScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Executa animacao continua via Animated.parallel (fade-in 0 -> 1 e scale 0.9 -> 1.0 durante 1200ms)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.0,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      try {
        const storedMaster = await EncryptedStorage.getItem('@master_user_profile');
        if (storedMaster) {
          navigation.replace('Login');
        } else {
          navigation.replace('Register');
        }
      } catch (err) {
        navigation.replace('Register');
      }
    });
  }, [navigation, opacity, scale]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrapper, { opacity, transform: [{ scale }] }]}>
        <AppImage
          source={require('../assets/logo.png')}
          fallbackLabel="CW"
          size={84}
          isCircular={false}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1318',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
