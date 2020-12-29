/**
 * Base52-encode fixed-size arrays.
 * Not constant-time.
 */

const JSBI = require('jsbi');

let alphabet = (function() {
  let chars = '';
  for (let i = 0; i < 256; ++i) {
    let c = String.fromCharCode(i);
    // Remove vowels to avoid offensive strings:
    if (/[0-9a-z]/i.test(c) && !/[aeiou]/i.test(c)) {
      chars += c;
    }
  }
  return chars;
})();
console.assert(alphabet.length === 52);

/**
 * @param {number} length bytes.length
 * @param {Uint8Array} bytes
 * @returns {string} base52
 */
function encode(length, bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('expected Uint8Array');
  }
  if (bytes.length !== length) {
    throw new RangeError('invalid length');
  }
  const base = JSBI.BigInt(alphabet.length);

  let x = JSBI.BigInt(0);
  for (let c of bytes) {
    x = JSBI.add(JSBI.multiply(x, JSBI.BigInt(256)), JSBI.BigInt(c));
  }

  let id = [];
  while (JSBI.notEqual(x, JSBI.BigInt(0))) {
    id.push(alphabet[JSBI.toNumber(JSBI.remainder(x, base))]);
    x = JSBI.divide(x, base);
  }
  return id.reverse().join('');
}

/**
 * @param {number} length
 * @param {string} base52
 * @returns {Uint8Array} bytes
 */
function decode(length, base52) {
  if (typeof base52 !== 'string') {
    throw new TypeError('expected string');
  }
  const base = JSBI.BigInt(alphabet.length);

  let x = JSBI.BigInt(0);
  for (let c of base52) {
    let i = alphabet.indexOf(c);
    if (i === -1) throw new RangeError('invalid character');
    x = JSBI.add(JSBI.multiply(x, base), JSBI.BigInt(i));
  }

  let id = [];
  while (JSBI.notEqual(x, JSBI.BigInt(0))) {
    id.push(JSBI.toNumber(JSBI.remainder(x, JSBI.BigInt(256))));
    x = JSBI.divide(x, JSBI.BigInt(256));
  }
  while (id.length < length) {
    id.push(0);
  }
  if (id.length !== length) {
    throw new RangeError('invalid length');
  }
  return new Uint8Array(id.reverse());
}

module.exports = {
  encode,
  decode,
};
