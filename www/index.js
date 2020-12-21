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
const upload = multer();
const {sign_open} = require('tweetnacl-ts');

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
}))

function asyncHandler(handler) {
  return function(req, res) {
    handler.apply(this, arguments).catch(function(e) {
      console.error('error', e);
      res.sendStatus(500);
    });
  }
}

// Copied from receipts.js due to es6 modules.
function myReceiptsText({html}) {
  return html`<style>.receipt-icon::before { content: "🧾"; }</style><span class="receipt-icon"></span>My receipts`;
}
function myReceiptsLink({html}) {
  return html`<a href="/receipts">${myReceiptsText({html})}</a>`;
}

/**
 * Get the YouTube video ID or null.
 * This function does not reference any external values, so we can directly inline it.
 * @param {string} value the URL
 * @returns {string|null}
 */
function getVideoIdOrNull(value) {
  // Detect plain video ID heuristically.
  // https://webapps.stackexchange.com/a/101153
  if (/^[0-9A-Za-z_-]{10}[048AEIMQUYcgkosw]$/.test(value)) {
    return value;
  }

  // Get the URL:
  var url;
  try {
    url = new URL(value);
  } catch (e) {
    try {
      url = new URL('https://' + value);
    } catch (e) {
      return null;
    }
  }
  if (url === null) return null;

  try {
    if ((url.origin === 'https://www.youtube.com' || url.origin === 'http://www.youtube.com') && url.pathname === '/watch') {
      var vOrNull = new URLSearchParams(url.search).get('v');
      if (vOrNull != null) return vOrNull;
    } else if ((url.origin === 'https://youtu.be' || url.origin === 'http://youtu.be')) {
      return url.pathname.substring(1);
    }
  } catch (e) {
  }

  return null;
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
      </head>
      <body style="margin: 0 auto; max-width: 640px;">
        <style>
          :root {
            --touch-target-size: 48px;
          }
          .justice-icon::before {
            content: "⚖️";
          }
          .bug-icon::before {
            content: "🐛";
          }
        </style>

        <header>
          <style>
            h1 {
              font-size: 1.5em;
              padding: 0;
              margin: 0;
            }
          </style>
          <h1>Captions</h1>
          Edit, share, and review captions for YouTube videos.<br>
        </header>

        <nav>
          <script>
            ${getVideoIdOrNull.toString()}
            function updateValidity(v) {
              v.setCustomValidity(
                getVideoIdOrNull(v.value) == null ?
                'Please enter a valid YouTube URL.' :
                '');
            }
            function simplifyUrl(v) {
              updateValidity(v);
              var videoId = getVideoIdOrNull(v.value);
              if (videoId != null) {
                v.value = videoId;
              }
            }
          </script>
          <form class="nav-form" action="/watch" onsubmit="simplifyUrl(this.querySelector('input[name=v]'))">
            <style>
              .nav-form {
                margin: 0.5em 0;
              }
              .nav-form select,
              .nav-form input,
              .nav-form button {
                height: var(--touch-target-size);
              }
            </style>
            <label>YouTube URL:</label>
            <div style="display: flex;">
              <input name="v" style="display: inline-block; flex-grow: 1;"
                  placeholder="https://www.youtube.com/watch?v=gKqypLvwd70"
                  oninput="updateValidity(this)"
                  onchange="updateValidity(this)"
                  autofocus required spellcheck="false">
              <button>View captions</button>
            </div>
          </form>

          <ul>
            <li>${myReceiptsLink({html})}</li>
            <li><a href="/fake_receipt">Fake receipts</a></li>
            <li>
              <a href="https://github.com/yingted/ytcc2/issues/new"><span class="bug-icon"></span>Report an issue</a>
            </li>
            <li>
              <a href="/terms"><span class="justice-icon"><span>Terms of service</a>
            </li>
          </ul>
        </nav>
      </body>
    </html>
  `).pipe(res);
});

app.get('/terms', (req, res) => {
  renderToStream(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="referrer" content="no-referrer">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Terms of service</title>
      </head>
      <body style="margin: 0 auto; max-width: 640px;">
        <header>
          <style>
            h1 {
              font-size: 1.5em;
              padding: 0;
              margin: 0;
            }
            .bug-icon::before {
              content: "🐛";
            }
            header {
              margin-block-end: 0.5em;
            }
          </style>
          <h1>Terms of service</h1>
          Thanks for coming to read the terms of service.<br>
          If anything is wrong, please <a href="https://github.com/yingted/ytcc2/issues/new"><span class="bug-icon"></span>report an issue</a>.
        </header>

        <main>
          <h2>These terms</h2>
          <ul>
            <li>This website provides file sharing services for captions for YouTube videos.</li>
            <li>These terms may be updated at any time. For example, to add a legalese version.</li>
            <li>If you don't agree to them, don't use this website.</li>
            <li>You need to be at least 13 years old (16 in Europe), and also old enough to accept these terms.</li>
          </ul>

          <h2>Don't rely on this website</h2>
          <ul>
            <li>There is no guarantee this website can do anything useful, or does not do anything harmful.</li>
            <li>The website admin can change anything at any time.</li>
            <li>This website can have bugs, errors, omissions, and other problems.</li>
            <li>This website can be taken down, given to somebody else, or hacked at any time.</li>
          </ul>

          <h2>Uploading captions (Publish button)</h2>
          <ul>
            <li>Don't upload anything illegal. For example, violating copyright.</li>
            <li>Don't violate people's privacy, including your own.</li>
            <li>Keep the receipt so you can edit/delete your captions if you need to. (more below)</li>
            <li>Opening a captions file doesn't upload your captions.</li>
            <li>Uploading is optional. You can also save your captions to a file you can send privately.</li>
          </ul>

          <h2>Receipts</h2>
          <ul>
            <li>Receipts prove you uploaded the captions without revealing your real name or email.</li>
            <li>Don't give your receipts to people or websites you don't trust.</li>
            <li>Receipts let you edit or delete captions, which is important for your data rights. Keep them safe.</li>
            <li>
              If you lose your receipt, nobody can create a new receipt.
              You can ask the website admin to edit or delete captions for you, but you might need to prove your identity in real life.
            </li>
            <li>
              Cookie receipts are a convenience, to make it easier to exercise your data rights, but browsers sometimes erase cookies without asking.
              File receipts are more reliable because you can back them up.
            </li>
            <li>
              Cookie and file receipts stay on your computer, but this website can read cookie receipts at any time without asking.
              This is how the My receipts page works.
            </li>
            <li>
              The password field in the receipt is hidden to reduce the chance of phishing.
              Your browser and browser extensions can use the password.
              If you send your receipt to anyone, they can also use the password.
            </li>
            <li>
              You can make a fake receipt on <a href="/fake_receipt">/fake_receipt</a>.
              There are no guarantees about the fake receipt service.
            </li>
          </ul>

          <h2>Other people's videos, captions, and websites</h2>
          <ul>
            <li>This website is not responsible for other people's content.</li>
            <li>The captions viewer shows captions from YouTube and captions uploaded by other users.</li>
            <li>The captions viewer includes a YouTube video player, which plays YouTube videos from other users.</li>
            <li>This website has links to other websites, managed by other people.</li>
          </ul>

          <h2>Your copyrights</h2>
          <ul>
            <li>Only upload data you have copyright to.</li>
            <li>You give this website the right to publish your uploads forever, until you delete it.</li>
            <li>You need to keep your upload receipts to delete your uploads.</li>
            <li>Even if you delete your upload, someone else could have copied it.</li>
            <li>If someone else uploaded your stuff, contact the website to take it down.</li>
          </ul>

          <h2>This website's copyrights</h2>
          <ul>
            <li>The code for this website is <a href="https://github.com/yingted/ytcc2">available on GitHub</a>.</li>
            <li>The license is in the link.</li>
            <li>This website's copyrights don't apply to the embedded videos, uploaded captions, or other linked websites.</li>
          </ul>

          <h2>Your privacy</h2>
          <ul>
            <li>
              The /watch page sends data to YouTube.
              Playing the video enables YouTube tracking.
              You can still use the captions editor without playing the video.
            </li>
            <li>The rest of the site mostly avoids cookies. Expect lots of popups.</li>
            <li>The watch page uses your browser language to pick the captions to load and the language to publish in.</li>
            <li>Your receipts stay on your device.</li>
            <li>This website tracks receipts and knows when anyone edits/deletes captions, or show the receipt to it.</li>
            <li>Receipts are not linked to each other, but they are linked to the captions.</li>
          </ul>
        </main>
      </body>
    </html>
  `).pipe(res);
});

