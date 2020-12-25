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

// This needs dialog-polyfill.css.

import {html, render} from 'lit-html';
import {until} from 'lit-html/directives/until.js';
import {live} from 'lit-html/directives/live.js';
import {ifDefined} from 'lit-html/directives/if-defined.js';
import {asyncReplace} from 'lit-html/directives/async-replace.js';
import {YouTubeVideo} from './youtube.js';
import {CaptionsEditor, captionsToText, captionsFromText} from './editor.js';
import {listTracks, getDefaultTrack} from './youtube_captions.js';
import {onRender, render0, AsyncRef, Signal} from './util.js';
import dialogPolyfill from 'dialog-polyfill';
import {youtubeLanguages} from './gen/youtube_languages.js';
import {renderBrowser} from './preview_browser.js';
import {myReceiptsText, myReceiptsLink, renderFileReceipt, renderCookieReceipts, addCookie, renderFileReceiptString} from './receipt.js';
import {sign_keyPair} from 'tweetnacl-ts';
import {script} from './script_web.js';
import {ObjectUrl} from './object_url.js';
import {fetchCaptions, makeFileInput, HomogeneousTrackPicker, CaptionsPicker, UnofficialTrack} from './track_picker.js';
import {revertString} from 'codemirror-next-merge';
import {ChangeSet, tagExtension} from '@codemirror/next/state';
import {unfoldAll, foldAll} from '@codemirror/next/fold';
import {renderFooter} from './templates.js';
import {Html5Video, DummyVideo} from './video.js';

// Browser workarounds:
// Remove noscript:
Array.from(document.getElementsByTagName('noscript')).forEach(noscript => {
  noscript.parentNode.removeChild(noscript);
});
// Dialogs need this as @render:
let registerDialog = onRender(function() {
  dialogPolyfill.registerDialog(this);
});

// YT logo:
const youtubeLogo = html`
  <svg viewBox="0 4 24 16" style="height: 1em; display: inline; vertical-align: text-bottom;">
    <path fill="red" d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"></path>
  </svg>
`;

/**
 * Get the YouTube video ID or null.
 * This function does not reference any external values, so we can directly inline it.
 * @param {string} value the URL
 * @returns {string|null}
 */
function getVideoIdOrNull(value) {
  // Detect plain video ID heuristically.
  // https://webapps.stackexchange.com/a/101153
  if (/^[0-9A-Za-z_-]{10}[048AEIMQUYcgkosw]$/.test(value)) {
    return value;
  }

  // Get the URL:
  var url;
  try {
    url = new URL(value);
  } catch (e) {
    try {
      url = new URL('https://' + value);
    } catch (e) {
      return null;
    }
  }
  if (url === null) return null;

  try {
    if ((url.origin === 'https://www.youtube.com' || url.origin === 'http://www.youtube.com') && url.pathname === '/watch') {
      var vOrNull = new URLSearchParams(url.search).get('v');
      if (vOrNull != null) return vOrNull;
    } else if ((url.origin === 'https://youtu.be' || url.origin === 'http://youtu.be')) {
      return url.pathname.substring(1);
    }
  } catch (e) {
  }

  return null;
}

