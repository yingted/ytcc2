/**
 * Render a preview browser.
 * @param {function} html the html literal
 * @param {string} url the URL to show in the URL bar
 * @param {TemplateResult} body the document to render
 * @param {string|undefined} options.title the title
 */
export function renderBrowser(html, url, body, options) {
  options = options || {};
  let title = options.title ?? url;
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
        
        <button type="button" disabled><span class="minimize-icon"></span></button>
        <button type="button" disabled><span class="maximize-icon"></span></button>
        <button type="button" disabled><span class="cancellation-icon"></span></button>
      </div>
      <input value=${url} disabled style="width: 100%; box-sizing: border-box;">
      <div>
        ${body}
      </div>
    </div>
  `;
};
