/**
 * Base52-encode fixed-size arrays.
 * Not constant-time.
 */

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
  const base = BigInt(alphabet.length);

  let x = 0n; 
  for (let c of bytes) {
    x = x * 256n + BigInt(c);
  }

  let id = []; 
  while (x !== 0n) {
    id.push(alphabet[Number(x % base)]);
    x = x / base;
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
  const base = BigInt(alphabet.length);

  let x = 0n; 
  for (let c of base52) {
    let i = alphabet.indexOf(c);
    if (i === -1) throw new RangeError('invalid character');
    x = x * base + BigInt(i);
  }

  let id = []; 
  while (x !== 0n) {
    id.push(Number(x % 256n));
    x = x / 256n;
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