app.get('/watch', asyncHandler(async (req, res) => {
  let videoId = getVideoIdOrNull(req.query.v);

  // Validate the video ID:
  if (videoId === null) {
    res.status(400).type('text/plain').send('Invalid YouTube video URL: ' + req.query.v);
    return;
  }
  if (videoId !== req.query.v) {
    res.redirect(301, '/watch?v=' + encodeURIComponent(videoId));
    return;
  }

  // Get the captions tracks:
  let tracks = (await db.query(`
    SELECT t.captions_id AS captions_id, t.language AS language, t.srt AS srt
    FROM captions AS t
    WHERE t.video_id=$1
  `, [videoId])).rows.map(({captions_id, language, srt}) => ({
    captionsId: captions_id,
    language,
    srt,
  }));

  const params = {
    videoId,
    tracks,
  };

  renderToStream(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="referrer" content="no-referrer">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>View captions</title>
        <link rel="stylesheet" type="text/css" href="/dialog-polyfill/dialog-polyfill.css" />
      </head>
      <body style="margin: 0 auto; max-width: 640px;">
        <noscript>You need JavaScript to view this page.</noscript>
        <script>
          const params = ${JSON.stringify(params)};
        </script>
        <script src="/main.bundle.js"></script>
      </body>
    </html>
  `).pipe(res);
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
app.post('/publish', upload.none(), asyncHandler(async (req, res) => {
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
      let [removed] = this._shards.splice(this._shards.length - 1);
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
   * Removes a value.
   */
  remove(value) {
    for (let shard of this._shards) {
      shard.remove(value);
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
    nonces.remove(untrustedNonce);

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
app.post('/delete', signedHandler(asyncHandler(async (req, res, publicKey, params) => {
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
app.post('/replace', signedHandler(asyncHandler(async (req, res, publicKey, params) => {
  await db.withClient(async client => {
    // Parse the file:
    let {bytesBase64} = params;
    if (typeof bytesBase64 !== 'string') {
      res.sendStatus(400);
      return;
    }

    let buf = new Uint8Array(Buffer.from(bytesBase64, 'base64')).buffer;
    let captions;
    try {
      captions = decodeSrt(buf);
    } catch (e) {
      try {
        captions = stripRaw(decodeSrv3(buf));
      } catch (e) {
        try {
          captions = stripRaw(decodeJson3(buf));
        } catch (e) {
          res.sendStatus(400);
          return;
        }
      }
    }

    let srt = Buffer.from(encodeSrt(normalizeSrt(captions))).toString('utf8');

    // Get the IDs for the redirect.
    let {rows} = await client.query(`
      SELECT t.video_id AS video_id, t.captions_id AS captions_id
      FROM captions AS t
      WHERE t.public_key_base64=$1
    `, [publicKey]);
    if (rows.length > 1) {
      console.error('/replace affects', rows.length, 'rows');
      res.sendStatus(500);
      return;
    }
    if (rows.length === 0) {
      res.sendStatus(404);
      return;
    }
    let videoId = rows[0].video_id;
    let captionsId = rows[0].captions_id;

    // Find the caption whose key was provided:
    let cur = await client.query(`
      UPDATE captions AS t
      SET srt=$1
      WHERE t.public_key_base64=$2
    `, [srt, publicKey]);

    if (cur.rowCount === 0) {
      res.sendStatus(400);
      return;
    }
    if (cur.rowCount > 1) {
      console.error('/replace affected', cur.rowCount, 'rows');
    }

    res.redirect('/watch?v=' + encodeURIComponent(videoId) + '#id=' + encodeURIComponent(captionsId));
  });
})));

app.get('/receipts', (req, res) => {
  renderToStream(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="referrer" content="no-referrer">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My receipts</title>
      </head>
      <body style="margin: 0 auto; max-width: 640px;">
        <noscript>You need JavaScript to view this page.</noscript>
        <script src="/my_receipts.bundle.js"></script>
      </body>
    </html>
  `).pipe(res);
});

app.post('/add_receipt', (req, res) => {
  renderToStream(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="referrer" content="no-referrer">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Add receipt</title>
      </head>
      <body style="margin: 0 auto; max-width: 640px;">
        <noscript>You need JavaScript to view this page.</noscript>
        <script src="/my_receipts.bundle.js"></script>
      </body>
    </html>
  `).pipe(res);
});

(async function() {
  try {
    await db.init();
    await db.updateSchema();
  } catch (e) {
    console.error('error initializing database', e);
    process.exit(1);
  }

  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`listening on port ${port}`);
  });
})();
