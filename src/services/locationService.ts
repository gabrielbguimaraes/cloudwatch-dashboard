/**
 * CloudWatch Dashboard - Serviço de Detecção de Região e Localização
 * Implementação 100% resiliente e à prova de falhas:
 * - Utiliza Timezone do dispositivo e resolução de GeoIP com timeout rápido
 * - Não depende de módulos nativos não linkados (elimina o crash do ExpoLocation)
 * - Garante que o aplicativo nunca feche inesperadamente após o login.
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

export interface GpsRegionResult {
  region: string;
  isSouthAmerica: boolean;
  badge: string;
  coords?: {
    latitude: number;
    longitude: number;
  };
  city?: string;
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
 * Requisita localização de forma segura e seleciona o Datacenter de menor latência
 * Nunca lança exceção não tratada.
 */
export const detectNearestDatacenter = async (): Promise<GpsRegionResult> => {
  const fallbackResult: GpsRegionResult = {
    region: 'sa-saopaulo-1',
    isSouthAmerica: true,
    badge: '📍 sa-saopaulo-1 (Local GPS)',
    isFallback: true,
  };

  try {
    // 1. Inspeciona o Timezone do dispositivo (Rápido, síncrono e nativo ao motor JS)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const isSouthAmericaTz =
      timeZone.includes('Sao_Paulo') ||
      timeZone.includes('Buenos_Aires') ||
      timeZone.includes('Santiago') ||
      timeZone.includes('Bogota') ||
      timeZone.includes('Lima') ||
      timeZone.includes('Montevideo') ||
      timeZone.includes('America/Fortaleza') ||
      timeZone.includes('America/Recife') ||
      timeZone.includes('America/Bahia') ||
      timeZone.includes('America/Manaus') ||
      timeZone.includes('America/Cuiaba') ||
      timeZone.includes('America/Belem') ||
      timeZone.includes('America/Campo_Grande') ||
      timeZone.includes('America/Maceio') ||
      timeZone.includes('America/Araguaina') ||
      timeZone.includes('America/Porto_Velho') ||
      timeZone.includes('America/Boa_Vista') ||
      timeZone.includes('America/Rio_Branco');

    // 2. Tenta obter coordenadas e cidade via GeoIP ultrarrápido (timeout 1.5s)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      const response = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        const lat = typeof data.latitude === 'number' ? data.latitude : parseFloat(data.latitude);
        const lon = typeof data.longitude === 'number' ? data.longitude : parseFloat(data.longitude);
        const city = data.city || data.region || '';

        const inSouthAmerica = !isNaN(lat) && !isNaN(lon)
          ? isCoordinatesInSouthAmerica(lat, lon)
          : isSouthAmericaTz;

        if (inSouthAmerica) {
          return {
            region: 'sa-saopaulo-1',
            isSouthAmerica: true,
            badge: city ? `📍 sa-saopaulo-1 (${city})` : '📍 sa-saopaulo-1 (Brasil / GPS)',
            coords: !isNaN(lat) && !isNaN(lon) ? { latitude: lat, longitude: lon } : undefined,
            city,
            isFallback: false,
          };
        } else {
          return {
            region: 'us-ashburn-1',
            isSouthAmerica: false,
            badge: city ? `📍 us-ashburn-1 (${city})` : '📍 us-ashburn-1 (US-East / GPS)',
            coords: !isNaN(lat) && !isNaN(lon) ? { latitude: lat, longitude: lon } : undefined,
            city,
            isFallback: false,
          };
        }
      }
    } catch {
      // Falha de rede ou timeout: prossegue suavemente para a inferência por Timezone
    }

    // 3. Fallback inteligente baseado no Timezone do dispositivo
    if (isSouthAmericaTz) {
      return {
        region: 'sa-saopaulo-1',
        isSouthAmerica: true,
        badge: '📍 sa-saopaulo-1 (Local GPS)',
        isFallback: false,
      };
    } else if (timeZone) {
      return {
        region: 'us-ashburn-1',
        isSouthAmerica: false,
        badge: '📍 us-ashburn-1 (Global)',
        isFallback: false,
      };
    }

    return fallbackResult;
  } catch (error) {
    console.warn('Detecção de região protegida, utilizando fallback:', error);
    return fallbackResult;
  }
};