function renderFileMenubar({html}, {videoId, baseName, srv3Url, srtUrl, updateSrv3, updateSrt}) {
  return html`
    <style>
      ul.toolbar {
        width: 100%;
        min-width: 0;
        list-style-type: none;
        padding: 0;
        margin: 0;
        white-space: nowrap;
        overflow-x: auto;
      }
      ul.toolbar > * {
        white-space: normal;
      }
      ul.toolbar > li {
        display: inline-block;
      }
      ul.toolbar a[href] {
        display: inline-block;
        padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
      }
      ul.toolbar > li > details > summary {
        padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
      }
    </style>
    <ul class="toolbar" role="menubar">
      <li role="menuitem">
        <a href=${srv3Url} download="${ifDefined(baseName)}.srv3.xml"
            @mousedown=${ifDefined(updateSrv3)}
            @touchstart=${ifDefined(updateSrv3)}
            @click=${ifDefined(updateSrv3)}
            @focus=${ifDefined(updateSrv3)}
            @mouseover=${ifDefined(updateSrv3)}
            @contextmenu=${ifDefined(updateSrv3)}
            >Download captions (srv3)</a>
      </li>
      <li style="float: right;">
        <details @toggle=${function() {
          document.querySelector('.more-menu').classList.toggle('open', this.open);
        }}>
          <summary role="menuitem" aria-haspopup="true">More</summary>
        </details>
      </li>
    </ul>
    <style>
      .more-menu:not(.open) {
        display: none;
      }
      .more-menu button {
        min-height: var(--touch-target-size);
      }
      .more-menu a[href] {
        display: inline-block;
        padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
      }
      .publish-icon::before {
        content: "🌐";
      }
    </style>
    <ul class="more-menu" role="menu" aria-label="More">
      <li role="menuitem">
        <a href=${srtUrl} download="${ifDefined(baseName)}.srt"
            @mousedown=${ifDefined(updateSrt)}
            @touchstart=${ifDefined(updateSrt)}
            @click=${ifDefined(updateSrt)}
            @focus=${ifDefined(updateSrt)}
            @mouseover=${ifDefined(updateSrt)}
            @contextmenu=${ifDefined(updateSrt)}
            >Download captions (SRT)</a>
      </li>

      ${videoId == null ? [] : html`
        <li role="menuitem">
          <a href="https://studio.youtube.com/video/${videoId}/translations">${youtubeLogo}YouTube Studio</a>
        </li>

        <li role="menuitem">
          <button>
            <span class="publish-icon"></span>Publish unofficially
          </button>
        </li>
      `}
    </ul>
  `;
}

render(html`
  <style>
    :root {
      --touch-target-size: 48px;
    }
  </style>

  <main>
    <style>
      h1 {
        font-size: 1.5em;
        padding: 0;
        margin: 0;
      }
    </style>
    <h1>Edit captions</h1>

    <div id="file-menubar">
    </div>

    <div style="width: 100%; padding-bottom: calc(56.25% + 30px); position: relative;">
      <div id="video-pane" style="width: 100%; height: 100%; position: absolute;">
      </div>
    </div>

    <div id="editor-pane">
    </div>
  </main>
`, document.body);

let fileMenubar = document.querySelector('#file-menubar');
let videoPane = document.querySelector('#video-pane');
let editorPane = document.querySelector('#editor-pane');

let videoFileUrl = new ObjectUrl();

/**
 * Ask the user for a YouTube video URL. Can be cancelled.
 *
 * YouTube video URL
 * [https://youtube.com/watch?v=...]
 * [Open][Cancel]
 *
 * Video will have null captions.
 * @returns {YouTubeVideo|null}
 */
