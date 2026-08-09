import crypto from 'react-native-quick-crypto';

/**
 * Wraps react-native-quick-crypto's randomBytes in a plain-JS Buffer
 * immediately. Necessary because quick-crypto's raw return value isn't
 * guaranteed to share a prototype with the global `buffer` package's
 * Buffer class — calling .toString('base64') directly on it can route
 * into quick-base64's native-accelerated path, which has a confirmed
 * compatibility bug with the specific versions this project is pinned
 * to (see git history / commit messages around Aug 2026 for the full
 * debugging trail). Re-wrapping via Buffer.from() forces use of the
 * plain, dependency-free JS base64 implementation instead — slightly
 * slower, always correct.
 */
export function randomBytes(size: number): Buffer {
  return Buffer.from(crypto.randomBytes(size));
}