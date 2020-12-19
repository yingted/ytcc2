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
const {decodeSrt, normalizeSrt, encodeSrt} = require('ytcc2-captions');
const db = require('./db');
const config = require('./config');
const crypto = require('crypto');
const multer  = require('multer');
const upload = multer();

if (['production', 'development', undefined].indexOf(process.env.NODE_ENV) === -1) {
  throw new Error('Expected NODE_ENV=production or NODE_ENV=development (default), got ' + process.env.NODE_ENV);
}
const production = process.env.NODE_ENV === 'production';

const app = express();
app.use(expressStaticGzip('static', {
  enableBrotli: true,
  index: false,
  orderPreference: ['br', 'gz'],
}));
app.use(express.urlencoded({
  extended: true,
}))

function asyncHandler(handler) {
  return (req, res) => {
    handler(req, res).catch(e => {
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
        <main>
        </main>
      </body>
    </html>
  `).pipe(res);
});

app.get('/watch', asyncHandler(async (req, res) => {
  let videoId = getVideoIdOrNull(req.query.v);
  let captionsId = req.query.id;

  // Validate the video ID:
  if (videoId === null) {
    res.status(400).type('text/plain').send('Invalid YouTube video URL: ' + req.query.v);
    return;
  }
  if (videoId !== req.query.v) {
    let params = {v: videoId};
    if (captionsId != null) {
      params.captionsId = captionsId;
    }
    res.redirect(301, '/watch?' + new URLSearchParams(params).toString());
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
    captionsId,
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
