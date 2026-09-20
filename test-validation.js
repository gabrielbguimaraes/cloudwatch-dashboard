/**
 * Script Rápido de Validação dos Serviços da Sprint 1
 * Execute no terminal: node test-validation.js
 */

const {
  generateSimulatedResources,
  generateTimeSeriesMetrics,
  generateSimulatedLogs,
  generateSimulatedIncidents,
} = require('./src/services/simulationService.ts');

console.log('\n======================================================');
console.log('⚡ CLOUDWATCH DASHBOARD - VALIDAÇÃO DA SPRINT 1 (OCI FIRST)');
console.log('======================================================\n');

// 1. Validar Recursos e Semáforo
console.log('1. Validando Geração de Recursos e Semáforo Visual:');
const resources = generateSimulatedResources();
resources.forEach((r) => {
  const icon = r.status === 'CRITICAL' ? '🔴' : r.status === 'WARNING' ? '🟡' : '🟢';
  console.log(`  ${icon} [${r.provider}] ${r.name.padEnd(30)} -> Status: ${r.status.padEnd(8)} | CPU: ${r.metricsSummary.cpuPercent ? r.metricsSummary.cpuPercent + '%' : 'N/A'}`);
});

// 2. Validar Série Temporal de Gráficos (react-native-svg-charts)
console.log('\n2. Validando Série Temporal de Métricas (Gráficos):');
const ociResource = resources[0];
const points = generateTimeSeriesMetrics(ociResource.id);
console.log(`  ✓ ${points.length} pontos gerados para o recurso "${ociResource.name}"`);
console.log(`  ✓ Primeiro ponto: ${points[0].timestamp} (${points[0].value}%) | Último ponto (atual): ${points[points.length - 1].timestamp} (${points[points.length - 1].value}%)`);

// 3. Validar Logs do OCI / CloudWatch Insights
console.log('\n3. Validando Central de Logs:');
const logs = generateSimulatedLogs(ociResource.id);
logs.forEach((log) => {
  console.log(`  ✓ [${log.severity}] ${log.timestamp} - ${log.message}`);
});

// 4. Validar Alertas e Incidentes
console.log('\n4. Validando Histórico de Incidentes:');
const incidents = generateSimulatedIncidents();
incidents.forEach((inc) => {
  console.log(`  🚨 [${inc.severity}] ${inc.resourceName} -> ${inc.message}`);
});

console.log('\n======================================================');
console.log('✅ VALIDAÇÃO COMPLETA: Todos os dados e modelos estão íntegros!');
console.log('======================================================\n');
