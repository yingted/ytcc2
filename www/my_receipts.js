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

import {html, render} from 'lit-html';
import {ObjectUrl} from './object_url.js';
import {allCookies, renderCookieReceipts, addCookie, myReceiptsLink} from './receipt.js';
import {script} from './script_web.js';

switch (location.pathname) {
  case '/receipts': {
    let update = function update() {
      const receipts = allCookies();
      window.receipts = receipts;
      const objectUrls = receipts.map(receipt => new ObjectUrl());
      const {title, body} = renderCookieReceipts({html, script}, receipts, objectUrls, update);
      document.title = title;
      render(body, document.body);
    }

    window.addEventListener('storage', update);
    update();
    break;
  }
  case '/add_receipt': {
    let hash = location.hash;
    if (hash.startsWith('#')) {
      let params = Object.fromEntries(new URLSearchParams(hash.substring(1)).entries());
      let receipt = {
        origin: location.origin,
        videoId: params.v,
        captionsId: params.id,
        language: params.lang,
        secretKeyBase64: params.secretKeyBase64,
      };
      addCookie(receipt);
      render(html`
        <style>
          h1 {
            font-size: 1.5em;
            padding: 0;
            margin: 0;
          }
          h1 select {
            height: var(--touch-target-size);
          }
        </style>
        <h1>Receipt added</h1>
        See it in ${myReceiptsLink({html})}.
      `, document.body);
    }
    break;
  }
}
