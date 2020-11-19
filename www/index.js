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

app.get('/', (req, res) => {
  const params = {
    video: req.query.video,
    captions:
      require('fs').readFileSync(
        process.env.HOME + '/Downloads/BbqPe-IceP4.en.json3',
        {encoding: 'utf-8'}),
  };
  renderToStream(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Captions editor</title>
        <meta name="viewport" content="width=640">
      </head>
      <body style="margin: 0;">
        <noscript>You need JavaScript to view this page.</noscript>
        <script>
          const params = ${JSON.stringify(params)};
        </script>
        <script src="/main.bundle.js"></script>
      </body>
    </html>
  `).pipe(res);
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
