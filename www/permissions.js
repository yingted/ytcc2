/**
 * Wrapper around tweetnacl to avoid juggling Uint8Array.
 * The API uses valid UTF-8 strings everywhere (no surrogate pairs).
 *
 * encrypt/decrypt behave as you'd expect
 * sign/verify behave like encrypt/decrypt with a constant recipient key,
 * except it's deterministic and slower.
 *
 * Example external usage:
 * let writer = Writer.random();
 * let ciphertext = writer.encrypt(plaintext);
 *
 * Example internal usage:
 * let encrypted = encrypt(
 *   new SecretKeyRing('128-bit sender secret'),
 *   new SecretKeyRing('128-bit recipient secret'),
 *   'hello');
 *
 * The secrets need to come from a CSPRNG or KDF.
 */

const nacl = require('tweetnacl');
const base52 = require('./base52.js');

/**
 * Generate a 192-bit random secret.
 * @returns {string} base52-encoded
 * @throws if secure RNG is not available
 */
function randomSecret() {
  // Use 192 bits to reduce the risk of batch attacks.
  const bytes = 192 / 8;
  return base52.encode(bytes, nacl.randomBytes(bytes));
}

/**
 * Deterministically make a key from the secret using hashing.
 * @param {string} name a unique name for the key
 * @param {string} secret a >=128-bit secret
 * @returns {Uint8Array} a length-32 array of the key
 */
function makeKey256({name, secret}) {
  if (typeof name !== 'string') {
    throw new TypeError('expected string');
  }
  if (typeof secret !== 'string') {
    throw new TypeError('expected string');
  }

  // nacl.hash is vulnerable to length-extension, so encode the length.
  // That way, if secret is length-extended, the length will change.
  // It doesn't matter here since we've truncated the output.
  let encoded =
    'type=key256&' +
    'name=' + encodeURIComponent(name) + '&' +
    'length=' + encodeURIComponent(secret.length.toString()) + '&' +
    'secret=' + encodeURIComponent(secret);
  return nacl.hash(safeEncodeUtf8(encoded)).subarray(0, 32);
}

/**
 * Deterministically make a 192-bit secret from another 192-bit secret using hashing.
 */
function makeSecretBase52({name, secret}) {
  if (typeof name !== 'string') {
    throw new TypeError('expected string');
  }
  if (typeof secret !== 'string') {
    throw new TypeError('expected string');
  }

  // nacl.hash is vulnerable to length-extension, so encode the length.
  // That way, if secret is length-extended, the length will change.
  let encoded =
    'type=secret_base52&' +
    'name=' + encodeURIComponent(name) + '&' +
    'length=' + encodeURIComponent(secret.length.toString()) + '&' +
    'secret=' + encodeURIComponent(secret);
  const bytes = 192 / 8;
  return base52.encode(bytes, nacl.hash(safeEncodeUtf8(encoded)).subarray(0, bytes));
}

/**
 * Deterministically make a secret from two secrets using hashing.
 * @param {string} a a 192-bit secret
 * @param {string} b a 192-bit secret
 * @param {string} a 192-bit hash of both combined
 */
function combineSecretsBase52({a, b}) {
  if (typeof a !== 'string') {
    throw new TypeError('expected string');
  }
  if (typeof b !== 'string') {
    throw new TypeError('expected string');
  }

  // nacl.hash is vulnerable to length-extension, so encode the length.
  // That way, if secret is length-extended, the length will change.
  let encoded =
    'type=combine_secrets_base52&' +
    'a_length=' + encodeURIComponent(a.length.toString()) + '&' +
    'b_length=' + encodeURIComponent(b.length.toString()) + '&' +
    'a=' + encodeURIComponent(a) + '&' +
    'b=' + encodeURIComponent(b);
  const bytes = 192 / 8;
  return base52.encode(bytes, nacl.hash(safeEncodeUtf8(encoded)).subarray(0, bytes));
}

/**
 * @param {Uint8Array} key
 * @param {number} length
 * @throws if key is not a Uint8Array of length
 */
function checkKeyLength(key, length) {
  if (!(key instanceof Uint8Array)) {
    throw new TypeError('expected Uint8Array');
  }
  if (key.length !== length) {
    throw new RangeError('wrong key length');
  }
}

