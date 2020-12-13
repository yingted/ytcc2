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
import {until} from 'lit-html/directives/until.js';
import {YouTubeVideo} from './youtube.js';
import {CaptionsEditor} from './editor.js';
import {decodeJson3FromJson, decodeSrv3, decodeSrt, stripRaw} from 'ytcc2-captions';
import {listTracks} from './youtube_captions.js';
import {onRender} from './util.js';
import dialogPolyfill from 'dialog-polyfill';
import {youtubeLanguages} from './gen/youtube_languages.js';
import {renderBrowser} from './preview_browser.js';

const video = new YouTubeVideo(params.videoId);

/**
 * Get the default track based on navigator.language.
 * @param {array<Track>} tracks
 * @returns {Track|null}
 */
function getDefaultTrack(tracks) {
  let languages = [navigator.language];
  if (/-/.test(navigator.language)) {
    languages.push(navigator.language.replace(/-.*/, ''));
  }
  for (let language of languages) {
    for (let track of tracks) {
      if (track.lang === language) return track;
    }
  }
  if (tracks.length > 0) return tracks[0];
  return null;
}
window.language = 'en';
const asyncEditor = (async function makeAsyncEditor() {
  let track = getDefaultTrack(await listTracks(params.videoId));
  if (track === null) {
    return new CaptionsEditor(video);
  } else {
    window.language = track.lang;
    return new CaptionsEditor(video, stripRaw(decodeJson3FromJson(await track.fetchJson3())));
  }
})();

// For debugging:
window.video = video;
window.editor = null;
asyncEditor.then(editor =>
  window.editor = editor);

// Remove noscript:
Array.from(document.getElementsByTagName('noscript')).forEach(noscript => {
  noscript.parentNode.removeChild(noscript);
});

let objectUrls = new Set();
function updateDownload(type) {
  let lastUpdate = null;
  return function(e) {
    let update = editor.video.captions;
    if (lastUpdate === update) {
      return;
    }
    lastUpdate = update;

    let {videoId} = editor.video;
    let buffer;
    if (type === 'srt') {
      buffer = editor.getSrtCaptions();
    } else if (type === 'srv3') {
      buffer = editor.getSrv3Captions();
    } else {
      return;
    }

    // Clear the href:
    if (this.href && objectUrls.has(this.href)) {
      URL.revokeObjectURL(this.href);
      objectUrls.delete(this.href);
    }

    this.href = URL.createObjectURL(new Blob([buffer]));
    objectUrls.add(this.href);
  };
};
let updateSrt = updateDownload('srt');
let updateSrv3 = updateDownload('srv3');

