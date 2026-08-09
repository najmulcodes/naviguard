import { Buffer } from 'buffer';

// react-native-quick-crypto's API mirrors Node's crypto module, which
// works in terms of Buffer. React Native has no Buffer global by default —
// this polyfill must run before ANY crypto module import anywhere in the
// app, which is why it's the very first line of the very first file.
if (typeof global.Buffer === 'undefined') {
  // @ts-expect-error — intentionally assigning the polyfill to the global
  global.Buffer = Buffer;
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
