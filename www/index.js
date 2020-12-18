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
  debugger;
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
app.post('/publish', (req, res) => {
  let {videoId, srtBase64, publicKeyBase64, language, receipt} = req.body;
  let srt = srtBase64ToSrt(srtBase64);
  // TODO
  res.set({'content-type': 'text/plain'}).send(
`Submission received:
videoId: ${videoId}
srt: ${srt.length} bytes
language: ${language}
receipt: ${receipt}
publicKeyBase64: ${publicKeyBase64}
`);
});

(async function() {
  await db.init();

  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`listening on port ${port}`);
  });
})();
