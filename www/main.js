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
import {YouTubeVideo} from './youtube.js';
import {CaptionsEditor} from './editor.js';
import {decodeJson3, decodeSrt, stripRaw} from 'ytcc2-captions';

// const video = new YouTubeVideo('gKqypLvwd70');
const video = new YouTubeVideo('BbqPe-IceP4');
const editor = new CaptionsEditor(video, stripRaw(decodeJson3(params.captions)));

// For debugging:
window.video = video;
window.editor = editor;

// Remove noscript:
Array.from(document.getElementsByTagName('noscript')).forEach(noscript => {
  noscript.parentNode.removeChild(noscript);
});

let objectUrls = new Set();
function updateDownload(type) {
  return function(e) {
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
    if (objectUrls.has(this.href)) {
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

render(html`
  ${video.render()}
  <hr>
  <div style="width: 640px;" class="toolbar">
    <style>
      .open-icon::before {
        content: "📂";
      }
      .save-icon::before {
        content: "💾";
      }
    </style>

    <!-- Open file -->
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

    <span>
      <span class="save-icon"></span>Download
      <a href="#" download="subtitles.srt"
        @mousedown=${updateSrt}
        @click=${updateSrt}
        @focus=${updateSrt}
        @mouseover=${updateSrt}
        @contextmenu=${updateSrt}
      >SRT</a>/<a
        href="#" download="subtitles.json3.json"
        @mousedown=${updateJson3}
        @click=${updateJson3}
        @focus=${updateJson3}
        @mouseover=${updateJson3}
        @contextmenu=${updateJson3}
      >json3</a>
    </span>
  </div>
  ${editor.render()}
`, document.body);