function uint8ArrayToBase64(buffer) {
  if (!(buffer instanceof Uint8Array)) {
    throw new TypeError('expected Uint8Array');
  }
  return window.btoa(String.fromCharCode.apply(String, buffer));
}
function base64ToUint8Array(data) {
  if (typeof data !== 'string') {
    throw new TypeError('expected string');
  }
  return new Uint8Array(Array.from(window.atob(data)).map(c => c.charCodeAt(0)));
}

function safeDecodeUtf8(bytes) {
  let text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  if (text.charCodeAt(0) === 65279) {
    text = text.substring(1);
  }
  return text;
}
/**
 * Safely encode UTF-8.
 * @param {string} utf8
 * @returns {Uint8Array}
 */
function safeEncodeUtf8(utf8) {
  let bytes = new TextEncoder().encode(utf8);
  if (safeDecodeUtf8(bytes) !== utf8) {
    throw new Error('invalid utf-8');
  }
  return bytes;
}

function hashUtf8(utf8) {
  return base52.encode(nacl.hash.hashLength, nacl.hash(safeEncodeUtf8(utf8)));
}

/**
 * A set of keys generated from a single 128-bit secret.
 * Can't be serialized.
 */
class SecretKeyRing {
  /**
   * Create a private key from a 128-bit secret.
   * Not constant-time, regardless of secret length.
   * @param {string} secret
   */
  constructor(secret) {
    if (typeof secret !== 'string') {
      throw new TypeError('expected string');
    }
    // box.keyPair is generating secret keys as random numbers, so this should be fine:
    let signPair = nacl.sign.keyPair.fromSeed(makeKey256({name: 'sign', secret}));
    let boxPair = nacl.box.keyPair.fromSecretKey(makeKey256({name: 'box', secret}));

    this._publicRing = new PublicKeyRing(
      signPair.publicKey,
      nacl.sign(boxPair.publicKey, signPair.secretKey),
      boxPair.publicKey);
    this._boxSecretKey = boxPair.secretKey;
    this._signSecretKey = signPair.secretKey;
  }

  // Secret keys:
  get boxSecretKey() {
    return this._boxSecretKey;
  }
  get signSecretKey() {
    return this._signSecretKey;
  }

  // Public keys:
  get publicRing() {
    return this._publicRing;
  }

  // Demeter helpers
  get boxPublicKey() {
    return this._publicRing.boxPublicKey;
  }
  get signPublicKey() {
    return this._publicRing.signPublicKey;
  }
  get fingerprint() {
    return this._publicRing.fingerprint;
  }
}

/**
 * The public part of a secret key ring.
 * Do not use the constructor directly.
 * Can be serialized.
 * After deserialization, you should verify the fingerprint.
 */
class PublicKeyRing {
  /**
   * Do not use the constructor directly, it has an unverified parameter.
   */
  constructor(signPublicKey, signedBoxPublicKey, boxPublicKey) {
    checkKeyLength(signPublicKey, 32);
    checkKeyLength(signedBoxPublicKey, 32 + 64);
    if (boxPublicKey === undefined) {
      boxPublicKey = nacl.sign.open(signedBoxPublicKey, signPublicKey);
      if (boxPublicKey === null) {
        throw new ValueError('invalid public key');
      }
    }
    checkKeyLength(boxPublicKey, 32);

    this._signPublicKey = signPublicKey;
    this._signedBoxPublicKey = signedBoxPublicKey;
    this._boxPublicKey = boxPublicKey;
  }

  /**
   * Serialize this keyring to a JSON object.
   */
  toJSON() {
    return {
      signPublicKeyBase64: uint8ArrayToBase64(this._signPublicKey),
      signedBoxPublicKeyBase64: uint8ArrayToBase64(this._signedBoxPublicKey),
    };
  }
  /**
   * Deserialize this keyring from a JSON object.
   * @param {string} serialized
   * @returns {PublicKeyRing}
   * @throws if serialized can't be parsed
   */
  static fromJSON(obj) {
    return new PublicKeyRing(
      base64ToUint8Array(obj.signPublicKeyBase64),
      base64ToUint8Array(obj.signedBoxPublicKeyBase64));
  }

  get boxPublicKey() {
    return this._boxPublicKey;
  }
  get signPublicKey() {
    return this._signPublicKey;
  }
  get fingerprint() {
    return uint8ArrayToBase64(this._signPublicKey);
  }
}

/**
 * Encrypt a message so only the recipient can decrypt it.
 * @param {SecretKeyRing} from
 * @param {SecretKeyRing|PublicKeyRing} to
 * @param {string} message a valid unicode string (no invalid surrogate pairs)
 * @returns {string} encrypted, a valid unicode string
 */
