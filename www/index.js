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
const db = require('./db');
const config = require('./config');
const crypto = require('crypto');
const multer  = require('multer');
const {renderFooter} = require('./templates.js');
const {renderTerms} = require('./terms.js');
const upload = multer();
const nacl = require('tweetnacl');
const base52 = require('./base52.js');
const {WriterPublic, hashUtf8} = require('./permissions.js');
const {verifyAsync} = require('./pow.js');
const {asrLanguages} = require('./youtube_languages.js');
const tmp = require('tmp-promise');
const {spawn} = require('child_process');
const fs = require('fs').promises;
const morgan = require('morgan');
require('jsdom-global')();
global.DOMParser = window.DOMParser;
tmp.setGracefulCleanup();

if (['production', 'development', undefined].indexOf(process.env.NODE_ENV) === -1) {
  throw new Error('Expected NODE_ENV=production or NODE_ENV=development (default), got ' + process.env.NODE_ENV);
}
const production = process.env.NODE_ENV === 'production';

if (!config.email) {
  throw new Error('Expected config.json to have an email address.');
}

const app = express();
app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(expressStaticGzip('static', {
  enableBrotli: true,
  index: false,
  orderPreference: ['br', 'gz'],
}));
if (!production) {
  app.use(morgan('combined', {
    skip: function (req, res) {
      if (req.path === '/favicon.ico') return true;
      return res.statusCode < 400;
    },
  }));
}

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

