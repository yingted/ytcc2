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
const { html, renderToStream } = require('@popeindustries/lit-html-server');

const app = express();
app.use(express.static('static'));

app.get('/watch', (req, res) => {
  let videoId = req.query.v;
  const params = {
    videoId,
  };
  renderToStream(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>View captions</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
app.post('/publish', (req, res) => {
  let {videoId, srtBase64, language, receipt} = req.body;
  /** @type {ArrayBuffer} */
  let srt = new Uint8Array(Buffer.from(srtBase64, 'base64')).buffer;
  // TODO
  res.set({'content-type': 'text/plain'}).send(
`Submission received:
videoId: ${videoId}
srt: ${srt.byteLength} bytes
language: ${language}
receipt: ${receipt}
`);
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
