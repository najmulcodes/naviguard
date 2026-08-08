module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo']
    // No plugins needed. 'module:react-native-quick-crypto/babel' never
    // existed in this package (checked react-native-quick-crypto@0.7.2 on
    // npm directly — no babel.js, no babel/ dir, nothing exported at that
    // path). That bogus entry is what Metro was choking on.
    //
    // react-native-quick-crypto's actual babel requirement
    // (babel-plugin-module-resolver aliasing the 'crypto'/'stream'/'buffer'
    // node builtins) only applies if your code imports those builtin names
    // directly, e.g. `import crypto from 'crypto'`. This codebase doesn't —
    // every crypto file imports the package directly:
    //   import crypto from 'react-native-quick-crypto';
    // (see src/crypto/guardKeyManager.ts, passwordMaterial.ts). The Buffer
    // polyfill in index.ts (assigned to global before any crypto import)
    // covers the rest. So there's nothing to alias — no plugin required.
  };
};
