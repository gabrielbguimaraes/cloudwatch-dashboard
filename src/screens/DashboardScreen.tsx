/**
 * CloudWatch Dashboard - Tela Principal (DashboardScreen)
 * Foco Primário: Oracle Cloud Infrastructure (OCI) + AWS & GCP
 * Semáforo de Saúde: Verde (Operacional), Amarelo (Atenção), Vermelho (Crítico)
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { colors } from '../theme';
import { useCloud } from '../context/CloudContext';
import { useAuth } from '../context/AuthContext';
import type { CloudResource, CloudProvider } from '../types';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    filteredResources,
    selectedProvider,
    setProviderFilter,
    kpis,
    timeRange,
    setTimeRange,
    setSelectedResource,
    refreshMetrics,
    isLoading,
    lastUpdated,
  } = useCloud();

  const { logout } = useAuth();

  const handleResourcePress = (resource: CloudResource) => {
    setSelectedResource(resource);
    navigation.navigate('MetricsDetail', { resourceId: resource.id });
  };

  const handleLogout = () => {
    logout();
    navigation.replace('Login');
  };

  const getStatusColor = (status: CloudResource['status']) => {
    if (status === 'CRITICAL') return colors.status.danger;
    if (status === 'WARNING') return colors.status.warning;
    return colors.status.healthy;
  };

  const getProviderBadge = (provider: CloudProvider) => {
    if (provider === 'OCI') {
      return {
        name: 'ORACLE OCI',
        bg: colors.oci.badgeBg,
        text: colors.oci.badgeText,
        border: colors.oci.badgeBorder,
      };
    }
    if (provider === 'AWS') {
      return {
        name: 'AWS',
        bg: colors.aws.badgeBg,
        text: colors.aws.badgeText,
        border: colors.aws.badgeBorder,
      };
    }
    return {
      name: 'GOOGLE CLOUD',
      bg: colors.gcp.badgeBg,
      text: colors.gcp.badgeText,
      border: colors.gcp.badgeBorder,
    };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshMetrics}
            tintColor={colors.neonCyan}
          />
        }
      >
        {/* Topo Curvo Tecnológico */}
        <View style={styles.headerCurved}>
          <View style={styles.headerTopRow}>
            <View style={styles.regionBadge}>
              <View style={styles.activePulseDot} />
              <Text style={styles.regionBadgeText}>sa-saopaulo-1 (OCI / AWS)</Text>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.uptimeRow}>
            <View>
              <Text style={styles.uptimeLabel}>SLA MÉDIO DE UPTIME</Text>
              <View style={styles.uptimeValRow}>
                <Text style={styles.uptimeValue}>{kpis.uptimeSla}%</Text>
                <Text style={styles.uptimeDelta}>▲ +0.02%</Text>
              </View>
              <Text style={styles.uptimeSub}>Semáforo de Saúde Global Ativo</Text>
            </View>

            <TouchableOpacity
              style={styles.fakerRefreshBtn}
              onPress={refreshMetrics}
              activeOpacity={0.8}
            >
              <Text style={styles.fakerIcon}>🔄</Text>
              <Text style={styles.fakerText}>FAKER</Text>
            </TouchableOpacity>
          </View>

          {/* Seletor de Período */}
          <View style={styles.timeRangeSelector}>
            {(['1h', '6h', '24h', '7d', '30d'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangeBtn,
                  timeRange === range && styles.timeRangeBtnActive,
                ]}
                onPress={() => setTimeRange(range)}
              >
                <Text
                  style={[
                    styles.timeRangeText,
                    timeRange === range && styles.timeRangeTextActive,
                  ]}
                >
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Filtro por Provedor */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterPill, selectedProvider === 'ALL' && styles.filterPillActive]}
              onPress={() => setProviderFilter('ALL')}
            >
              <Text style={[styles.filterPillText, selectedProvider === 'ALL' && styles.filterPillTextActive]}>
                Todos ({kpis.total})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, selectedProvider === 'OCI' && styles.filterPillOciActive]}
              onPress={() => setProviderFilter('OCI')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[styles.filterPillText, selectedProvider === 'OCI' && styles.filterPillTextActive]}>
                Oracle OCI
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, selectedProvider === 'AWS' && styles.filterPillAwsActive]}
              onPress={() => setProviderFilter('AWS')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.filterPillText, selectedProvider === 'AWS' && styles.filterPillTextActive]}>
                AWS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, selectedProvider === 'GCP' && styles.filterPillGcpActive]}
              onPress={() => setProviderFilter('GCP')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={[styles.filterPillText, selectedProvider === 'GCP' && styles.filterPillTextActive]}>
                GCP
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* KPIs de Topo */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL</Text>
            <Text style={styles.kpiValue}>{kpis.total}</Text>
            <Text style={styles.kpiSub}>Recursos</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: colors.status.healthyBorder }]}>
            <Text style={[styles.kpiLabel, { color: colors.status.healthy }]}>NORMAL</Text>
            <Text style={[styles.kpiValue, { color: colors.status.healthy }]}>{kpis.healthy}</Text>
            <Text style={styles.kpiSub}>Operacional</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: colors.status.dangerBorder }]}>
            <Text style={[styles.kpiLabel, { color: colors.status.danger }]}>CRÍTICO</Text>
            <Text style={[styles.kpiValue, { color: colors.status.danger }]}>{kpis.critical}</Text>
            <Text style={styles.kpiSub}>Atenção</Text>
          </View>
        </View>

        {/* Lista de Recursos Monitorados */}
        <View style={styles.resourcesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>INFRAESTRUTURA EM NUVEM</Text>
            <Text style={styles.sectionUpdated}>Atualizado: {lastUpdated}</Text>
          </View>

          <View style={styles.resourceList}>
            {filteredResources.map((res) => {
              const statusColor = getStatusColor(res.status);
              const badge = getProviderBadge(res.provider);

              return (
                <TouchableOpacity
                  key={res.id}
                  style={styles.resourceCard}
                  onPress={() => handleResourcePress(res)}
                  activeOpacity={0.7}
                >
                  {/* Tarja Lateral do Semáforo */}
                  <View style={[styles.semaphoreStripe, { backgroundColor: statusColor }]} />

                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View>
                        <View style={styles.cardBadgeRow}>
                          <View
                            style={[
                              styles.providerBadge,
                              { backgroundColor: badge.bg, borderColor: badge.border },
                            ]}
                          >
                            <Text style={[styles.providerBadgeText, { color: badge.text }]}>
                              {badge.name}
                            </Text>
                          </View>
                          <Text style={styles.resourceName}>{res.name}</Text>
                        </View>
                        <Text style={styles.resourceSub} numberOfLines={1}>
                          {res.ocid || res.arn || res.id}
                        </Text>
                      </View>

                      {/* Luz Indicadora de Status */}
                      <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
                    </View>

                    {/* Resumo de Métricas */}
                    <View style={styles.metricsRow}>
                      {res.metricsSummary.cpuPercent !== undefined && (
                        <View
                          style={[
                            styles.metricPill,
                            res.status === 'CRITICAL' && styles.metricPillDanger,
                          ]}
                        >
                          <Text
                            style={[
                              styles.metricPillText,
                              res.status === 'CRITICAL' && styles.metricPillTextDanger,
                            ]}
                          >
                            CPU: {res.metricsSummary.cpuPercent}%
                          </Text>
                        </View>
                      )}

                      {res.metricsSummary.memoryPercent !== undefined && (
                        <View style={styles.metricPill}>
                          <Text style={styles.metricPillText}>
                            Mem: {res.metricsSummary.memoryPercent}%
                          </Text>
                        </View>
                      )}

                      {res.metricsSummary.latencyMs !== undefined && (
                        <View style={styles.metricPill}>
                          <Text style={styles.metricPillText}>
                            {res.metricsSummary.latencyMs}ms
                          </Text>
                        </View>
                      )}

                      <View style={styles.metricPill}>
                        <Text style={styles.metricPillText}>{res.region}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingBottom: 40,
  },
  headerCurved: {
    backgroundColor: '#091122',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#172554',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066FF20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0066FF40',
    gap: 6,
  },
  activePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neonCyan,
  },
  regionBadgeText: {
    color: colors.neonCyan,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  logoutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logoutText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  uptimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  uptimeLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  uptimeValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginVertical: 2,
  },
  uptimeValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  uptimeDelta: {
    color: colors.status.healthy,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  uptimeSub: {
    color: colors.textMuted,
    fontSize: 10,
  },
  fakerRefreshBtn: {
    backgroundColor: '#0066FF25',
    borderWidth: 1,
    borderColor: '#0066FF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  fakerIcon: {
    fontSize: 16,
  },
  fakerText: {
    color: colors.neonCyan,
    fontSize: 8,
    fontWeight: '900',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#0C152B',
    borderRadius: 12,
    padding: 3,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  timeRangeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  timeRangeBtnActive: {
    backgroundColor: colors.neonBlue,
  },
  timeRangeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
  },
  filterSection: {
    marginTop: 14,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0D1527',
    borderWidth: 1,
    borderColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: colors.neonCyan,
    borderColor: colors.neonCyan,
  },
  filterPillOciActive: {
    backgroundColor: colors.oci.primary,
    borderColor: colors.oci.primary,
  },
  filterPillAwsActive: {
    backgroundColor: colors.aws.primary,
    borderColor: colors.aws.primary,
  },
  filterPillGcpActive: {
    backgroundColor: colors.gcp.primary,
    borderColor: colors.gcp.primary,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  kpiValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 1,
  },
  kpiSub: {
    color: colors.textMuted,
    fontSize: 8,
  },
  resourcesSection: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  sectionUpdated: {
    color: colors.neonCyan,
    fontSize: 9,
  },
  resourceList: {
    gap: 10,
  },
  resourceCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  semaphoreStripe: {
    width: 5,
  },
  cardContent: {
    flex: 1,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  providerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  providerBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  resourceName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  resourceSub: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 3,
    maxWidth: 240,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  metricPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricPillDanger: {
    backgroundColor: '#7F1D1D50',
    borderWidth: 1,
    borderColor: '#DC262660',
  },
  metricPillText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: 'monospace',
  },
  metricPillTextDanger: {
    color: '#F87171',
    fontWeight: '700',
  },
});