function encrypt(from, to, message) {
  if (!(from instanceof SecretKeyRing)) {
    throw new TypeError('expected secret keyring');
  }
  if (!(to instanceof SecretKeyRing || to instanceof PublicKeyRing)) {
    throw new TypeError('expected keyring');
  }
  if (typeof message !== 'string') {
    throw new TypeError('expected string message');
  }

  let nonce = nacl.randomBytes(nacl.box.nonceLength);
  let plaintext = safeEncodeUtf8(message);
  let ciphertext = nacl.box(plaintext, nonce, to.boxPublicKey, from.boxSecretKey);

  let encrypted = JSON.stringify({
    nonce: uint8ArrayToBase64(nonce),
    ciphertext: uint8ArrayToBase64(ciphertext),
  });
  return encrypted;
}

/**
 * Decrypt a message encrypted to the recipient.
 * @param {SecretKeyRing|PublicKeyRing} from
 * @param {SecretKeyRing} to
 * @param {string} encrypted the output of encrypt(from, to, message)
 * @returns {string} message the input message of encrypt
 */
function decrypt(from, to, encrypted) {
  if (!(from instanceof SecretKeyRing || from instanceof PublicKeyRing)) {
    throw new TypeError('expected keyring');
  }
  if (!(to instanceof SecretKeyRing)) {
    throw new TypeError('expected secret keyring');
  }
  if (typeof encrypted !== 'string') {
    throw new TypeError('expected string encrypted');
  }

  let obj = JSON.parse(encrypted);
  let nonce = base64ToUint8Array(obj.nonce);
  let ciphertext = base64ToUint8Array(obj.ciphertext);
  let plaintext = nacl.box.open(ciphertext, nonce, from.boxPublicKey, to.boxSecretKey);
  if (plaintext === null) {
    throw new Error('failed to decrypt the message');
  }

  let message = safeDecodeUtf8(plaintext);
  return message;
}

/**
 * Sign a message.
 * @param {SecretKeyRing} from
 * @param {string} message a valid unicode string
 * @returns {string} signature
 */
function sign(from, message) {
  if (!(from instanceof SecretKeyRing)) {
    throw new TypeError('expected secret keyring');
  }
  if (typeof message !== 'string') {
    throw new TypeError('expected string message');
  }

  let signature = uint8ArrayToBase64(
    nacl.sign.detached(
      safeEncodeUtf8(message),
      from.signSecretKey));
  return signature;
}

/**
 * Verify and return a message.
 * @param {SecretKeyRing|PublicKeyRing} from
 * @param {string} message a valid unicode string
 * @param {string} signature the output of sign(from, message)
 */
function verify(from, message, signature) {
  if (!(from instanceof SecretKeyRing || from instanceof PublicKeyRing)) {
    throw new TypeError('expected keyring');
  }
  if (typeof message !== 'string') {
    throw new TypeError('expected string message');
  }
  if (typeof signature !== 'string') {
    throw new TypeError('expected string signature');
  }

  let ok = nacl.sign.detached.verify(
      safeEncodeUtf8(message),
      base64ToUint8Array(signature),
      from.signPublicKey);

  if (!ok) {
    throw new ValueError('failed to verify the signature');
  }
}

/**
 * The writer has all the private keys.
 */
class Writer {
  constructor(secret) {
    this._secret = secret;
    // Get the write ring:
    this._writeRing = new SecretKeyRing(makeSecretBase52({name: 'write:', secret}));

    // Get the read ring:
    // The reader's secret:
    // - Can be computed from the writer's secret.
    // - Proves the writer's fingerprint didn't change.
    let readerSeed = makeSecretBase52({name: 'read:', secret});
    let readerSecret = combineSecretsBase52({
      a: readerSeed,
      b: this._writeRing.fingerprint,
    });
    this._reader = new Reader(readerSecret);

    // Create the public bits:
    this._public = new WriterPublic(
      this._writeRing.publicRing,
      this._reader._ring.publicRing,
      encrypt(this._writeRing, this._reader._ring, readerSeed));

    this._reader._writerPublic = this._public;
  }

  /**
   * @param {WriterPublic} writer
   * @throws if the writer could not be verified
   */
  setWriterPublic(writer) {
    if (this.fingerprint !== writer.fingerprint) {
      throw new TypeError('could not verify writer');
    }
  }

  static random() {
    return new Writer(randomSecret());
  }

