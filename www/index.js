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

app.get('/watch', (req, res) => {
  let videoId = req.query.v;
  const params = {
    videoId,
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
});


app.use(express.urlencoded({
  extended: true,
}))

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
function asyncHandler(handler) {
  return (req, res) => {
    handler(req, res).catch(e => {
      console.error('error', e);
      res.sendStatus(500);
    });
  }
}
app.post('/publish', upload.none(), asyncHandler(async (req, res) => {
  let {videoId, srtBase64, publicKeyBase64, language} = req.body;
  let srt = srtBase64ToSrt(srtBase64);

  let captionsId = secureRandomId();

  await db.query(`
    INSERT INTO captions(video_id, captions_id, srt, language, public_key_base64)
      VALUES($1, $2, $3, $4, $5)`,
    [videoId, captionsId, srt, language, publicKeyBase64]);

  res.json({captionsId});
}));

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