async function askForYouTubeVideo() {
  return new Promise(resolve => {
    let updateValidity = function updateValidity() {
      this.setCustomValidity(
          getVideoIdOrNull(this.value) == null ?
          'Please enter a valid YouTube URL.' :
          '');
    }
    let onSubmit = function onSubmit(e) {
      let url = this.querySelector('input[name=v]');
      updateValidity.call(url);
      var videoId = getVideoIdOrNull(url.value);
      if (videoId != null) {
        url.value = videoId;
        resolve(new YouTubeVideo(videoId));
        return;
      }
      e.preventDefault();
    }
    let dialog = render0(html`
      <dialog
          @render=${registerDialog}
          @cancel=${function(e) {
            document.body.removeChild(dialog);
            resolve(null);
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}
          style="width: calc(min(100%, 25em)); box-sizing: border-box;">
        <h2><label for="youtube-url">YouTube video URL</label></h2>

        <style>
          .youtube-url-form input,
          .youtube-url-form button {
            height: var(--touch-target-size);
          }
          .cancel-icon::before {
            content: "❌";
          }
        </style>
        <form class="youtube-url-form" method="dialog" @submit=${onSubmit}>
          <div style="display: flex;">
            <input id="youtube-url" name="v"
                placeholder="https://www.youtube.com/watch?v=gKqypLvwd70"
                @input=${updateValidity}
                @change=${updateValidity}
                style="display: inline-block; flex-grow: 1; min-width: 0;"
                autofocus required spellcheck="false">
          </div>

          <button>Open</button>
          <button type="button" @click=${function(e) {
            dialog.close();
            resolve(null);
          }}>
            <span class="cancel-icon"></span>Cancel
          </button>
        </form>
      </dialog>
    `);
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

/**
 * Ask the user for the video.
 *
 * Open video
 * [File]
 * [YouTube]
 * [No video]
 *
 * Video will have null captions.
 * @returns {DummyVideo|YouTubeVideo|Html5Video}
 */
async function askForVideo() {
  return new Promise(resolve => {
    let dialog = render0(html`
      <dialog
          @render=${registerDialog}
          @cancel=${function(e) {
            e.preventDefault();
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}>
        <h2>Open video</h2>

        <form method="dialog">
          <style>
            ul.listview {
              padding: 0;
            }
            ul.listview > li {
              display: block;
            }
            ul.listview > li > button {
              min-height: var(--touch-target-size);
              text-align: left;
              width: 100%;
              margin: 4px 0;
            }
            .file-icon::before {
              content: "📂";
            }
            .empty-icon::before {
              content: "⬜";
            }
            .cookie-icon::before {
              content: "🍪";
            }
          </style>

          <ul class="listview">
            <!-- File -->
            <li>
              <button type="button" @click=${function(e) {
                let file = this.closest('li').querySelector('input[type=file]');
                file.value = '';
                file.click();
                e.preventDefault();
              }}>
                <h3><span class="file-icon"></span>File</h3>
                Your video file won't be uploaded.
              </button>
              <input type="file" accept="video/*" style="display: none;" @change=${function(e) {
                if (e.target.files.length === 0) return;
                let video = new Html5Video(videoFileUrl.create({}, () => e.target.files[0]));
                dialog.close();
                resolve(video);
              }}>
            </li>

            <!-- YouTube -->
            <li>
              <button @click=${async function(e) {
                e.preventDefault();
                let video = await askForYouTubeVideo();
                if (video === null) return;
                dialog.close();
                resolve(video);
              }}>
                <h3><span class="cookie-icon"></span>${youtubeLogo}YouTube</h3>
                Playing YouTube videos uses tracking cookies.
              </button>
            </li>

            <!-- None -->
            <li>
              <button @click=${function(e) {
                resolve(new DummyVideo());
              }}>
                <h3><span class="empty-icon"></span>No video</h3>
                Edit captions without a video.
              </button>
            </li>
          </ul>
        </form>
      </dialog>
    `);
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

/**
 * Ask the user for the YouTube captions. Can be cancelled.
 *
 * Open YouTube captions
 * [YouTube English (Default) v]
 * [Open][Cancel]
 *
 * @param {string} videoId
 * @returns {Srt.raw Track.t|null}
 */
async function askForYouTubeCaptions(videoId) {
  return new Promise(resolve => {
    let picker = new HomogeneousTrackPicker({id: 'youtube-track-picker'});
    (async function() {
      let tracks = await listTracks(videoId);
      let defaultTrack = getDefaultTrack(tracks);
      picker.setTracks(tracks);
      picker.selectTrack(defaultTrack);
    })();

    let dialog = render0(html`
      <dialog
          @render=${registerDialog}
          @cancel=${function(e) {
            document.body.removeChild(dialog);
            resolve(null);
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}>
        <h2><label for="youtube-track-picker">Open YouTube captions</label></h2>

        <form method="dialog" class="youtube-track-picker-form"
            @submit=${async function(e) {
              let track = picker.model.value.selectedTrack;
              if (track === null) {
                resolve(null);
                return;
              }

              // Delay everything:
              e.preventDefault();
              for (let e of this.elements) {
                e.disabled = true;
              }
              let cleanup = () => {
                for (let e of this.elements) {
                  e.disabled = false;
                }
              };

              // Don't resolve if we have an error fetching captions:
              let captions
              try {
                captions = await fetchCaptions(track);
              } finally {
                cleanup();
              }
              dialog.close();
              resolve(captions);
            }}>
          <style>
            #youtube-track-picker {
              height: var(--touch-target-size);
            }
            .youtube-track-picker-form button {
              min-height: var(--touch-target-size);
            }
            .youtube-track-picker-form a[href] {
              display: inline-block;
              padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
            }
          </style>
          <div>
            ${picker.render()}
          </div>

          <p>
            <!-- TODO -->
            Not all captions appear here yet.
            I'm working on it.
          </p>

          <button>Open</button>
          <button type="button" @click=${function(e) {
            dialog.close();
            resolve(null);
          }}>
            <span class="cancel-icon"></span>Cancel
          </button>
        </form>
      </dialog>
    `);
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

/**
 * Ask the user for the unofficial captions. Can be cancelled.
 *
 * Open unofficial captions
 * [Unofficial English (Default) v]
 * [Open][Cancel]
 *
 * @param {string} videoId
 * @returns {Srt.raw Track.t|null}
 */
async function askForUnofficialCaptions(videoId) {
  return new Promise(resolve => {
    let picker = new HomogeneousTrackPicker({id: 'unofficial-track-picker'});
    (async function() {
      let result = await window.fetch('/captions?v=' + encodeURIComponent(videoId));
      if (!result.ok) return;
      let tracks = await result.json();
      tracks = tracks.map(track => new UnofficialTrack(track));

      picker.setTracks(tracks);
    })();

    let dialog = render0(html`
      <dialog
          @render=${registerDialog}
          @cancel=${function(e) {
            document.body.removeChild(dialog);
            resolve(null);
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}>
        <h2><label for="unofficial-track-picker">Open unofficial captions</label></h2>

        <form method="dialog" class="unofficial-track-picker-form"
            @submit=${function(e) {
              let track = picker.model.value.selectedTrack;
              if (track === null) {
                resolve(null);
                return;
              }
              resolve(track.getCaptions());
            }}>
          <style>
            #unofficial-track-picker {
              height: var(--touch-target-size);
            }
            .unofficial-track-picker-form button {
              min-height: var(--touch-target-size);
            }
            .unofficial-track-picker-form a[href] {
              display: inline-block;
              padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
            }
          </style>
          <div>
            ${picker.render()}
          </div>

          <button>Open</button>
          <button type="button" @click=${function(e) {
            dialog.close();
            resolve(null);
          }}>
            <span class="cancel-icon"></span>Cancel
          </button>
        </form>
      </dialog>
    `);
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

/**
 * Ask for file/YouTube/empty captions. Can be cancelled.
 * @returns {Srt.raw Track.t|null}
 */
function askForCaptions({videoId}) {
  return new Promise(resolve => {
    let filePicker = makeFileInput(captions => {
      dialog.close();
      resolve(captions);
    });
    filePicker.style.display = 'none';
    let dialog = render0(html`
      <dialog
          @render=${registerDialog}
          @cancel=${function(e) {
            document.body.removeChild(dialog);
            resolve(null);
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}>
        <h2>Open captions</h2>

        <form method="dialog">
          <style>
            ul.listview {
              padding: 0;
            }
            ul.listview > li {
              display: block;
            }
            ul.listview > li > button {
              min-height: var(--touch-target-size);
              text-align: left;
              width: 100%;
              margin: 4px 0;
            }
            .file-icon::before {
              content: "📂";
            }
            .new-icon::before {
              content: "✨";
            }
            .publish-icon::before {
              content: "🌐";
            }
          </style>

          <ul class="listview">
            <!-- File -->
            <li>
              <button type="button" @click=${function(e) {
                filePicker.click();
              }}>
                <h3><span class="file-icon"></span>File</h3>
                Open YouTube srv3 or SRT files.
              </button>
              ${filePicker}
            </li>

            <!-- YouTube -->
            <li>
              <button @click=${async function(e) {
                e.preventDefault();
                let captions = await askForYouTubeCaptions(videoId);
                if (captions == null) return;
                dialog.close();
                resolve(captions);
              }} ?disabled=${videoId == null}>
                <h3>${youtubeLogo}YouTube</h3>
                YouTube official or automatic captions.
              </button>
            </li>

            <!-- Unofficial -->
            <li>
              <button @click=${async function(e) {
                e.preventDefault();
                let captions = await askForUnofficialCaptions(videoId);
                if (captions == null) return;
                dialog.close();
                resolve(captions);
              }} ?disabled=${videoId == null}>
                <h3><span class="publish-icon"></span>Unofficial</h3>
                Captions uploaded to this website.
              </button>
            </li>

            <!-- None -->
            <li>
              <button @click=${function(e) {
                resolve(captionsFromText(
                  '0:00 Hello\n' +
                  '0:01 <i>Narrator: Hello</i>'));
              }}>
                <h3><span class="new-icon"></span>New</h3>
                Start from scratch.
              </button>
            </li>
          </ul>

          <style>
            .cancel-icon::before {
              content: "❌";
            }
          </style>
          <button @click=${function(e) {
            resolve(null);
          }} style="min-height: var(--touch-target-size);">
            <span class="cancel-icon"></span>Change video
          </button>
        </form>
      </dialog>
    `);
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

function renderDummyVideo({html}) {
  return html`
    <video style="width: 100%; height: 100%; position: absolute; z-index: -1;" controls>
    </video>
  `;
}

function renderEditorPane({html}, {editor, addCueDisabled}) {
  return html`
    <ul class="toolbar">
      <li>
        <style>
          ul.toolbar button {
            height: var(--touch-target-size);
          }
          .add-icon::before {
            content: "➕";
          }
        </style>
        <button
            @click=${e => {
              editor.addCue(editor.video.getCurrentTime(), '');
              editor.view.focus();
            }}
            ?disabled=${addCueDisabled}>
          <span class="add-icon"></span>Add cue
        </button>
      </li>
    </ul>
    ${editor.render()}
  `;
}

function renderDummyEditorPane({html}) {
  return renderEditorPane({html}, {
    editor: new CaptionsEditor(null, `0:00 [Music]`),
    addCueDisabled: true,
  });
}

(async function main() {
  // Render the dummy content:
  render(renderFileMenubar({html}, {
    srv3Url: 'javascript:',
    srtUrl: 'javascript:',
  }), fileMenubar);

  // Get the video and captions:
  let video, captions;
  let baseName = 'captions';
  let videoId;
  for (;;) {
    // Clear the video and captions selection:
    render(renderDummyVideo({html}), videoPane);
    render(renderDummyEditorPane({html}), editorPane);

    // Get the video:
    video = await askForVideo();

    // Show the video early as feedback:
    window.video = video;
    render(video.render(), videoPane);

    // Get the captions:
    videoId = null;
    if (video instanceof YouTubeVideo) {
      videoId = video.videoId;
      baseName = videoId;
    }
    captions = await askForCaptions({videoId});
    // Repeat until we have captions:
    if (captions !== null) {
      break;
    }
  }

  // Show the captions:
  let editor = new CaptionsEditor(video, captions);
  window.editor = editor;
  render(renderEditorPane({html}, {editor}), editorPane);

  // Get a debounced view of the doc:
  let doc = new AsyncRef(editor.view.state.doc);
  editor.docChanged.addListener(async function(newDoc) {
    // Avoid updating on every keypress on slow machines:
    await new Promise(resolve => window.requestIdleCallback(resolve));
    if (doc.value !== editor.view.state.doc) {
      doc.value = editor.view.state.doc;
    }
  });

  // Start a background thread to update the URLs:
  (async function updateUrl() {
    let srv3Blob = new ObjectUrl();
    let srtBlob = new ObjectUrl();
    let srv3Url;
    let srtUrl;
    let updateSrv3 = () => srv3Url = srv3Blob.create(editor._rawCaptions, () => new Blob([editor.getSrv3Captions()]));
    let updateSrt = () => srtUrl = srtBlob.create(editor._rawCaptions, () => new Blob([editor.getSrtCaptions()]));
    updateSrv3();
    updateSrt();
    for (;;) {
      // Update immediately on link clicks:
      let linkClicked = new Promise(resolve => {
        render(renderFileMenubar({html}, {
          videoId,
          baseName: baseName + '-' + new Date().toISOString().replace(/:/g, '_'),
          srv3Url,
          srtUrl,
          // Avoid resolving multiple times. Not clear if we need this.
          updateSrv3: function() {
            updateSrv3();
            resolve();
            resolve = () => {};
          },
          updateSrt: function() {
            updateSrt();
            resolve();
            resolve = () => {};
          },
        }), fileMenubar);
      });
      // Update eventually on doc changed:
      let editorChanged = doc.nextValue().then(doc => {
        updateSrt();
        updateSrv3();
      });
      await Promise.race([linkClicked, editorChanged]);
    }
  })();
})();

if (false) {
  // Video model/view:
  const video = new YouTubeVideo(params.videoId);
  window.video = video;

  // Editor pane model/view:
  const editorPane = window.editorPane = new AsyncRef({
    // Start the editor as null to avoid drawing an empty editor.
    /** @type {CaptionsEditor|null} */
    editor: null,
    /** @type {string|null} */
    language: null,
  });
  const diffBasePicker = window.diffBasePicker = new CaptionsPicker();
  const editorPaneView = editorPane.map(function renderEditorAndToolbar({editor, language}) {
    if (editor === null) {
      return html`Loading captions...`;
    }
    return html`
      <style>
        ul.toolbar {
          width: 100%;
          min-width: 0;
          list-style-type: none;
          padding: 0;
          margin: 0;
          white-space: nowrap;
          overflow-x: auto;
        }
        ul.toolbar > * {
          white-space: normal;
        }
        ul.toolbar > li {
          display: inline-block;
        }
        ul.toolbar > li > button {
          height: var(--touch-target-size);
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
        .diff-icon::before {
          content: "@";
          color: white;
          background-color: red;
          text-decoration: line-through;
        }
        .diff-icon::after {
          content: "#";
          color: white;
          background-color: green;
        }
      </style>

      <ul class="toolbar" aria-label="Toolbar">
        <li>
          ${asyncReplace(publishView.observe())}
          <button @click=${function(e) {
            let dialog = this.parentElement.querySelector('dialog');
            publish.value = Object.assign({}, publish.value, {
              initialized: true,
              language: language ?? 'en',
              srtBase64: uint8ArrayToBase64(new Uint8Array(editor.getNormalizedSrtCaptions())),
            });
            dialog.showModal();
          }}><span class="publish-icon"></span>Publish</button>
        </li>

        <li>
          <button class="diff-button" @click=${function() {
            let picker = document.querySelector('.diff-picker-container');
            picker.classList.toggle('collapsed');
          }}><span class="diff-icon"></span>Compare</button>
        </li>
      </ul>

      <div class="diff-picker-container collapsed">
        <style>
          .diff-picker-container.collapsed {
            display: none;
          }
          .diff-picker-container h2 {
            font-size: 1.5em;
            padding: 0;
            margin: 0;
            width: 100%;
          }
          .diff-picker-container select {
            height: var(--touch-target-size);
            flex-grow: 1;
            min-width: 0;
          }
        </style>
        <h2>
          <label style="width: 100%; display: flex; align-items: center;">
            <span style="white-space: pre;">Show changes: </span>
            ${diffBasePicker.render()}
          </label>
        </h2>
      </div>

      ${editor.render()}
    `;
  });

  // Publish:
  function uint8ArrayToBase64(buffer) {
    return window.btoa(String.fromCharCode.apply(String, buffer));
  }

  const previewObjectUrl = new ObjectUrl();
  function renderPreview(receipt) {
    return html`
      <details>
        <summary><span class="preview-icon"></span>Preview receipt file</summary>
        <figure style="margin: 0;">
          <figcaption>
            Open the receipt file to see your receipt.
          </figcaption>
          ${renderBrowser({html}, {
            url: `file:///receipt-${params.videoId}.html`,
            doc: renderFileReceipt({html, script}, receipt),
          })}
        </figure>
      </details>

      <details>
        <summary><span class="preview-icon"></span>Preview ${myReceiptsText({html})}</summary>
        <figure style="margin: 0;">
          <figcaption>
            Go to ${myReceiptsLink({html})} to see your receipt.
          </figcaption>
          ${renderBrowser({html}, {
            url: `${location.origin}/receipts`,
            doc: renderCookieReceipts({html, script}, [receipt], [previewObjectUrl]),
          })}
        </figure>
      </details>
    `;
  }

  const publish = window.publish = new AsyncRef({
    initialized: false,
    /** @type {string} */
    language: 'en',
    /** @type {string|null} */
    receiptType: null,
    /** @type {string} */
    srtBase64: '',
  });
  let publishKeys = null;
  let published = false;
  const publishView = publish.map(value => {
    let {initialized, language, receiptType, srtBase64} = value;

    // Lazy init the receipt preview:
    let publicKeyBase64 = '';
    let secretKeyBase64 = '';
    if (initialized && publishKeys === null) {
      publishKeys = sign_keyPair();
    }
    if (publishKeys !== null) {
      publicKeyBase64 = uint8ArrayToBase64(publishKeys.publicKey);
      secretKeyBase64 = uint8ArrayToBase64(publishKeys.secretKey);
    }

    let receipt = {
      origin: location.origin,
      videoId: params.videoId,
      language,
      captionsId: 'preview',
      secretKeyBase64,
    };
    let receiptTypeChange = function receiptTypeChange(e) {
      publish.value = Object.assign({}, value, {
        receiptType: this.value,
      });
    };
    return html`
      <dialog class="fixed" @render=${registerDialog} style="
          width: 25em;
          max-width: 100%;
          max-height: 100%;
          box-sizing: border-box;
          overflow-y: auto;">
        <h2><span class="publish-icon"></span>Publish</h2>
        Publish your captions <b>on this website</b> so anyone can use or copy them.<br>
        Making the video private or deleting it won't take your captions down.<br>
        <br>
        To publish on ${youtubeLogo} YouTube instead, <span class="save-icon"></span>Save and upload the captions to
        <a href="https://studio.youtube.com/video/${params.videoId}/translations"
            aria-label="YouTube Studio">${youtubeLogo} Studio</a>.

        <form action="/publish" method="post" @submit=${async function(e) {
          // Actual submission is done in JavaScript:
          e.preventDefault();
          if (published) return;
          this.querySelectorAll('button[type=submit]').forEach(b => b.disabled = true);
          published = true;
          publishKeys = null;

          let data = new FormData(this);
          let receiptType = data.get('receipt');
          data.delete('receipt');
          let {captionsId} = await (await fetch(this.action, {
            method: this.method,
            body: data,
          })).json();
          let finalReceipt = Object.assign({}, {
            origin: location.origin,
            videoId: data.get('videoId'),
            language: data.get('language'),
            captionsId,
            secretKeyBase64,
          });

          if (receiptType === 'cookie' || receiptType === 'file-and-cookie') {
            addCookie(finalReceipt);
          }

          if (receiptType === 'file' || receiptType === 'file-and-cookie') {
            // Download the file:
            let receiptString =
              renderFileReceiptString({html, script}, finalReceipt);
            let a = document.createElement('a');
            a.style.display = 'none';
            a.href = URL.createObjectURL(new Blob([receiptString]));
            a.download = `receipt-${finalReceipt.videoId}.html`;
            document.body.appendChild(a);
            a.click();
          }

          // Redirect (to avoid reusing things like key material):
          window.location.href = `/watch?v=${params.videoId}#id=${captionsId}`;

          this.closest('dialog').close();
        }} class="publish-form">
          <input name="videoId" type="hidden" value=${params.videoId}>
          <input name="srtBase64" type="hidden" value=${srtBase64}>
          <input name="publicKeyBase64" type="hidden" value=${publicKeyBase64}>
          <style>
            .publish-input-group {
              padding: 0.2em 0;
            }
            .publish-form > fieldset {
              width: 100%;
              min-width: 100%;
              box-sizing: border-box;
            }
            .publish-form select,
            .publish-input-group button {
              height: var(--touch-target-size);
            }
            .publish-receipt-choice > label {
              display: inline-block;
              padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
            }
          </style>

          <fieldset>
            <legend>Language</legend>
            <label>
              Captions language:
              <div>
                <select name="language" @change=${function updateReceiptLanguage(e) {
                  publish.value = Object.assign({}, value, {
                    language: this.value,
                  });
                }}>
                  ${youtubeLanguages.some(lang => lang.id === receipt.language) ? [] :
                    html`<option value=${receipt.language} selected>Unknown language: ${receipt.language}</option>`
                  }
                  ${youtubeLanguages.map(({id, name}) => html`
                    <option value=${id} ?selected=${id === receipt.language}>${name}</option>
                  `)}
                </select>
              </div>
            </label>
          </fieldset>

          <label>
            <input type="checkbox" required>
            I have read and agree to the <a href="/terms">terms of service</a>.
          </label>

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
  });

  function confirmOpenUnofficialTrack(unofficial, official) {
    let confirmed = true;
    return new Promise(resolve => {
      render(html`
        <dialog class="pick-captions-dialog fixed" @render=${registerDialog} style="
              width: 25em;
              max-width: 100%;
              max-height: 100%;
              box-sizing: border-box;
              overflow-y: auto;"
        @close=${e => resolve(confirmed)}
        @cancel=${e => resolve(false)}>
          <h2>Unofficial captions</h2>

          <form method="dialog">
            <style>
              .pick-captions-input-group {
                padding: 0.2em 0;
              }
              .pick-captions-input-group button {
                height: var(--touch-target-size);
              }
              .cancel-icon::before {
                content: "❌";
              }
              .accept-icon::before {
                content: "✔️";
              }
            </style>

            Open the unofficial captions instead of the official captions?

            <div class="pick-captions-input-group">
              <button type="submit"><span class="accept-icon"></span>${unofficial.name}</button>
              <button type="button" @click=${function() {
                confirmed = false;
                this.closest('dialog').close();
              }}><span class="cancel-icon"></span>${official.name}</button>
            </div>
          </form>
        </dialog>
        `, captionsPickerPrompt);
      captionsPickerPrompt.querySelector('dialog').showModal();
    });
  }

  let hashParams = new URLSearchParams(location.hash.substring(1));

  let requestedUnofficialTrack = (function() {
    let captionsId = hashParams.get('id');
    if (captionsId === null) return null;
    for (let track of unofficialTracks) {
      if (track.captionsId === captionsId) {
        return track;
      }
    }
    // If the track has been deleted, silently ignore the captionsId parameter.
    return null;
  })();

  // Main controller, binding everything together:

  (async function main() {
    return;
    // Load the tracks:
    let {tracks, defaultTrack} = await getCombinedTracks();
    captionsPicker.setTracks(tracks);
    diffBasePicker.setTracks(tracks);
    captionsPicker.selectTrack(defaultTrack);
    window.tracks = tracks;

    // Bind captions picker:
    let editor = new CaptionsEditor(video);
    editorPane.value = {
      editor,
      language: null,
    };
    let setCaptions = async function setCaptions({captions, language}) {
      if (captions === null) return;
      let {editor: curEditor, language: curLanguage} = editorPane.value;

      curEditor.setCaptions(captions, /*addToHistory=*/true);
      curEditor.setSaved();
      curLanguage = language ?? curLanguage;

      editorPane.value = {editor, language: curLanguage};
    };
    captionsPicker.captionsChange.addListener(setCaptions);
    setCaptions({
      language: captionsPicker.getLanguage(),
      captions: await captionsPicker.fetchCaptions(),
    });

    // Diff plugin:
    let diffTag = Symbol('diff');
    editor.view.dispatch({
      reconfigure: {
        append: tagExtension(diffTag, []),
      },
    });

    // Bind the diff base picker:
    let setDiffBase = function setDiffBase({captions, language}) {
      // Unfold unchanged sections:
      unfoldAll(editor.view);

      // Update the extension:
      let extension = [];
      if (captions !== null) {
        extension = revertString(captionsToText(captions));
      }
      editor.view.dispatch({
        reconfigure: {
          [diffTag]: extension,
        },
      });

      // Fold unchanged sections:
      if (captions !== null) {
        foldAll(editor.view);
      }
    };
    diffBasePicker.captionsChange.addListener(setDiffBase);
    setDiffBase({
      language: diffBasePicker.getLanguage(),
      captions: await diffBasePicker.fetchCaptions(),
    });
  })();
}
