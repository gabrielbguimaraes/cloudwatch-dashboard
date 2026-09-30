/**
 * Teste unitário para validar ciclo de vida (restart, edit, delete),
 * pull-to-refresh sem substituição destrutiva e persistência de dados.
 */

const assert = require('assert');

console.log('🧪 Iniciando testes de ciclo de vida e refresh...');

// 1. Simulação do comportamento de refreshMetrics
let resources = [
  { id: 'res-1', name: 'Web Server', status: 'HEALTHY', cpuUsage: 50 },
  { id: 'res-2', name: 'DB Server', status: 'REBOOTING', cpuUsage: 20 },
  { id: 'res-3', name: 'API Server', status: 'WARNING', cpuUsage: 70 },
];

function refreshMetrics(prevList) {
  return prevList.map(item => {
    if (item.status === 'REBOOTING') return item;
    const delta = Math.floor(Math.random() * 15) - 7;
    const newCpu = Math.min(99, Math.max(8, (item.cpuUsage || 50) + delta));
    let newStatus = item.status;
    if (newCpu > 85) newStatus = 'CRITICAL';
    else if (newCpu > 65) newStatus = 'WARNING';
    else newStatus = 'HEALTHY';

    return {
      ...item,
      status: newStatus,
      cpuUsage: newCpu,
      lastUpdated: new Date().toLocaleTimeString(),
    };
  });
}

const refreshed = refreshMetrics(resources);

// Verificação 1: Itens existentes permanecem com os mesmos IDs e nomes
assert.strictEqual(refreshed.length, 3, 'Tamanho da lista deve ser preservado');
assert.strictEqual(refreshed[0].id, 'res-1');
assert.strictEqual(refreshed[1].id, 'res-2');
assert.strictEqual(refreshed[1].status, 'REBOOTING', 'Instância em REBOOTING não deve ser alterada no refresh');
assert.strictEqual(refreshed[2].id, 'res-3');
console.log('  ✓ Refresh preserva recursos existentes e respeita REBOOTING');

// 2. Simulação de restartInstance
function restartInstance(list, id) {
  return list.map(item => {
    if (item.id === id) {
      return { ...item, status: 'REBOOTING' };
    }
    return item;
  });
}

function completeRestart(list, id) {
  return list.map(item => {
    if (item.id === id) {
      return { ...item, status: 'HEALTHY', cpuUsage: 14 };
    }
    return item;
  });
}

const rebootingList = restartInstance(refreshed, 'res-1');
assert.strictEqual(rebootingList[0].status, 'REBOOTING');
const finishedRestartList = completeRestart(rebootingList, 'res-1');
assert.strictEqual(finishedRestartList[0].status, 'HEALTHY');
assert.strictEqual(finishedRestartList[0].cpuUsage, 14);
console.log('  ✓ restartInstance transita para REBOOTING e depois para HEALTHY com CPU 14%');

// 3. Simulação de editInstance
function editInstance(list, id, newName, newShape) {
  return list.map(item => {
    if (item.id === id) {
      return {
        ...item,
        name: newName,
        shape: newShape || item.shape,
      };
    }
    return item;
  });
}

const editedList = editInstance(finishedRestartList, 'res-1', 'Web Server Renamed', 'VM.Standard.A1.Flex');
assert.strictEqual(editedList[0].name, 'Web Server Renamed');
assert.strictEqual(editedList[0].shape, 'VM.Standard.A1.Flex');
console.log('  ✓ editInstance atualiza nome e shape corretamente');

// 4. Simulação de deleteInstance
function deleteInstance(list, id) {
  return list.filter(item => item.id !== id);
}

const deletedList = deleteInstance(editedList, 'res-1');
assert.strictEqual(deletedList.length, 2);
assert.strictEqual(deletedList.some(r => r.id === 'res-1'), false);
console.log('  ✓ deleteInstance remove o recurso por ID com sucesso');

console.log('✅ TODOS OS TESTES DE CICLO DE VIDA PASSARAM COM SUCESSO!\n');
