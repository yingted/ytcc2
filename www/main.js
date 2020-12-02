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
import {listTracksYtinternal} from './youtube_captions.js';
import {onRender} from './util.js';

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
const asyncEditor = (async function makeAsyncEditor() {
  let track = getDefaultTrack(await listTracksYtinternal(params.videoId));
  if (track === null) {
    return new CaptionsEditor(video);
  } else {
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
      .link-icon::before {
        content: "🔗";
      }
      .sanitize-icon::before {
        content: "🧼";
      }
    </style>
    <!-- Open file -->
    <ul class="toolbar">
      <li>
        <label>
          <input type="file"
            style="display: none;"
            accept=".srt,text/srt,.json,application/json"
            @change=${function(e) {
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
                  editor.setCaptions(captions, /*addToHistory=*/true);
                }

                if (this.files === files) {
                  this.value = null;
                }
              });
            }}>
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
        <button @click=${e => editor.normalize()}><span class="sanitize-icon"></span>Sanitize</button>
      </li>
    </ul>
    ${editor.render()}
  `;
}

render(html`
  <h1>Captions editor: <code>${params.videoId}</code></h1>
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
    .open-icon::before {
      content: "📂";
    }
    .save-icon::before {
      content: "💾";
    }
    .link-icon::before {
      content: "🔗";
    }
    .sanitize-icon::before {
      content: "🧼";
    }
  </style>
  <nav>
    <ul class="navbar">
      <li>
        <a href="https://studio.youtube.com/video/${params.videoId}/translations" target="_blank"><span class="link-icon"></span>YouTube Studio</a>
      </li>
    </ul>
  </nav>
  ${video.render()}
  <hr>
  ${until(renderEditorAndToolbar(), html`Loading...`)}
`, document.body);
