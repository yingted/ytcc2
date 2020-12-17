import {receiptEmbeddedJavascript} from './gen/receipt_embedded_javascript.js';
import {deleteReceipt} from './cookies.js';

export function myReceiptsText({html}) {
  return html`<style>.receipt-icon::before { content: "🧾"; }</style><span class="receipt-icon"></span>My receipts`;
}
export function myReceiptsLink({html}) {
  return html`<a href="/receipts">${myReceiptsText({html})}</a>`;
}

/**
 * Render a receipt.
 * @param {function} html html literal
 * @param {function} script script tag
 * @param {string} videoId
 * @param {string} language
 * @param {string} captionId
 * @param {string} secretKeyBase64
 * @param {boolean} isFile
 * @returns {{title: string, body: TemplateResult}}
 */
function renderReceipt({html, script}, {videoId, language, captionId, secretKeyBase64, isFile}) {
  let receipt = {videoId, language, captionId, secretKeyBase64, isFile};
  let blobUrl = '';
  if (!isFile) {
    let file = renderReceipt({html, script}, {videoId, language, captionId, secretKeyBase64, isFile: true});
    // TODO: release
    blobUrl = URL.createObjectURL(new Blob([file]));
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
        <div><label>Caption ID: <input name="id" value=${captionId} disabled></label></div>
        <div><label>Password: <input name="secretKeyBase64" type="password" value=${secretKeyBase64} disabled></label></div>
      </fieldset>

      <fieldset>
        <legend>Actions</legend>

        <div>
          Captions:
          <a href="${location.origin}/watch?v=${videoId}&id=${captionId}"><span class="view-icon"></span>View</a>
          <a class="receipt-captions-edit-link" href="javascript:"><span class="edit-icon"></span>Edit</a>
          <a class="receipt-captions-delete-link" href="javascript:"><span class="delete-icon"></span>Delete</a>
        </div>

        <div>
          Receipt:
          ${isFile ?
              html`
                <a class="receipt-cookie-import-link" href="javascript:">Add to ${myReceiptsText({html})}</a>
              ` :
              html`
                <a class="receipt-cookie-export-link" href=${blobUrl} download="receipt-${videoId}.html"><span class="download-icon"></span>Download</a>
                <a class="receipt-cookie-delete-link" href="javascript:" @click=${e => deleteReceipt(receipt)}><span class="delete-icon"></span><span class="receipt-icon"></span>Delete</a>
              `}
        </div>
      </fieldset>
      ${script(receiptEmbeddedJavascript)}
    </form>
  `;
}

export function renderFileReceipt({html, script}, {videoId, language, captionId, secretKeyBase64}) {
  return {
    title: `Captions receipt: ${videoId} ${captionId}`,
    body: renderReceipt({html, script}, {
      videoId,
      language,
      captionId,
      secretKeyBase64,
      isFile: true,
    }),
  };
}

export function renderCookieReceipts({html, script}, receipts) {
  return {
    title: `My receipts`,
    body: html`
      Your receipts:<br>
      <div style="border: 1px solid black;">
        ${receipts.map(({videoId, language, captionId, secretKeyBase64}) =>
          renderReceipt({html, script}, {
            videoId,
            language,
            captionId,
            secretKeyBase64,
            isFile: false,
          }))}
      </div>
    `,
  };
}
