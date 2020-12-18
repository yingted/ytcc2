import {receiptEmbeddedJavascript} from './gen/receipt_embedded_javascript.js';
import {renderDocumentString} from './preview_browser.js';

export function myReceiptsText({html}) {
  return html`<style>.receipt-icon::before { content: "🧾"; }</style><span class="receipt-icon"></span>My receipts`;
}
export function myReceiptsLink({html}) {
  return html`<a href="/receipts">${myReceiptsText({html})}</a>`;
}

export function renderFileReceiptString({html, script}, {videoId, language, captionsId, secretKeyBase64}) {
  return renderDocumentString(
    {html},
    renderFileReceipt(
      {html, script},
      {videoId, language, captionsId, secretKeyBase64}));
}

/**
 * Render a receipt.
 * @param {function} html html literal
 * @param {function} script script tag
 * @param {string} videoId
 * @param {string} language
 * @param {string} captionsId
 * @param {string} secretKeyBase64
 * @param {string} type 'cookie', 'file', or 'combined'
 * @param {ObjectUrl} objectUrl
 * @returns {{title: string, body: TemplateResult}}
 */
function renderReceipt({html, script}, {videoId, language, captionsId, secretKeyBase64, type, objectUrl}) {
  let receipt = {videoId, language, captionsId, secretKeyBase64, type};
  let blobUrl = '';
  if (type === 'cookie' || type === 'combined') {
    let file = renderFileReceiptString({html, script}, {videoId, language, captionsId, secretKeyBase64});
    blobUrl = objectUrl.create({}, () => new Blob([file]));
  }
  return html`
    <style>
      .edit-icon::before {
        content: "✏️";
      }
      .delete-icon::before {
        content: "🗑️";
      }
      .cookie-icon::before {
        content: "🍪";
      }
      .download-icon::before {
        content: "📥";
      }
      .receipt-icon::before {
        content: "🧾";
      }
    </style>
    <form onsubmit="event.preventDefault()">
      Thanks for publishing captions.<br>
      This is your receipt.<br>
      You need it to edit or delete your captions.

      <fieldset>
        <legend>Submission information</legend>

        <div><label>Origin: <input name="origin" value=${location.origin} disabled></label></div>
        <div><label>Video ID: <input name="v" value=${videoId} disabled></label></div>
        <div><label>Language: <input name="lang" value=${language} disabled></label></div>
        <div><label>Caption ID: <input name="id" value=${captionsId} disabled></label></div>
        <div><label>Password: <input name="secretKeyBase64" type="password" value=${secretKeyBase64} disabled></label></div>
      </fieldset>

      <fieldset>
        <legend>Actions</legend>

        <div>
          Captions:
          <a href="${location.origin}/watch?v=${videoId}&id=${captionsId}"><span class="view-icon"></span>View</a>
          <a class="receipt-captions-edit-link" href="javascript:"><span class="edit-icon"></span>Edit</a>
          <a class="receipt-captions-delete-link" href="javascript:"><span class="delete-icon"></span>Delete</a>
        </div>

        <div>
          Receipt:
          ${type === 'file' || type === 'combined' ?
              html`
                <a class="receipt-cookie-import-link" href="javascript:">Add to ${myReceiptsText({html})}</a>
              ` : []}
          ${type === 'cookie' || type === 'combined' ?
              html`
                <a href=${blobUrl} download="receipt-${videoId}.html"><span class="download-icon"></span>Download</a>
                <button type="button" @click=${e => deleteCookie(receipt)}><span class="delete-icon"></span><span class="receipt-icon"></span>Delete</button>
              ` : []}
        </div>

        <div>
          <label>
            Show your receipt to a website (advanced):<br>
            <input type="url" name="target" value="${location.origin}/find_receipt">
          </label>
          <button class="receipt-show-button" type="button">Show receipt</button>
        </div>
      </fieldset>
      ${script(receiptEmbeddedJavascript)}
    </form>
  `;
}

export function renderFileReceipt({html, script}, {videoId, language, captionsId, secretKeyBase64}) {
  return {
    title: `Captions receipt: ${videoId} ${captionsId}`,
    body: renderReceipt({html, script}, {
      videoId,
      language,
      captionsId,
      secretKeyBase64,
      type: 'file',
    }),
  };
}

export function renderCookieReceipts({html, script}, receipts, objectUrl) {
  return {
    title: `My receipts`,
    body: html`
      Your receipts:<br>
      <div style="border: 1px solid black;">
        ${receipts.map(({videoId, language, captionsId, secretKeyBase64}) =>
          renderReceipt({html, script}, {
            videoId,
            language,
            captionsId,
            secretKeyBase64,
            type: 'cookie',
            objectUrl,
          }))}
      </div>
    `,
  };
}

export function renderCombinedReceipt({html, script}, {videoId, language, captionsId, secretKeyBase64}) {
  return renderReceipt({html, script}, {
    videoId,
    language,
    captionsId,
    secretKeyBase64,
    type: 'combined',
  });
}

function receiptKey(videoId, captionsId) {
  let usp = new URLSearchParams({
    type: 'receipt',
    videoId,
    captionsId,
  });
  usp.sort();
  return usp.toString();
}

export function addCookie(receipt) {
  localStorage.setItem(
    receiptKey(receipt.videoId, receipt.captionsId),
    JSON.stringify(receipt));
}

export function deleteCookie(receipt) {
  localStorage.deleteItem(
    receiptKey(receipt.videoId, receipt.captionsId));
}
