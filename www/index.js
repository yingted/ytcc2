/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const {html, renderToStream} = require('@popeindustries/lit-html-server');
const expressStaticGzip = require('express-static-gzip');
const {decodeSrt, normalizeSrt, encodeSrt, decodeJson3, decodeSrv3, stripRaw} = require('ytcc2-captions');
const db = require('./db');
const config = require('./config');
const crypto = require('crypto');
const multer  = require('multer');
const {renderFooter} = require('./templates.js');
const {renderTerms} = require('./terms.js');
const upload = multer();
const {sign_open} = require('tweetnacl-ts');
require('jsdom-global')();
global.DOMParser = window.DOMParser;

if (['production', 'development', undefined].indexOf(process.env.NODE_ENV) === -1) {
  throw new Error('Expected NODE_ENV=production or NODE_ENV=development (default), got ' + process.env.NODE_ENV);
}
const production = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.text());
app.use(expressStaticGzip('static', {
  enableBrotli: true,
  index: false,
  orderPreference: ['br', 'gz'],
}));
app.use(express.urlencoded({
  extended: true,
}));

function asyncHandler(handler) {
  return function(req, res) {
    handler.apply(this, arguments).catch(function(e) {
      console.error('error', e);
      res.sendStatus(500);
    });
  }
}

app.get('/terms', (req, res) => {
  renderToStream(renderTerms({html})).pipe(res);
});

