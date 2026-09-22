const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite na web roda SQLite em WebAssembly.
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer (usado pelo expo-sqlite na web) exige isolamento de origem.
// require-corp em vez de credentialless porque o Safari no iPhone não suporta credentialless.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