async function renderEditorAndToolbar() {
  let editor = await asyncEditor;
  let openFile = function openFile(e) {
    let files = this.files;
    if (files.length !== 1) return;
    let [file] = files;
    file.arrayBuffer().then(buffer => {
      let captions = null;

      if (file.name.toLowerCase().endsWith('.srt')) {
        try {
          captions = decodeSrt(buffer);
        } catch (e) {
          console.error(e);
          alert('Error importing SRT file: ' + file.name);
        }
      } else if (file.name.toLowerCase().endsWith('.xml')) {
        try {
          captions = stripRaw(decodeSrv3(buffer));
        } catch (e) {
          console.error(e);
          alert('Error importing srv3 file: ' + file.name);
        }
      } else {
        alert('File name must end with .srt or .xml: ' + file.name);
      }

      if (captions !== null) {
        editor.setCaptions(captions, /*addToHistory=*/true, /*isSaved=*/true);
      }

      if (this.files === files) {
        this.value = null;
      }
    });
  };
  return html`
    <style>
      ul.toolbar {
        width: 100%;
        min-width: 0;
        list-style-type: none;
        padding: 0;
        margin: 0 0 0 -1em;
      }
      ul.toolbar > li {
        display: inline-block;
        margin: 0 0 0 1em;
      }
      .open-icon::before {
        content: "📂";
      }
      .save-icon::before {
        content: "💾";
      }
      .sanitize-icon::before {
        content: "🧼";
      }
      .publish-icon::before {
        content: "🌐";
      }
      .cancel-icon::before {
        content: "❌";
      }
      .add-icon::before {
        content: "➕";
      }
      .preview-icon::before {
        content: "🔍";
      }
    </style>

    <ul class="toolbar" aria-label="Toolbar">
      <li>
        <label>
          <input type="file"
            style="display: none;"
            accept=".srt,text/srt,.xml,application/xml"
            @change=${openFile}>
          <button @click=${function(e) {
            this.parentNode.querySelector('input').click();
          }}><span class="open-icon"></span>Open</button>
        </label>
      </li>

      <li>
        <span>
          <span class="save-icon"></span>Save <a
            @mousedown=${updateSrv3}
            @click=${updateSrv3}
            @focus=${updateSrv3}
            @mouseover=${updateSrv3}
            @contextmenu=${updateSrv3}
            @render=${onRender(updateSrv3)}
            download="${params.videoId}.srv3.xml"
            aria-label="SRV3 file"
          >.srv3.xml</a>/<a
            @mousedown=${updateSrt}
            @click=${updateSrt}
            @focus=${updateSrt}
            @mouseover=${updateSrt}
            @contextmenu=${updateSrt}
            @render=${onRender(updateSrt)}
            download="${params.videoId}.srt"
            aria-label="SRT file"
          >.srt</a>
        </span>
      </li>

      <li>
        <button @click=${e => {
          editor.addCue(video.getCurrentTime(), '');
          editor.view.focus();
        }}><span class="add-icon"></span>Add cue</button>
      </li>

      <li>
        <button @click=${e => editor.normalize()}><span class="sanitize-icon"></span>Sanitize</button>
      </li>

      <li>
        ${renderPublishDialog()}
        <button @click=${function(e) {
          let dialog = this.parentElement.querySelector('dialog');
          dialog.showModal();
        }}><span class="publish-icon"></span>Publish</button>
      </li>
    </ul>
    ${editor.render()}
  `;
}

let registerDialog = onRender(function() {
  dialogPolyfill.registerDialog(this);
});

function renderReceipt(videoId, language, captionId, password, isFile) {
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
    </style>
    <form>
      Thanks for publishing captions.<br>
      This is your receipt.<br>
      You need it to edit/delete your captions.

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
                <a href="#" @click=${e => e.preventDefault()}><span class="cookie-icon"></span>Add to cookie</a>
              ` :
              html`
                <a href="#" @click=${e => e.preventDefault()}><span class="download-icon"></span>Download</a>
                <a href="#" @click=${e => e.preventDefault()}><span class="delete-icon"></span><span class="cookie-icon"></span>Delete</a>
              `}
        </div>
      </fieldset>
    </form>
  `;
}

function arrayBufferToBase64(buffer) {
  let latin1 = [];
  for (let c of new Uint8Array(buffer)) {
    latin1.push(String.fromCharCode(c));
  }
  return window.btoa(latin1.join(''));
}

