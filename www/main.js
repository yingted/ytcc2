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
import {box, sign, hash, randomBytes} from 'tweetnacl';
import {script} from './script_web.js';
import {ObjectUrl} from './object_url.js';
import {fetchCaptions, makeFileInput, HomogeneousTrackPicker, CaptionsPicker, UnofficialTrack} from './track_picker.js';
import {revertString} from 'codemirror-next-merge';
import {ChangeSet, tagExtension} from '@codemirror/next/state';
import {unfoldAll, foldAll} from '@codemirror/next/fold';
import {renderFooter} from './templates.js';
import {Html5Video, DummyVideo} from './video.js';
import * as permissions from './permissions.js';

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

    <div id="share-pane">
    </div>
  </main>
`, document.body);

let fileMenubar = document.querySelector('#file-menubar');
let videoPane = document.querySelector('#video-pane');
let editorPane = document.querySelector('#editor-pane');
let sharePane = document.querySelector('#share-pane');

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
          role="dialog"
          aria-modal="true"
          aria-labelledby="youtube-url-heading"
          @render=${registerDialog}
          @cancel=${function(e) {
            resolve(null);
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}
          style="width: calc(min(100%, 25em)); box-sizing: border-box;">
        <h2 id="youtube-url-heading"><label for="youtube-url">YouTube video URL</label></h2>

        <style>
          .youtube-url-form input,
          .youtube-url-form button {
            height: var(--touch-target-size);
            box-sizing: border-box;
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

          <button><span class="accept-icon"></span><b>Open</b></button>
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-dialog-heading"
          @render=${registerDialog}
          @cancel=${function(e) {
            e.preventDefault();
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}>
        <h2 id="video-dialog-heading">Open video</h2>

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

            <!-- File -->
            <li>
              <button type="button" @click=${function(e) {
                let file = this.closest('li').querySelector('input[type=file]');
                file.value = '';
                file.click();
                e.preventDefault();
              }}>
                <h3><span class="file-icon"></span>Choose video file</h3>
                Your video file won't be uploaded.
              </button>
              <input type="file" accept="video/*" style="display: none;" @change=${function(e) {
                if (e.target.files.length === 0) return;
                let video = new Html5Video(videoFileUrl.create({}, () => e.target.files[0]));
                dialog.close();
                resolve(video);
              }}>
            </li>

            <!-- None -->
            <li>
              <button @click=${function(e) {
                resolve(new DummyVideo());
              }}>
                <h3><span class="empty-icon"></span>Blank video</h3>
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
 * @param {Track[]} tracks await listTracks(videoId)
 * @param {Track[]} defaultTrack getDefaultTrack(tracks)
 * @returns {Srt.raw Track.t|null}
 */
async function askForYouTubeCaptions(videoId, tracks, defaultTrack) {
  return new Promise(resolve => {
    let picker = new HomogeneousTrackPicker({id: 'youtube-track-picker'});
    picker.setTracks(tracks);
    picker.selectTrack(defaultTrack);

    let dialog = render0(html`
      <dialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="youtube-captions-dialog-heading"
          @render=${registerDialog}
          @cancel=${function(e) {
            resolve(null);
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}>
        <h2 id="youtube-captions-dialog-heading"><label for="youtube-track-picker">Open YouTube captions</label></h2>

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
            ${picker.renderOnce()}
          </div>

          <p>
            <!-- TODO -->
            Not all captions appear here yet.
            I'm working on it.
          </p>

          <button><b>Open</b></button>
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="captions-dialog-heading"
          @render=${registerDialog}
          @cancel=${function(e) {
            resolve(null);
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}>
        <h2 id="captions-dialog-heading">Open captions</h2>

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
            <!-- YouTube -->
            <li>
              <button type="button" @click=${async function(e) {
                this.disabled = true;
                let tracks;
                try {
                  tracks = await listTracks(videoId);
                } finally {
                  this.disabled = false;
                }

                let captions = await askForYouTubeCaptions(
                    videoId, tracks, getDefaultTrack(tracks));
                if (captions == null) return;
                dialog.close();
                resolve(captions);
              }} ?disabled=${videoId == null}>
                <h3>${youtubeLogo}YouTube</h3>
                YouTube official or automatic captions.
              </button>
            </li>

            <!-- File -->
            <li>
              <button type="button" @click=${function(e) {
                filePicker.click();
              }}>
                <h3><span class="file-icon"></span>Choose captions file</h3>
                Open YouTube srv3 or SRT files.
              </button>
              ${filePicker}
            </li>

            <!-- None -->
            <li>
              <button @click=${function(e) {
                resolve(captionsFromText(
                  '0:00 Hello\n' +
                  '0:01 <i>Narrator: Hello</i>'));
              }}>
                <h3><span class="new-icon"></span>Blank captions</h3>
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

/**
 * @params {AbortSignal|undefined} signal
 * @returns {string} the nonce
 */
async function newNonce(signal) {
  let res = await fetch('/nonce', {
    method: 'POST',
    referrer: 'no-referrer',
    signal,
  });
  if (!res.ok) {
    throw new Error('could not get nonce');
  }
  let {nonce} = await res.json();
  if (typeof nonce !== 'string') {
    throw new Error('invalid nonce');
  }
  return nonce;
}

async function uploadCaptions(writer, text, signal, lastHash) {
  let encrypted = writer.encrypt(text);
  let readerFingerprint = writer.reader.fingerprint;
  let encryptedSignature = writer.sign(encrypted);
  let readerFingerprintSignature = writer.sign(readerFingerprint);
  let lastHashSignature = lastHash === undefined ? undefined : writer.sign(lastHash);
  let nonce = await newNonce(signal);
  let res = await fetch('/captions/' + encodeURIComponent(writer.fingerprint), {
    method: 'POST',
    referrer: 'no-referrer',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pubkeys: writer.public.toJSON(),
      nonce,
      nonceSignature: writer.sign(nonce),
      encrypted,
      encryptedSignature,
      readerFingerprint,
      readerFingerprintSignature,
      lastHash,
      lastHashSignature,
    }),
  });
  if (!res.ok) {
    throw new Error('could not upload captions');
  }
  return permissions.hashUtf8(encrypted);
}

