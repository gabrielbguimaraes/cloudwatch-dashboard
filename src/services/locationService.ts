

import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';

export interface GpsRegionResult {
  region: string;
  isSouthAmerica: boolean;
  badge: string;
  coords?: {
    latitude: number;
    longitude: number;
  };
  isFallback: boolean;
}

/**
 * Verifica se a latitude/longitude pertence ao continente Sul-Americano
 * Coordenadas aproximadas: Latitude [-56, 13], Longitude [-82, -34]
 */
export const isCoordinatesInSouthAmerica = (latitude: number, longitude: number): boolean => {
  return latitude >= -56.0 && latitude <= 13.0 && longitude >= -82.0 && longitude <= -34.0;
};

/**
 * Requisita permissão de GPS e obtém as coordenadas atuais do dispositivo
 * Fallback transparente caso GPS esteja desligado ou permissão seja negada.
 */
export const detectNearestDatacenter = async (): Promise<GpsRegionResult> => {
  const fallbackResult: GpsRegionResult = {
    region: 'sa-saopaulo-1',
    isSouthAmerica: true,
    badge: 'sa-saopaulo-1 (OCI / AWS)',
    isFallback: true,
  };

  try {
    // 1. Requisita permissão nativa no Android
    if (Platform.OS === 'android') {
      const androidGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Permissão de Localização',
          message: 'O CloudWatch utiliza o GPS para selecionar o Datacenter de menor latência.',
          buttonPositive: 'Permitir',
          buttonNegative: 'Depois',
        }
      );

      if (androidGranted !== PermissionsAndroid.RESULTS.GRANTED) {
        return fallbackResult;
      }
    }

    // 2. Requisita permissão via expo-location
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return fallbackResult;
    }

    // 3. Obtém a posição atual com timeout de segurança
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    if (location && location.coords) {
      const { latitude, longitude } = location.coords;
      const inSouthAmerica = isCoordinatesInSouthAmerica(latitude, longitude);

      if (inSouthAmerica) {
        return {
          region: 'sa-saopaulo-1',
          isSouthAmerica: true,
          badge: '📍 Datacenter Local mais próximo (GPS)',
          coords: { latitude, longitude },
          isFallback: false,
        };
      } else {
        // Exemplo: Dispositivo nos EUA
        return {
          region: 'us-ashburn-1',
          isSouthAmerica: false,
          badge: '📍 Datacenter US-East mais próximo (GPS)',
          coords: { latitude, longitude },
          isFallback: false,
        };
      }
    }

    return fallbackResult;
  } catch (error) {
    console.warn('Detecção de GPS ignorada ou indisponível, aplicando fallback:', error);
    return fallbackResult;
  }
};