app.get('/', (req, res) => {
  renderToStream(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="referrer" content="no-referrer">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Captions</title>
        <link rel="stylesheet" type="text/css" href="/dialog-polyfill/dialog-polyfill.css" />
      </head>
      <body style="margin: 0 auto; max-width: 640px;">
        <noscript>You need JavaScript to view this page.</noscript>
        <script src="/main.bundle.js"></script>

        ${renderFooter({html})}
      </body>
    </html>
  `).pipe(res);
});

app.get('/captions/:captionsId', asyncHandler(async (req, res) => {
  let {captionsId} = req.params;
  captionsId = parseInt(captionsId);
  if (isNaN(captionsId)) {
    res.status(400).type('text/plain').send('Invalid captions ID');
    return;
  }
  // Get the captions tracks:
  let tracks = (await db.query(`
    SELECT t.encrypted_data AS encrypted_data
    FROM private_captions AS t
    WHERE t.public_key_base64=$1
      AND t.delete_at > now()
    LIMIT 2
  `, [captionsId])).rows.map(({video_id, language, srt}) => ({
    captionsId: captions_id,
    language,
    srt,
  }));

  if (tracks.length === 0) {
    res.sendStatus(404);
    return;
  }
  if (tracks.length > 1) {
    res.sendStatus(500);
    return;
  }
  res.json(tracks[0]);
}));

/**
 * Normalize the SRT in UTF-8.
 * @param {string} srtBase64
 * @returns {string} srt
 * @throws if it can't be parsed
 */
function srtBase64ToSrt(srtBase64) {
  try {
    let srt = Buffer.from(srtBase64, 'base64').toString('utf8');
    let captions = decodeSrt(srt);
    captions = normalizeSrt(captions);
    return Buffer.from(encodeSrt(captions)).toString('utf8');
  } catch (e) {
    if (!production) {
      console.log('error parsing SRT', e);
    }
    throw new Error('could not parse SRT');
  }
}
let base52 = (function() {
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
function secureRandomId() {
  let x = 0n;
  for (let c of crypto.randomBytes(128 / 8)) {
    x = x * 256n + BigInt(c);
  }
  let id = [];
  const base = BigInt(base52.length);
  while (x !== 0n) {
    id.push(base52[(x % base).valueOf()]);
    x = x / base;
  }
  return id.reverse().join('');
}
app.post('/captions', upload.none(), asyncHandler(async (req, res) => {
  let {videoId, srtBase64, publicKeyBase64, language} = req.body;
  let srt = srtBase64ToSrt(srtBase64);

  let captionsId = secureRandomId();

  await db.withClient(async client => {
    let {rows: [{max_seq}]} = await client.query(`
      SELECT COALESCE(MAX(seq), -1) AS max_seq
      FROM captions
    `);
    let seq = max_seq + 1;

    await client.query(`
      INSERT INTO captions(video_id, captions_id, seq, srt, language, public_key_base64)
        VALUES($1, $2, $3, $4, $5, $6)`,
      [videoId, captionsId, seq, srt, language, publicKeyBase64]);

    res.json({captionsId});
  });
}));

class TtlSet {
  /**
   * Create a set with a coarse-grained TTL.
   * Time complexity is numShards and timeout margin is ttl / numShards.
   * This object cannot be deleted.
   * @param {number} numShards the number of shards, must be >= 2
   * @param {number} ttl the minimum time to keep things around
   */
  constructor(numShards, ttl) {
    if (numShards < 2) throw new Error('numShards < 2: ' + numShards);
    // [newest, second-newest, ..., oldest]
    this._shards = [];
    for (let i = 0; i < numShards; ++i) {
      this._shards.push(new Set());
    }
    setInterval(() => {
      let [deleted] = this._shards.splice(this._shards.length - 1);
      this._shards.unshift(new Set());
    }, ttl / (numShards - 1));
  }

  /**
   * Add a value if it's not included.
   * Extends the TTL.
   */
  add(value) {
    this._shards[0].add(value);
  }

  /**
   * Deletes a value.
   */
  delete(value) {
    for (let shard of this._shards) {
      shard.delete(value);
    }
  }

  /**
   * Tests if a value exists.
   */
  has(value) {
    for (let shard of this._shards) {
      if (shard.has(value)) return true;
    }
    return false;
  }
}
// Nonces are non-sensitive data, and the only reason for deleting it is to avoid memory leaks.
// Security only depends on them being used at most once.
// WCAG asks for a 20 hours session limit, but I'm increasing it to ~1 week since the cost is low.
let nonces = new TtlSet(100, 3600 * 24 * 7);
/**
 * Wrap a handler in signature verification code.
 * Takes trustingHandler(req, res, publicKey, params), where params is trusted.
 * publicKey is base64.
 * Returns verifyingHandler(req, res), where req.body is untrusted.
 */
let signedHandler = function signedHandler(handler) {
  return (req, res) => {
    if (req.body === '') {
      // This nonce could be MITM'd, so we need to also verify the origin.
      let untrustedNonce = secureRandomId();
      nonces.add(untrustedNonce);
      res.json({untrustedNonce});
      return;
    }

    let {publicKey, signedRequest} = req.body;
    if (!(typeof publicKey === 'string' && typeof signedRequest === 'string')) {
      res.sendStatus(400);
      return;
    }

    // Verify their message:
    let message = sign_open(
      new Uint8Array(Buffer.from(signedRequest, 'base64')),
      new Uint8Array(Buffer.from(publicKey, 'base64')));
    if (message === null) {
      res.sendStatus(403);
      return;
    }
    let {url, params, untrustedNonce} = JSON.parse(new TextDecoder().decode(message));

    // Verify the nonce:
    if (!nonces.has(untrustedNonce)) {
      res.sendStatus(403);
      return;
    }
    nonces.delete(untrustedNonce);

    // Verify the URL origin:
    let u = new URL(url);
    let sentToTrustedOrigin = config.origins_and_trusted_proxy_origins.indexOf(u.origin) !== -1;
    let sentToThisEndpoint = u.pathname === req.originalUrl.replace(/\?.*/, '');
    if (!(sentToTrustedOrigin && sentToThisEndpoint)) {
      res.sendStatus(403);
      return;
    }

    return handler(req, res, publicKey, params);
  };
};
app.delete('/captions/:captionsId', signedHandler(asyncHandler(async (req, res, publicKey, params) => {
  await db.withClient(async client => {
    // Find the caption whose key was provided:
    let {rows} = await client.query(`
      SELECT t.video_id AS video_id, t.captions_id AS captions_id
      FROM captions AS t
      WHERE t.public_key_base64=$1
    `, [publicKey]);

    if (rows.length === 0) {
      res.sendStatus(404);
      return;
    }
    if (rows.length !== 1) {
      console.error('duplicate public keys');
      res.sendStatus(500);
      return;
    }
    let [{video_id, captions_id}] = rows;

    await client.query(`
      DELETE
      FROM captions AS t
      WHERE t.video_id=$1 AND t.captions_id=$2
    `, [video_id, captions_id]);
    res.sendStatus(200);
  });
})));

(async function() {
  try {
    await db.init();
    await db.updateSchema();
  } catch (e) {
    console.error('error initializing database', e);
    process.exit(1);
  }

  // GC old data every 24 hours:
  (async function() {
    for (;;) {
      await db.gc();
      await new Promise(resolve => setTimeout(resolve, 1000 * 3600 * 24));
    }
  })();

  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`listening on port ${port}`);
  });
})();