async function deleteCaptions(writer, signal, lastHash) {
  let nonce = await newNonce(signal);
  let lastHashSignature = lastHash === undefined ? undefined : writer.sign(lastHash);
  let res = await fetch('/captions/' + encodeURIComponent(writer.fingerprint), {
    method: 'DELETE',
    referrer: 'no-referrer',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pubkeys: writer.public.toJSON(),
      nonce,
      nonceSignature: writer.sign(nonce),
      lastHash,
      lastHashSignature,
    }),
  });
  if (!res.ok) {
    throw new Error('could not delete captions');
  }
}

/**
 * Autosave thread.
 */
class Sync {
  constructor(doc, uploadHash, statusMessage, writer, editor, delayMs) {
    this.doc = doc;
    this.uploadHash = uploadHash;
    this.statusMessage = statusMessage;
    this._controller = new AbortController();
    this._writer = writer;
    this._editor = editor;
    this._delayMs = delayMs;
    this._aborted = new Promise(resolve => this._abort = resolve);
    this._isAborted = false;
    this._promise = this._run();
  }
  abort() {
    this._isAborted = true;
    this._controller.abort();
    this._abort();
  }
  async _waitForChange() {
    if (this.doc !== this._editor.view.state.doc) return;
    let thiz = this;
    return new Promise(resolve => {
      this._editor.docChanged.addListener(function onDocChanged() {
        thiz._editor.docChanged.removeListener(onDocChanged);
        resolve();
      });
    });
  }
  async _waitForIdle() {
    await new Promise(resolve => setTimeout(resolve, this._delayMs));
    if (this._isAborted) return;
    await new Promise(resolve => window.requestIdleCallback(resolve));
  }
  async _uploadWithSignal() {
    let signal = this._controller.signal;

    if (this.doc === this._editor.view.state.doc) return;
    let doc = this._editor.view.state.doc;

    // Upload the captions interruptibly:
    try {
      // Update uploadHash and doc on success:
      this.uploadHash = await uploadCaptions(this._writer, doc.toString(), signal, this.uploadHash);
      this.doc = doc;
    } catch (e) {
      render(`Upload error: ${e.message}`, this.statusMessage);
      return;
    }

    if (doc === this._editor.view.state.doc) {
      this._editor.setSaved();
      render(`Saved.`, this.statusMessage);
    }
  }
  async _run() {
    for (;;) {
      await Promise.race([this._aborted, this._waitForChange()]);
      if (this._isAborted) return;

      await Promise.race([this._aborted, this._waitForIdle()]);
      if (this._isAborted) return;

      await this._uploadWithSignal();
      if (this._isAborted) return;
    }
  }
  async join() {
    try {
      await this._promise;
    } catch (e) {
      console.error(e);
    }
  }
};

