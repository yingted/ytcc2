const isNode = require('detect-node');
const crypto = isNode ? new (require('@peculiar/webcrypto').Crypto)() : window.crypto;
const TextEncoder = isNode ? require('fastestsmallesttextencoderdecoder').TextEncoder : window.TextEncoder;

function encodeUtf8(s) {
  return new TextEncoder().encode(s);
}

/**
 * Generate a proof of work.
 * @param {string} nonce a unicode string
 * @param {number} iters
 * @param {number} length
 * @returns {string} pow
 */
async function generateAsync(nonce, iters, length) {
  // Use swapped hash/password.
  // Doesn't really matter because in the worst case, I can switch to argon2.
  let salt = await crypto.subtle.importKey(
    'raw', encodeUtf8(nonce),
    'PBKDF2', /*extractable=*/false, ['deriveBits']);
  let hashes = [];
  for (let i = 0; i < length; ++i) {
    hashes.push(crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: new Uint32Array([i]),
      iterations: iters,
      hash: 'SHA-256',
    }, salt, 8));
  }
  hashes = await Promise.all(hashes);
  let bytes = new Array((length + 7) >> 3);
  for (let i = 0; i < bytes.length; ++i) {
    let b = 0;
    for (let j = 0; j < 8; ++j) {
      b |= (new Uint8Array(hashes[i * 8 + j])[0] & 1) << j;
    }
    bytes[i] = b;
  }
  return window.btoa(String.fromCharCode.apply(String, bytes));
}

/**
 * Return ceil(ilog2(x)) for x <= 2**30.
 */
function ceil_ilog2(x) {
  if (x < 1 || x > (1 << 30)) {
    throw new Error('invalid x: ' + x);
  }
  let log = 0;
  for (let i = 1; i < x; i <<= 1) {
    ++log;
  }
  return log;
}

/**
 * Verify a proof of work.
 * Make sure to await it.
 * @param {string} nonce a valid unicode string
 * @param {number} iters
 * @param {number} length
 * @param {string} pow
 * @throws if it's invalid
 */
async function verifyAsync(nonce, iters, length, pow) {
  let bytes = Buffer.from(pow, 'base64');
  if (bytes.length !== (length + 7) >> 3) {
    throw new Error('PoW is invalid');
  }

  let salt = await crypto.subtle.importKey(
    'raw', encodeUtf8(nonce),
    'PBKDF2', /*extractable=*/false, ['deriveBits']);
  let num_tries = ceil_ilog2(length);
  // Not completely fair, but close enough.
  let indices = new Uint32Array(num_tries);
  crypto.getRandomValues(indices);
  for (let i = 0; i < num_tries; ++i) {
    let bitIndex = indices[i] % (bytes.length * 8);
    let proverBit = (bytes[bitIndex >> 3] >> (bitIndex & 7)) & 1;
    let hash = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: new Uint32Array([bitIndex]),
      iterations: iters,
      hash: 'SHA-256',
    }, salt, 8);
    let verifierBit = new Uint8Array(hash)[0] & 1;
    if (proverBit !== verifierBit) {
      throw new Error('PoW is invalid');
    }
  }
}

module.exports = {
  generateAsync,
  verifyAsync,
};
