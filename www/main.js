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
import {decodeJson3FromJson, decodeJson3, decodeSrt, stripRaw} from 'ytcc2-captions';
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
let lastUpdate = {};
function updateDownload(type) {
  return function(e) {
    let update = editor.video.captions;
    if (lastUpdate[type] === update) {
      return;
    }
    lastUpdate[type] = update;

    let {videoId} = editor.video;
    let filename, buffer;
    if (type === 'srt') {
      buffer = editor.getSrtCaptions();
      filename = `${videoId}.srt`;
    } else if (type === 'json3') {
      buffer = editor.getJson3Captions();
      filename = `${videoId}.json3.json`;
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
    this.download = filename;
  };
};
let updateSrt = updateDownload('srt');
let updateJson3 = updateDownload('json3');

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
      } else if (file.name.toLowerCase().endsWith('.json')) {
        try {
          captions = stripRaw(decodeJson3(buffer));
        } catch (e) {
          console.error(e);
          alert('Error importing json3 file: ' + file.name);
        }
      } else {
        alert('File name must end with .srt or .json: ' + file.name);
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
        width: 640px;
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

    <ul class="toolbar">
      <li>
        <label>
          <input type="file"
            style="display: none;"
            accept=".srt,text/srt,.json,application/json"
            @change=${openFile}>
          <button @click=${function(e) {
            this.parentNode.querySelector('input').click();
          }}><span class="open-icon"></span>Open SRT/json3</button>
        </label>
      </li>

      <li>
        <span>
          <span class="save-icon"></span>Download
          <a download="subtitles.srt"
            @mousedown=${updateSrt}
            @click=${updateSrt}
            @focus=${updateSrt}
            @mouseover=${updateSrt}
            @contextmenu=${updateSrt}
            @render=${onRender(updateSrt)}
          >SRT</a>/<a download="subtitles.json3.json"
            @mousedown=${updateJson3}
            @click=${updateJson3}
            @focus=${updateJson3}
            @mouseover=${updateJson3}
            @contextmenu=${updateJson3}
            @render=${onRender(updateJson3)}
          >json3</a>
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
        <dialog class="fixed" @render=${registerDialog} style="width: 400px;">
          <h2><span class="publish-icon"></span>Publish</h2>
          Publish your captions so anyone can see them.<br>
          Making the video private or deleting it won't take the captions down.

          <form action="/publish" method="post" target="_blank" @submit=${function(e) {
            this.closest('dialog').close();
          }} class="publish-form">
            <input name="videoId" type="hidden" value=${params.videoId}>
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
                ${renderBrowser(html, `file:///receipt-${params.videoId}.html`, html`
                  file receipt
                `, {title: 'TODO'})}
              </details>

              <details>
                <summary><span class="preview-icon"></span>Preview cookie receipt</summary>
                ${renderBrowser(html, `${location.origin}/receipts?v=${params.videoId}`, html`
                  cookie receipt
                `, {title: 'TODO'})}
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
              <button @click=${function(e) {
                this.closest('dialog').close();
              }}><span class="cancel-icon"></span>Cancel</button>
            </div>
          </form>
        </dialog>
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

render(html`
  <header>
    <h1>Captions viewer</h1>
  </header>

  <nav>
    <style>
      ul.navbar {
        width: 640px;
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
        <a href="https://studio.youtube.com/video/${params.videoId}/translations" target="_blank"><span class="pencil-icon"></span>Edit captions in YouTube Studio</a>
      </li>

      <li>
        <a href="https://youtubexternalcc.netlify.app/video-player.html?videoID=${params.videoId}" target="_blank"><span class="pencil-icon"></span>Edit captions in youtubexternalcc</a>
      </li>

      <li>
        <a href="https://github.com/yingted/ytcc2/issues/new" target="_blank"><span class="bug-icon"></span>File a bug on GitHub</a>
      </li>
    </ul>
  </nav>

  <main>
    ${video.render()}
    <hr>
    ${until(renderEditorAndToolbar(), html`Loading captions...`)}
  </main>
`, document.body);
