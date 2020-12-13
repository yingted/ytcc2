export function myReceiptsText({html}) {
  return html`<style>.receipt-icon::before { content: "🧾"; }</style><span class="receipt-icon"></span>My receipts`;
}
export function myReceiptsLink({html}) {
  return html`<a href="${location.origin}/receipts">${myReceiptsText({html})}</a>`;
}

/**
 * Render a receipt.
 * @param {function} html html literal
 * @param {string} videoId
 * @param {string} language
 * @param {string} captionId
 * @param {string} password
 * @param {boolean} isFile
 * @returns {{title: string, body: TemplateResult}}
 */
function renderReceipt({html}, {videoId, language, captionId, password, isFile}) {
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
    <form>
      Thanks for publishing captions.<br>
      This is your receipt.<br>
      You need it to edit or delete your captions.

      <fieldset>
        <legend>Submission information</legend>

        <div><label>Video ID: <input name="v" value=${videoId} disabled></label></div>
        <div><label>Language: <input name="lang" value=${language} disabled></label></div>
        <div><label>Caption ID: <input name="id" value=${captionId} disabled></label></div>
        <div><label>Tracking number: <input name="password" value=${password} disabled></label></div>
      </fieldset>

      <fieldset>
        <legend>Actions</legend>

        <div>
          Captions:
          <a href="#" @click=${e => e.preventDefault()}><span class="view-icon"></span>View</a>
          <a href="#" @click=${e => e.preventDefault()}><span class="edit-icon"></span>Edit</a>
          <a href="#" @click=${e => e.preventDefault()}><span class="delete-icon"></span>Delete</a>
        </div>

        <div>
          Receipt:
          ${isFile ?
              html`
                <a href="#" @click=${e => e.preventDefault()}>Add to ${myReceiptsText({html})}</a>
              ` :
              html`
                <a href="#" @click=${e => e.preventDefault()}><span class="download-icon"></span>Download</a>
                <a href="#" @click=${e => e.preventDefault()}><span class="delete-icon"></span><span class="receipt-icon"></span>Delete</a>
              `}
        </div>
      </fieldset>
    </form>
  `;
}

export function renderFileReceipt({html}, {videoId, language, captionId, password}) {
  return {
    title: `Captions receipt: ${videoId} ${captionId}`,
    body: renderReceipt({html}, {
      videoId,
      language,
      captionId,
      password,
      isFile: true,
    }),
  };
}

export function renderCookieReceipts({html}, receipts) {
  return {
    title: `My receipts`,
    body: html`
      Your receipts:<br>
      <div style="border: 1px solid black;">
        ${receipts.map(({videoId, language, captionId, password}) =>
          renderReceipt({html}, {
            videoId,
            language,
            captionId,
            password,
            isFile: false,
          }))}
      </div>
    `,
  };
}