  /**
   * @param {string} message
   * @returns {string} encrypted message
   */
  encrypt(message) {
    return encrypt(this._writeRing, this._reader._ring, message);
  }
  decrypt(message) {
    return this._reader.decrypt(message);
  }
  sign(message) {
    return sign(this._writeRing, message);
  }
  verify(message, signature) {
    return this._reader.verify(message, signature);
  }

  get secret() {
    return this._secret;
  }
  get reader() {
    return this._reader;
  }
  get public() {
    return this._public;
  }
  get fingerprint() {
    return this._public.fingerprint;
  }
}

/**
 * Public bits of writer.
 * Used by the server and readers.
 */
class WriterPublic {
  /**
   * @param {PublicKeyRing} writeRing
   * @param {PublicKeyRing} readRing
   * @param {string} readerSeedEncrypted
   */
  constructor(writeRing, readRing, readerSeedEncrypted) {
    if (!(writeRing instanceof PublicKeyRing)) {
      throw new TypeError('expected PublicKeyRing');
    }
    if (!(readRing instanceof PublicKeyRing)) {
      throw new TypeError('expected PublicKeyRing');
    }
    if (typeof readerSeedEncrypted !== 'string') {
      throw new TypeError('expected string');
    }
    this._writeRing = writeRing;
    this._readRing = readRing;
    this._readerSeedEncrypted = readerSeedEncrypted;
  }
  toJSON() {
    return {
      write: this._writeRing.toJSON(),
      read: this._readRing.toJSON(),
      readerSeedEncrypted: this._readerSeedEncrypted,
    };
  }
  static fromJSON(obj) {
    return new WriterPublic(
      PublicKeyRing.fromJSON(obj.write),
      PublicKeyRing.fromJSON(obj.read),
      obj.readerSeedEncrypted);
  }

  verify(message, signature) {
    verify(this._writeRing, message, signature);
  }

  get fingerprint() {
    return this._writeRing.fingerprint;
  }
}

/**
 * The reader has the read private keys and can verify the writer public keys.
 */
class Reader {
  constructor(secret) {
    this._secret = secret;
    this._secretArray = safeEncodeUtf8(secret);
    this._fingerprint = makeSecretBase52({name: 'hash:', secret});
    this._ring = new SecretKeyRing(makeSecretBase52({name: 'key:', secret}));
    this._writerPublic = null;
  }

  /**
   * Verify that the write ring loaded from the server is valid.
   * Unfortunately the read secret is not enough to derive the write pubring.
   * @param {string} readerSeedEncrypted
   * @param {SecretKeyRing|PublicKeyRing} writeRing
   * @throws if the writer could not be verified
   */
  _verifyWriter(readerSeedEncrypted, writeRing) {
    if (typeof readerSeedEncrypted !== 'string') {
      throw new TypeError('expected string');
    }
    if (!(writeRing instanceof SecretKeyRing || writeRing instanceof PublicKeyRing)) {
      throw new TypeError('expected keyring');
    }
    let readerSeed = decrypt(writeRing, this._ring, readerSeedEncrypted);
    let readerSecret = combineSecretsBase52({
      a: readerSeed,
      b: writeRing.fingerprint,
    });
    if (!nacl.verify(this._secretArray, safeEncodeUtf8(readerSecret))) {
      throw new Error('could not verify writer');
    }
  }

  /**
   * @param {WriterPublic} writer
   * @throws if the writer could not be verified
   */
  setWriterPublic(writer) {
    if (!(writer instanceof WriterPublic)) {
      throw new TypeError('expected WriterPublic');
    }
    this._verifyWriter(writer._readerSeedEncrypted, writer._writeRing);
    // Doesn't need to be constant time to verify this:
    if (this._ring.fingerprint !== writer._readRing.fingerprint) {
      throw new TypeError('could not verify read ring');
    }

    this._writerPublic = writer;
  }

  decrypt(message) {
    if (this._writerPublic === null) {
      throw new Error('need to call setWriterPublic first');
    }
    return decrypt(this._writerPublic._writeRing, this._ring, message);
  }
  verify(message, signature) {
    if (this._writerPublic === null) {
      throw new Error('need to call setWriterPublic first');
    }
    this._writerPublic.verify(message, signature);
  }

  get secret() {
    return this._secret;
  }
  get fingerprint() {
    return this._fingerprint;
  }
}

module.exports = {
  Writer,
  Reader,
  WriterPublic,
  hashUtf8,
};
