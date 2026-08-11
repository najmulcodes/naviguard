// This file deliberately uses require() instead of import for everything
// below, NOT import/ES module syntax. Reason: ES `import` statements are
// hoisted to the top of a file by the JS engine automatically, before any
// other code runs — regardless of where they're textually written. That
// means even with the Buffer polyfill assignment written first in this
// file, `import App from './App'` would still execute before it, because
// imports always run first. Since App.tsx transitively requires
// guardKeyManager.ts, which uses Buffer at module-load time (not just
// inside functions), that ordering bug caused a real crash:
// "Property 'Buffer' doesn't exist".
//
// require() calls are NOT hoisted — they run exactly where they appear,
// in sequence. Using require() here guarantees the polyfill is fully
// installed before anything that depends on it gets loaded, no matter
// what gets added to the codebase later. Do not convert this file back
// to import syntax without re-verifying this ordering guarantee.

const { Buffer } = require('buffer');
if (typeof (global as any).Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}

const { registerRootComponent } = require('expo');
const App = require('./App').default;

registerRootComponent(App);