function renderPublishDialog() {
  return html`
    <dialog class="fixed" @render=${registerDialog} style="
        width: 25em;
        max-width: 100%;
        max-height: 100%;
        box-sizing: border-box;
        overflow-y: auto;">
      <h2><span class="publish-icon"></span>Publish</h2>
      Publish your captions so anyone can see them.<br>
      Making the video private or deleting it won't take the captions down.

      <form action="/publish" method="post" @submit=${function(e) {
        this.closest('dialog').close();
      }} class="publish-form">
        <input name="videoId" type="hidden" value=${params.videoId}>
        <input name="srtBase64" type="hidden" value=${arrayBufferToBase64(editor.getNormalizedSrtCaptions())}>
        <style>
          .publish-input-group {
            padding: 0.2em 0;
          }
          .publish-form > fieldset {
            width: 100%;
            min-width: 100%;
            box-sizing: border-box;
          }
        </style>

        <fieldset>
          <legend>Language</legend>
          <label>
            What language are these captions?
            <div>
              <select name="language">
                ${youtubeLanguages.map(({id, name}) => html`
                  <option value=${id} ?selected=${id === window.language}>${name}</option>
                `)}
              </select>
            </div>
          </label>
        </fieldset>

        <fieldset>
          <legend><span class="sanitize-icon"></span>Sanitization</legend>
          Remove hidden data to protect reviewers.

          <div>
            <label>
              <input type="checkbox" checked required disabled>
              Remove karaoke (paint-on) animations.
            </label>
          </div>
          <div>
            <label>
              <input type="checkbox" checked required disabled>
              Remove text before the first timestamp.
            </label>
          </div>
          <div>
            <label>
              <input type="checkbox" checked required disabled>
              Prefer well-formed HTML tags.
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Receipt</legend>
          Where would you like to save your receipt?<br>
          You need your receipt to edit or delete your captions.<br>
          You can change your mind later.

          <details>
            <summary><span class="preview-icon"></span>Preview file receipt</summary>
            ${renderBrowser(html, `file:///receipt-${params.videoId}.html`,
              renderReceipt(params.videoId, '??', '###', '#############', true),
              {title: `Captions receipt: ${params.videoId} ###`})}
          </details>

          <details>
            <summary><span class="preview-icon"></span>Preview cookie receipt</summary>
            ${renderBrowser(html, `${location.origin}/receipts?v=${params.videoId}`,
              html`
                Your receipts:<br>
                <div style="border: 1px solid black;">
                  ${renderReceipt(params.videoId, '??', '###', '#############', false)}
                </div>
              `,
              {title: `Captions receipt: ${params.videoId}`})}
          </details>

          <div>
            <label>
              <input type="radio" id="publish-receipt" name="receipt" value="file-and-cookie" required>
              File and cookie
            </label>
          </div>
          <div>
            <label>
              <input type="radio" id="publish-receipt" name="receipt" value="file" required>
              File only
            </label>
          </div>
          <div>
            <label>
              <input type="radio" id="publish-receipt" name="receipt" value="cookie" required>
              Cookies only
            </label>
          </div>
        </fieldset>

        <!-- Publish | Cancel -->
        <div class="publish-input-group">
          <button type="submit"><span class="publish-icon"></span>Publish</button>
          <button type="button" @click=${function(e) {
            this.closest('dialog').close();
          }}><span class="cancel-icon"></span>Cancel</button>
        </div>
      </form>
    </dialog>
  `;
}

render(html`
  <header>
    <style>
      h1 {
        font-size: 1.5em;
        font-weight: normal;
        margin-block-start: 0.1em;
        margin-block-end: 0.1em;
      }
    </style>
    <h1>View captions</h1>
  </header>

  <nav>
    <style>
      ul.navbar {
        width: 100%;
        min-width: 0;
        list-style-type: none;
        padding: 0;
        margin: 0 0 0 -1em;
      }
      ul.navbar > li {
        display: inline-block;
        margin: 0 0 0 1em;
      }
      .pencil-icon::before {
        content: "✏️";
      }
      .bug-icon::before {
        content: "🐛";
      }
    </style>
    <ul class="navbar">
      <li>
        <a href="https://studio.youtube.com/video/${params.videoId}/translations"
            aria-label="Edit in YouTube Studio">
          <span class="pencil-icon"></span>
          <svg viewBox="0 4 24 16" style="height: 1em; display: inline; vertical-align: text-bottom;">
            <path fill="red" d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"></path>
          </svg>
          Studio
        </a>
      </li>

      <li>
        <a href="https://youtubexternalcc.netlify.app/video-player.html?videoID=${params.videoId}"
            aria-label="Edit in youtube external cc"><span class="pencil-icon"></span>youtubexternalcc</a>
      </li>

      <li>
        <a href="https://github.com/yingted/ytcc2/issues/new"
            aria-label="Report bug on GitHub"><span class="bug-icon"></span>Report bug</a>
      </li>
    </ul>
  </nav>

  <main>
    ${video.render()}
    <hr>
    ${until(renderEditorAndToolbar(), html`Loading captions...`)}
  </main>
`, document.body);