/**
 * Permalink thread.
 */
class Share {
  constructor(editor) {
    this._editor = editor;

    this._iAgree = render0(html`
      <input type="checkbox" required>
    `);
    this._permalinkWidget = render0(html`
      <div style="display: flex;">
      </div>
    `);
    this._statusMessage = render0(html`
      <div role="alert" aria-live="polite">
      </div>
    `);
    this._shareButton = render0(html`
      <button type="submit">
        <span class="link-icon"></span>Share
      </button>
    `);
    this._unshareButton = render0(html`
      <button type="reset">
        <span class="cancel-icon"></span>Stop sharing
      </button>
    `);

    this._run();
  }
  render() {
    return html`
      <style>
        .permalink-form button,
        .permalink-form input[type=url] {
          height: var(--touch-target-size);
          box-sizing: border-box;
        }
        .permalink-form label,
        .permalink-form a[href] {
          display: inline-block;
          padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
        }
        .permalink-form a[href] {
          margin: calc(0.5em - var(--touch-target-size) / 2) 0;
        }

        .link-icon::before {
          content: "🔗";
        }
        .cancel-icon::before {
          content: "❌";
        }
      </style>
      <form class="permalink-form"
          @submit=${function(e) {
            e.preventDefault();
            shareButton.click();
          }}>
        <label>
          ${this._iAgree}
          I agree to the <a href="/terms">terms of service</a>.
        </label>
        ${this._permalinkWidget}
        ${this._statusMessage}
      </form>
    `;
  }
  _updatePermalink(busy, link) {
    let button = link ? this._unshareButton : this._shareButton;
    button.disabled = busy;
    render(html`
      ${button}
      <input type="url"
          aria-label="Sharing link"
          placeholder="${location.origin}/#view=••••••••••••••••••••••••••••••••••" readonly
          value=${link}
          style="flex-grow: 1; min-width: 0;">
    `, this._permalinkWidget);
  }
  async _waitForShare() {
    let thiz = this;
    let writer;
    let readLink;

    // Wait for share request:
    this._updatePermalink(/*busy=*/false, /*link=*/'');
    await new Promise(resolve => thiz._shareButton.onclick = function() {
      if (!thiz._iAgree.reportValidity()) {
        return;
      }
      thiz._shareButton.onclick = null;

      // Show new share state immediately:
      writer = permissions.Writer.random();
      readLink = location.origin + '/#view=' + encodeURIComponent(writer.reader.secret);
      let writeLink = location.origin + '/#edit=' + encodeURIComponent(writer.secret);

      // Update the read link:
      thiz._updatePermalink(/*busy=*/true, /*link=*/readLink);
      thiz._permalinkWidget.querySelector('input[type=url]').select();
      document.execCommand('copy');
      render('Link copied. Uploading captions...', thiz._statusMessage);

      window.history.replaceState(null, document.title, writeLink);

      resolve();
    });

    // Wait for share response:
    let doc = this._editor.view.state.doc;
    let uploadHash = await uploadCaptions(writer, doc.toString());
    this._updatePermalink(/*busy=*/false, /*link=*/readLink);
    // TTL is hard-coded in index.js:
    render('Link copied. Expires in 30 days.', this._statusMessage);

    return {writer, doc, uploadHash};
  }
  async _waitForUnshare({writer, uploadHash, sync}) {
    let thiz = this;

    // Wait for unshare request:
    await new Promise(resolve => thiz._unshareButton.onclick = function() {
      thiz._unshareButton.onclick = null;

      thiz._updatePermalink(/*busy=*/true, /*link=*/'');
      let localLink = location.origin + '/';
      window.history.replaceState(null, document.title, localLink);
      render('Stopping sharing...', thiz._statusMessage);

      sync.abort();

      resolve();
    });

    // Avoid overlapping upload/delete requests:
    await sync.join();

    // Wait for unshare response:
    await deleteCaptions(writer, undefined, uploadHash);
    this._updatePermalink(/*busy=*/false, /*link=*/'');
    render('Sharing stopped.', thiz._statusMessage);
  }
  async _run() {
    try {
      for (;;) {
        let {writer, doc, uploadHash} = await this._waitForShare();

        let sync = new Sync(doc, uploadHash, this._statusMessage, writer, this._editor, 30e3);

        await this._waitForUnshare({writer, uploadHash, sync});
      }
    } catch (e) {
      render(html`
        <details>
          <summary>Error, please save your data and reload the page.</summary>
          ${e.toString()}
        </details>
      `, this._statusMessage);
      throw e;
    }
  }
}

