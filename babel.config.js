const fs = require('fs');
const path = require('path');

/**
 * Carrega apenas variaveis publicas de build permitidas a partir do ambiente ou do arquivo .env local,
 * garantindo que nenhum segredo do host seja injetado acidentalmente no bundle JavaScript do app.
 */
function loadAllowedBuildEnv() {
  const allowedKeys = ['CLOUDWATCH_API_BASE_URL', 'CLOUDWATCH_PUBLIC_BASE_URL'];
  const fileValues = {};
  const envFilePath = path.join(__dirname, '.env');

  if (fs.existsSync(envFilePath)) {
    const raw = fs.readFileSync(envFilePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (allowedKeys.includes(key)) {
        fileValues[key] = val;
      }
    }
  }

  const resolved = {};
  for (const key of allowedKeys) {
    const envVal = process.env[key];
    resolved[key] =
      typeof envVal === 'string' && envVal.trim() !== ''
        ? envVal.trim()
        : fileValues[key] || '';
  }
  return resolved;
}

function inlineCloudWatchBuildEnvPlugin({ types: t }) {
  const buildEnv = loadAllowedBuildEnv();
  return {
    name: 'inline-cloudwatch-build-env',
    visitor: {
      MemberExpression(nodePath) {
        if (nodePath.parentPath.isAssignmentExpression({ left: nodePath.node })) {
          return;
        }
        for (const key of Object.keys(buildEnv)) {
          if (nodePath.matchesPattern(`process.env.${key}`)) {
            nodePath.replaceWith(t.stringLiteral(buildEnv[key]));
            return;
          }
        }
      },
    },
  };
}

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [inlineCloudWatchBuildEnvPlugin],
};