if (!production) {
  app.post('/log_debug_error', (req, res) => {
    let {message, source, lineno, colno, stack} = req.body;
    let where = source ? ` at ${source}:${lineno}:${colno}` : '';
    console.error(`Frontend error${where}: ${message}\n${stack}`);
    res.sendStatus(200);
  });
}

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
        <script>
          var params = ${JSON.stringify({
            emailCharCodes: config.email.split('').map(c => c.charCodeAt(0)),
          })};
        </script>
        ${production ? [] : html`
          <h2>
            <font color="red">Internal: recording activity and errors</font>
          </h2>
          <script>
            window.onerror = function(message, source, lineno, colno, error) {
              try {
                fetch('/log_debug_error', {
                  method: 'POST',
                  referrer: 'no-referrer',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    message, source, lineno, colno,
                    stack: error.stack,
                  }),
                });
              } catch (e) {}
            };
            window.onunhandledrejection = function(event) {
              var e = (event || {}).reason || {message: event + ''};
              try {
                fetch('/log_debug_error', {
                  method: 'POST',
                  referrer: 'no-referrer',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    message: (e.name || 'Error') + ': ' + (e.message || ''),
                    source: e.fileName,
                    lineno: e.lineNumber,
                    colno: e.columnNumber,
                    stack: e.stack,
                  }),
                }).catch(function() {});
              } catch (e) {}
            };
          </script>
        `}
        <script src="/main.bundle.js"></script>

        ${renderFooter({html})}
      </body>
    </html>
  `).pipe(res);
});

app.post('/nonce', asyncHandler(async (req, res) => {
  let nonce = base52.encode(192 / 8, nacl.randomBytes(192 / 8));

  // Usually < 30 seconds, as it's javascript doing the request.
  await db.query(`
    INSERT INTO nonces(nonce, delete_at)
      VALUES($1, now() + INTERVAL '24 hours')`,
    [nonce]);

  res.json({nonce});
}));

app.post('/captions/:captionsId', asyncHandler(async (req, res) => {
  // Validate this request:
  let {captionsId} = req.params;
  let {
    pubkeys,
    nonce,
    nonceSignature,
    lastHash,
    lastHashSignature,
    encrypted,
    encryptedSignature,
    readerFingerprint,
    readerFingerprintSignature,
  } = req.body;

  // First, check nonce:
  let cur = await db.query(`
    DELETE FROM nonces AS t
    WHERE t.nonce=$1
      AND t.delete_at > now()
  `, [nonce]);
  if (cur.rowCount !== 1) {
    res.sendStatus(404);
    return;
  }

  // Then, check captionsId:
  let public = WriterPublic.fromJSON(pubkeys);
  if (public.fingerprint !== captionsId) {
    res.sendStatus(400);
    return;
  }

  // Then, check signatures:
  public.verify(nonce, nonceSignature);
  if (lastHash !== undefined) {
    public.verify(lastHash, lastHashSignature);
  }
  public.verify(encrypted, encryptedSignature);
  public.verify(readerFingerprint, readerFingerprintSignature);

  // Handle new data:
  // This writer wants to publish the encrypted data now (within the last day or so).
  // TTL is hard-coded in main.js and below (twice).
  if (lastHash === undefined) {
    cur = await db.query(`
        INSERT INTO captions(write_fingerprint, read_fingerprint, pubkeys, encrypted_data, delete_at)
          VALUES($1, $2, $3, $4, now() + INTERVAL '30 days')
      `, [public.fingerprint, readerFingerprint, JSON.stringify(pubkeys), encrypted]);
    res.sendStatus(cur.rowCount === 1 ? 200 : 500);
    return;
  }

  // Handle overwrite:
  await db.withClient(async client => {
    if (!await verifyLastHash(client, public.fingerprint, lastHash, res)) {
      return;
    }

    // TTL is hard-coded in main.js and above.
    let cur = await client.query(`
      UPDATE captions AS t
      SET encrypted_data=$2, delete_at=now() + INTERVAL '30 days'
      WHERE t.write_fingerprint=$1
        AND t.delete_at > now()
    `, [public.fingerprint, encrypted]);
    res.sendStatus(cur.rowCount === 1 ? 200 : 500);
  });
}));
async function verifyLastHash(client, fingerprint, lastHash, res) {
  let cur = await client.query(`
    SELECT t.encrypted_data AS encrypted_data
    FROM captions AS t
    WHERE t.write_fingerprint=$1
      AND t.delete_at > now()
    LIMIT 2
  `, [fingerprint]);
  if (cur.rows.length === 0) {
    res.sendStatus(404);
    return false;
  }
  if (cur.rows.length > 1) {
    res.sendStatus(500);
    return false;
  }

  let expectedLastHash = hashUtf8(cur.rows[0].encrypted_data);
  if (lastHash !== expectedLastHash) {
    res.sendStatus(409);
    return false;
  }

  return true;
}

// Get captions by either the read or write fingerprints:
app.get('/captions/:captionsId', asyncHandler(async (req, res) => {
  let {captionsId} = req.params;
  // Get the captions tracks:
  let tracks = (await db.query(`
    SELECT t.pubkeys AS pubkeys, t.encrypted_data AS encrypted_data, t.popups>0 AS has_popups
    FROM captions AS t
    WHERE (t.write_fingerprint=$1 OR t.read_fingerprint=$1)
      AND t.delete_at > now()
    LIMIT 2
  `, [captionsId])).rows.map(({pubkeys, encrypted_data, has_popups}) => ({
    pubkeys: JSON.parse(pubkeys),
    encryptedData: encrypted_data,
    hasPopups: has_popups,
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

app.post('/add_popup', asyncHandler(async (req, res) => {
  let cur = await db.query(`
    UPDATE captions AS t
    SET popups=popups+1
    WHERE t.read_fingerprint=$1
      AND t.delete_at > now()
  `, [req.body.read_fingerprint]);

  res.sendStatus(cur.rowCount === 1 ? 200 : 500);
}));


app.post('/ytasr_proxy/:videoId', asyncHandler(async (req, res) => {
  // Validate this request:
  let {videoId} = req.params;
  let {
    nonce,
    pow,
  } = req.body;

  // First, check nonce:
  let cur = await db.query(`
    DELETE FROM nonces AS t
    WHERE t.nonce=$1
      AND t.delete_at > now()
  `, [nonce]);
  if (cur.rowCount !== 1) {
    res.sendStatus(404);
    return;
  }

  // Check videoId:
  if (!/^[0-9A-Za-z_-]{10}[048AEIMQUYcgkosw]$/.test(videoId)) {
    res.sendStatus(400);
    return;
  }

  // Verify the proof of work:
  try {
    await verifyAsync(nonce, /*iters=*/100, /*length=*/8192, pow);
  } catch (e) {
    if (e.message === 'PoW is invalid') {
      res.sendStatus(400);
      return;
    }
    throw e;
  }

  await tmp.withFile(async o => {
    let cmd = [
      './youtube_captions.py',
      'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId),
      o.path,
    ];
    if (!production) {
      console.log('running:', cmd);
    }
    let ytdl = spawn(cmd[0], cmd.slice(1), {stdio: production ? 'ignore' : 'inherit'});

    let timeout = setTimeout(function() {
      ytdl.kill();
      timeout = setTimeout(function() {
        timeout = null;
        ytdl.kill(9);
      }, 1000);
    }, 10 * 1000);

    let code = await new Promise(resolve => {
      ytdl.on('exit', (code, signal) => {
        if (timeout !== null) {
          clearTimeout(timeout);
        }

        resolve(code);
      });
    });

    if (code !== 0) {
      res.sendStatus(500);
      return;
    }

    let tracks = JSON.parse(await fs.readFile(o.path, {encoding: 'utf-8'}));
    tracks = tracks.map(({lang, url}) => ({lang, srv3Url: url}));
    res.json({tracks});
  });
}));

// Delete a specific captions:
app.delete('/captions/:captionsId', asyncHandler(async (req, res) => {
  // Validate this request:
  let {captionsId} = req.params;
  let {
    pubkeys,
    nonce,
    nonceSignature,
    lastHash,
    lastHashSignature,
  } = req.body;

  // First, check nonce:
  let cur = await db.query(`
    DELETE FROM nonces AS t
    WHERE t.nonce=$1
      AND t.delete_at > now()
  `, [nonce]);
  if (cur.rowCount !== 1) {
    res.sendStatus(404);
    return;
  }

  // Then, check captionsId:
  let public = WriterPublic.fromJSON(pubkeys);
  if (public.fingerprint !== captionsId) {
    res.sendStatus(400);
    return;
  }

  // Then, check signatures:
  public.verify(nonce, nonceSignature);
  if (lastHash !== undefined) {
    public.verify(lastHash, lastHashSignature);
  }

  // This writer wants to publish the encrypted data now (within the last day or so).
  // TTL is hard-coded in main.js.
  await db.withClient(async client => {
    if (lastHash !== undefined &&
        !await verifyLastHash(client, public.fingerprint, lastHash, res)) {
      return;
    }

    let cur = await db.query(`
      DELETE FROM captions AS t
      WHERE t.write_fingerprint=$1
        AND t.delete_at > now()
    `, [public.fingerprint]);
    res.sendStatus(cur.rowCount === 1 ? 200 : 500);
  });
}));

(async function() {
  try {
    await db.init();
    await db.updateSchema();
  } catch (e) {
    console.error('error initializing database', e);
    process.exit(1);
  }

  // GC old data every ~1 hour:
  (async function() {
    for (;;) {
      await db.gc();
      await new Promise(resolve => setTimeout(resolve, 1000 * 3600));
    }
  })();

  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`listening on port ${port}`);
  });
})();