function renderDummyEditorPane({html}) {
  return renderEditorPane({html}, {
    editor: new CaptionsEditor(null, `0:00 [Music]`),
    addCueDisabled: true,
  });
}

(async function main() {
  // Parse params:
  let hashParams = new URLSearchParams(location.hash.substring(1));
  let writer = null;
  let reader = null;
  {
    let writeSecret = hashParams.get('edit');
    let readSecret = hashParams.get('view');
    if (writeSecret !== null) {
      writer = new permissions.Writer(writeSecret);
    } else if (readSecret !== null) {
      reader = new permissions.Reader(readSecret);
    }
    console.log({writer, reader});  // TODO
  }

  // Render the dummy content:
  render(renderFileMenubar({html}, {
    srv3Url: 'javascript:',
    srtUrl: 'javascript:',
  }), fileMenubar);

  // Get the video and captions:
  let video, captions;
  let baseName = 'captions';
  let videoId;

  // TODO:
  videoId = 'gKqypLvwd70';
  baseName = videoId;
  // video = new YouTubeVideo(videoId);
  video = new DummyVideo();
  render(video.render(), videoPane);
  captions = captionsFromText('0:00 [Music]');
  document.querySelector('summary[aria-haspopup=true]').click();
  if (false)

  for (;;) {
    // Clear the video and captions selection:
    render(renderDummyVideo({html}), videoPane);
    let dummyEditor = new CaptionsEditor(null, `0:00 [Music]`);
    render(renderEditorPane({html}, {
      editor: dummyEditor,
      addCueDisabled: true,
    }), editorPane);
    render(new Share(dummyEditor).render(), sharePane);

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
  let share = new Share(editor);
  window.editor = editor;
  render(renderEditorPane({html}, {editor}), editorPane);
  render(share.render(), sharePane);

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
          },
          updateSrt: function() {
            updateSrt();
            resolve();
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
  const editorPaneView = editorPane.map(function renderEditorAndToolbar({editor, language}) {
    if (editor === null) {
      return html`Loading captions...`;
    }
    return html`
      <style>
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

  // Main controller, binding everything together:

  (async function main() {
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
