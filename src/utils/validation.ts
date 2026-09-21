/**
 * CloudWatch Dashboard - Validador Sintático de Credenciais OCI
 * Foco: Validação rigorosa de Tenancy OCID, User OCID, Fingerprint e Região.
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

/**
 * Valida se o Tenancy OCID segue a especificação da Oracle Cloud:
 * Inicia obrigatoriamente com "ocid1.tenancy.oc1.." seguido de identificadores válidos.
 */
export const validateTenancyOcid = (val: string): boolean => {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    /^ocid1\.tenancy\.oc1\.[a-z0-9._-]+$/.test(trimmed) ||
    (trimmed.startsWith('ocid1.tenancy.oc1..') && trimmed.length > 22)
  );
};

/**
 * Valida se o User OCID segue a especificação da Oracle Cloud:
 * Inicia obrigatoriamente com "ocid1.user.oc1.." seguido de identificadores válidos.
 */
export const validateUserOcid = (val: string): boolean => {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    /^ocid1\.user\.oc1\.[a-z0-9._-]+$/.test(trimmed) ||
    (trimmed.startsWith('ocid1.user.oc1..') && trimmed.length > 19)
  );
};

/**
 * Valida se o Fingerprint contém exatamente 16 pares hexadecimais separados por dois pontos:
 * Ex: 0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59
 */
export const validateFingerprint = (val: string): boolean => {
  if (!val) return false;
  const trimmed = val.trim();
  return /^([0-9a-fA-F]{2}:){15}[0-9a-fA-F]{2}$/.test(trimmed);
};

/**
 * Valida se a região segue a convenção da Oracle Cloud:
 * Ex: sa-saopaulo-1, us-ashburn-1, ou regex /^[a-z]{2}-[a-z]+-\d+$/
 */
export const validateRegion = (val: string): boolean => {
  if (!val) return false;
  const trimmed = val.trim().toLowerCase();
  const knownRegions = [
    'sa-saopaulo-1',
    'sa-vinhedo-1',
    'sa-santiago-1',
    'sa-bogota-1',
    'us-ashburn-1',
    'us-phoenix-1',
    'us-sanjose-1',
    'us-chicago-1',
    'eu-frankfurt-1',
    'eu-amsterdam-1',
    'uk-london-1',
    'ap-tokyo-1',
    'ap-seoul-1',
    'ap-sydney-1',
  ];
  if (knownRegions.includes(trimmed)) return true;
  return /^[a-z]{2}-[a-z]+-\d+$/.test(trimmed);
};
