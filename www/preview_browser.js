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
import {html as litHtml, render} from 'lit-html';

/**
 * Render a preview browser.
 * @param {function} html the html literal
 * @param {string} url the URL to show in the URL bar
 * @param {TemplateResult} body the document to render
 * @param {string|undefined} title the title
 * @returns {TemplateResult} a div with the preview browser
 */
export function renderBrowser({html}, {url, doc: {body, title}}) {
  title = title ?? url;
  return html`
    <div style="
        box-shadow: 0px 0px 5px 0;
        border: 1px solid black;">
      <style>
        .minimize-icon::before {
          content: "🗕";
        }
        .maximize-icon::before {
          content: "🗖";
        }
        .cancellation-icon::before {
          content: "🗙";
        }
      </style>
      <div style="display: flex; background-color: #ccc;">
        <div style="
            flex-grow: 1;
            min-width: 0;

            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;

            display: flex;
            align-items: center;
            ">
            <span class="maximize-icon"></span>${title}
        </div>
        
        <button type="button" disabled aria-hidden="true"><span class="minimize-icon"></span></button>
        <button type="button" disabled aria-hidden="true"><span class="maximize-icon"></span></button>
        <button type="button" disabled aria-hidden="true"><span class="cancellation-icon"></span></button>
      </div>
      <input value=${url} disabled aria-label="Address" style="width: 100%; box-sizing: border-box;">
      <div>
        ${body}
      </div>
    </div>
  `;
}

/**
 * Render a document.
 * @param {function} html the html literal
 * @param {TemplateResult} body the document to render
 * @param {string|undefined} title the title
 * @returns {TemplateResult} the HTML document
 */
export function renderDocumentString({html}, {body, title}) {
  // TODO: get rid of this hack
  console.assert(html === litHtml);
  let doc = new DOMParser().parseFromString(`
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="referrer" content="no-referrer">
      <title></title>
    </head>
    <body></body>
  </html>
  `, 'text/html');
  render(title, doc.querySelector('title'));
  render(body, doc.querySelector('body'));
  let clean = function clean(elt) {
    if (elt.nodeType === Node.COMMENT_NODE) {
      elt.remove();
      return;
    }
    Array.from(elt.childNodes).forEach(clean);
  };
  clean(doc.documentElement);
  return doc.documentElement.outerHTML;
}
