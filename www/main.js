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
import {ifDefined} from 'lit-html/directives/if-defined.js';
import {YouTubeVideo} from './youtube.js';
import {CaptionsEditor, captionsToText, captionsFromText} from './editor.js';
import {listTracks, getDefaultTrack} from './youtube_captions.js';
import {decodeJson3FromJson, empty} from 'ytcc2-captions';
import {onRender, render0, AsyncRef, Signal} from './util.js';
import dialogPolyfill from 'dialog-polyfill';
import {youtubeLanguages} from './gen/youtube_languages.js';
import {box, sign, hash, randomBytes} from 'tweetnacl';
import {ObjectUrl} from './object_url.js';
import {fetchCaptions, makeFileInput, HomogeneousTrackPicker} from './track_picker.js';
import {revertString} from 'codemirror-next-merge';
import {ChangeSet, tagExtension} from '@codemirror/next/state';
import {unfoldAll, foldAll} from '@codemirror/next/fold';
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

class BaseUploader {
  serialize(value) {
    throw new Error('must be overridden');
  }

  equals(valueA, valueB) {
    throw new Error('must be overridden');
  }

  /**
   * (Re)upload captions.
   * @param {Writer} writer our credentials (which captions to upload to)
   * @param {Value} value the value to upload
   * @param {AbortSignal} signal
   * @param {string|undefined} lastHash if present, reupload overwriting this value
   * @returns {string} hash
   */
  async upload(writer, value, signal, lastHash) {
    let plaintext = this.serialize(value);
    let encrypted = writer.encrypt(plaintext);
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

  /**
   * Delete captions.
   * @param {Writer} writer our credentials (which captions to upload to)
   * @param {AbortSignal} signal
   * @param {string} lastHash current value to delete
   */
  async delete(writer, signal, lastHash) {
    let nonce = await newNonce(signal);
    let lastHashSignature = writer.sign(lastHash);
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
   * Download captions
   * @param {Writer|Reader} perms
   * @param {AbortSignal} signal
   * @returns {{value: Value, lastHash: string}}
   */
  async download(perms, signal) {
    // Note that we're fetching with either the reader or writer fingerprint.
    // The server accepts both.
    let res = await fetch('/captions/' + encodeURIComponent(perms.fingerprint), {
      method: 'GET',
      referrer: 'no-referrer',
      signal,
    });
    if (!res.ok) {
      throw new Error('could not get captions');
    }
    let {pubkeys, encryptedData} = await res.json();

    // Verify everything:
    perms.setWriterPublic(permissions.WriterPublic.fromJSON(pubkeys));

    return {
      value: this.deserialize(perms.decrypt(encryptedData)),
      lastHash: permissions.hashUtf8(encryptedData),
    };
  }
}

class JsonUploader extends BaseUploader {
  serialize(value) {
    return JSON.stringify(value);
  }
  deserialize(serialized) {
    return JSON.parse(serialized);
  }
  equals(a, b) {
    return a === b || this.serialize(a) === this.serialize(b);
  }
}

/**
 * Autosave thread.
 */
class Sync {
  /**
   * @param {{upload: function}} uploader
   * @param {Value} value the last uploaded value
   * @param {string} lastHash the last upload hash
   * @param {Element} statusMessage the status message container
   * @param {Writer} writer our credentials
   * @param {AsyncRef} ref a reference to the current state
   * @param {function} setSaved called when we're up-to-date
   * @param {number} delayMs how long to wait before autosaving
   */
  constructor(uploader, value, lastHash, statusMessage, writer, ref, setSaved, delayMs) {
    this._uploader = uploader
    this._value = value;
    this.lastHash = lastHash;
    this.statusMessage = statusMessage;
    this._controller = new AbortController();
    this._writer = writer;
    this._ref = ref;
    this._setSaved = setSaved;
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
    if (this._value !== this._ref.value) return;
    let thiz = this;
    return this._ref.nextValue();
  }
  async _waitForIdle() {
    await new Promise(resolve => setTimeout(resolve, this._delayMs));
    if (this._isAborted) return;
    await new Promise(resolve => window.requestIdleCallback(resolve));
  }
  async _uploadWithSignal() {
    let signal = this._controller.signal;

    if (this._value === this._ref.value) return;
    let value = this._ref.value;

    // Upload the captions interruptibly:
    try {
      // Update lastHash and value on success:
      this.lastHash = await this._uploader.upload(this._writer, value, signal, this.lastHash);
      this._value = value;
    } catch (e) {
      render(`Upload error: ${e.message}`, this.statusMessage);
      return;
    }

    if (this._uploader.equals(value, this._ref.value)) {
      this._setSaved();
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
 * Get the permissions from the URL.
 * @param {Location|URL} location
 * @returns {Writer|Reader|null} perms
 */
function urlToPermissions(location) {
  let hashParams = new URLSearchParams(location.hash.substring(1));

  let writeSecret = hashParams.get('edit');
  if (writeSecret !== null) {
    return new permissions.Writer(writeSecret);
  }

  let readSecret = hashParams.get('view');
  if (readSecret !== null) {
    return new permissions.Reader(readSecret);
  }

  return null;
}

/**
 * Get the permissions from the URL.
 * @param {Writer|Reader|null} perms
 * @returns {URL}
 */
function permissionsToUrl(perms) {
  if (perms instanceof permissions.Writer) {
    return new URL(location.origin + '/#edit=' + encodeURIComponent(perms.secret));
  }
  if (perms instanceof permissions.Reader) {
    return new URL(location.origin + '/#view=' + encodeURIComponent(perms.secret));
  }
  if (perms === null) {
    return new URL(location.origin + '/');
  }
  throw new TypeError('invalid perms');
}

/**
 * Permalink thread.
 */
class Share {
  constructor(uploader, ref, setSaved, initialShare) {
    this._uploader = uploader;
    this._ref = ref;
    this._setSaved = setSaved;

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
        <style>
          .link-icon::before {
            content: "🔗";
          }
        </style>
        <span class="link-icon"></span>Share
      </button>
    `);
    this._unshareButton = render0(html`
      <button type="reset">
        <style>
          .cancel-icon::before {
            content: "❌";
          }
        </style>
        <span class="cancel-icon"></span>Stop sharing
      </button>
    `);

    if (this._uploader) {
      this._run(initialShare);
    }
  }
  /**
   * A disabled (empty) permalink.
   */
  static disabled() {
    let share = new Share();
    share._updatePermalink(/*busy=*/true, /*link=*/'');
    return share;
  }
  /**
   * A read-only permalink.
   */
  static readonly(reader) {
    let share = new Share();
    share._updatePermalink(/*busy=*/true, /*link=*/permissionsToUrl(reader));
    return share;
  }
  static _stateFromEditor(editor) {
    return {
      version: 1,
      videoId: editor.video instanceof YouTubeVideo ? editor.video.videoId : undefined,
      videoIsUnavailable: editor.video instanceof Html5Video,
      // For prologue:
      doc: editor.view.state.doc.toString(),
      // For karaoke:
      json3: JSON.parse(new TextDecoder().decode(editor.getJson3Captions())),
    };
  }
  /**
   * Share a doc in "unsaved" state.
   */
  static fromNewEditor(editor, initialShare) {
    let stateRef = new AsyncRef(this._stateFromEditor(editor));
    // Return the doc to test for equality:
    editor.docChanged.addListener(doc =>
        stateRef.value = this._stateFromEditor(editor));
    return new Share(new JsonUploader(), stateRef, editor.setSaved.bind(editor), initialShare);
  }
  /**
   * Load an editor from the server. editor.video will be set as well.
   * @param {Writer|Reader} perms
   * @returns {{editor: CaptionsEditor, share: Share}}
   */
  static async loadWithEditor(perms) {
    let uploader = new JsonUploader();
    let {value, lastHash} = await uploader.download(perms);

    // Decode the state:
    if (value.version !== 1) {
      throw new Error('unsupported version');
    }
    let {doc, videoId, videoIsUnavailable} = value;
    let captions = decodeJson3FromJson(value.json3);

    // Get the video
    let video;
    if (videoId !== undefined) {
      video = new YouTubeVideo(videoId);
    } else if (videoIsUnavailable) {
      video = new DummyVideo('Video is unavailable.');
    } else {
      video = new DummyVideo();
    }

    // Get the editor:
    if (perms instanceof permissions.Writer) {
      let editor = new CaptionsEditor(video, captions);
      return {
        editor,
        share: Share.fromNewEditor(editor, {
          writer: perms,
          value,
          lastHash,
        }),
      };
    }
    if (perms instanceof permissions.Reader) {
      return {
        editor: new CaptionsEditor(video, captions, {readOnly: true}),
        share: Share.readonly(perms),
      };
    }
    throw new Error('invalid perms');
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
      </style>
      <form class="permalink-form"
          @submit=${function(e) {
            e.preventDefault();
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

    // Wait for share request:
    this._updatePermalink(/*busy=*/false, /*link=*/'');
    await new Promise(resolve => thiz._shareButton.onclick = function() {
      if (!thiz._iAgree.reportValidity()) {
        return;
      }
      thiz._shareButton.onclick = null;

      // Show new share state immediately:
      writer = permissions.Writer.random();

      // Update the read link:
      thiz._updatePermalink(/*busy=*/true, /*link=*/permissionsToUrl(writer.reader));
      thiz._permalinkWidget.querySelector('input[type=url]').select();
      document.execCommand('copy');
      render('Link copied. Uploading captions...', thiz._statusMessage);

      window.history.replaceState(null, document.title, permissionsToUrl(writer));

      resolve();
    });

    // Wait for share response:
    let value = this._ref.value;
    let lastHash = await this._uploader.upload(writer, value);
    this._updatePermalink(/*busy=*/false, /*link=*/permissionsToUrl(writer.reader));
    // TTL is hard-coded in index.js:
    render('Link copied. Expires in 30 days.', this._statusMessage);

    return {writer, value, lastHash};
  }
  async _waitForUnshare({writer, lastHash, sync}) {
    let thiz = this;

    // Wait for unshare request:
    await new Promise(resolve => thiz._unshareButton.onclick = function() {
      thiz._unshareButton.onclick = null;

      thiz._updatePermalink(/*busy=*/true, /*link=*/'');
      window.history.replaceState(null, document.title, permissionsToUrl(null));
      render('Stopping sharing...', thiz._statusMessage);

      sync.abort();

      resolve();
    });

    // Avoid overlapping upload/delete requests:
    await sync.join();

    // Wait for unshare response:
    await this._uploader.delete(writer, undefined, lastHash);
    this._updatePermalink(/*busy=*/false, /*link=*/'');
    render('Sharing stopped.', thiz._statusMessage);
  }
  async _run(initialShare) {
    try {
      for (;;) {
        let share;
        if (initialShare) {
          share = initialShare;
          initialShare = undefined;
          render('Opened captions.', this._statusMessage);
          this._updatePermalink(/*busy=*/false, /*link=*/permissionsToUrl(share.writer.reader));
        } else {
          share = await this._waitForShare();
        }

        let {writer, value, lastHash} = share;

        let sync = new Sync(this._uploader, value, lastHash, this._statusMessage, writer, this._ref, this._setSaved, 5e3);

        await this._waitForUnshare({writer, lastHash: sync.lastHash, sync});
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

/**
 * Ask the user for the video and captions.
 * After returning, the video pane is updated.
 * @returns {{video: object, captions: object}}
 */
async function askForVideoAndCaptions(videoPane) {
  for (;;) {
    // Clear the video and captions selection:
    render(renderDummyVideo({html}), videoPane);

    // Get the video:
    let video = await askForVideo();
    // Show the video early as feedback:
    window.video = video;
    render(video.render(), videoPane);

    // Get the captions:
    let captions = await askForCaptions({
      videoId: video instanceof YouTubeVideo ? video.videoId : undefined,
    });
    // Repeat until we have captions:
    if (captions !== null) {
      return {video, captions};
    }
  }
}

/**
 * Render "empty" content into all the widgets.
 */
function renderDummyContent({fileMenubar, videoPane, editorPane, sharePane}) {
  render(renderFileMenubar({html}, {
    srv3Url: 'javascript:',
    srtUrl: 'javascript:',
  }), fileMenubar);
  render(renderDummyVideo({html}), videoPane);
  render(renderEditorPane({html}, {
    editor: new CaptionsEditor(null, `0:00 [Music]`),
    addCueDisabled: true,
  }), editorPane);
  render(Share.disabled().render(), sharePane);
}

class FileMenu {
  constructor(video, editor) {
    this._container = new DocumentFragment();
    this._isAborted = false;
    this._done = this._run(video, editor);
  }
  render() {
    return this._container;
  }
  join() {
    return this._done;
  }
  async _run(video, editor) {
    // Get a debounced view of the doc:
    let doc = new AsyncRef(editor.view.state.doc);
    let docChanged = async function docChanged(newDoc) {
      // Avoid updating on every keypress on slow machines:
      await new Promise(resolve => window.requestIdleCallback(resolve));
      if (doc.value !== editor.view.state.doc) {
        doc.value = editor.view.state.doc;
      }
    };
    editor.docChanged.addListener(docChanged);

    try {
      let srv3Blob = new ObjectUrl();
      let srtBlob = new ObjectUrl();
      let srv3Url;
      let srtUrl;
      let updateSrv3 = () => srv3Url = srv3Blob.create(editor._rawCaptions, () => new Blob([editor.getSrv3Captions()]));
      let updateSrt = () => srtUrl = srtBlob.create(editor._rawCaptions, () => new Blob([editor.getSrtCaptions()]));
      updateSrv3();
      updateSrt();
      while (!this._isAborted) {
        // Update immediately on link clicks:
        let linkClicked = new Promise(resolve => {
          let videoId;
          let baseName = 'captions';
          if (video instanceof YouTubeVideo) {
            videoId = video.videoId;
            baseName = video.videoId + '-' + new Date().toISOString().replace(/:/g, '_')
          }
          render(renderFileMenubar({html}, {
            videoId,
            baseName,
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
          }), this._container);
        });
        // Update eventually on doc changed:
        let editorChanged = doc.nextValue().then(doc => {
          updateSrt();
          updateSrv3();
        });
        await Promise.race([linkClicked, editorChanged]);
      }
    } finally {
      editor.docChanged.removeListener(docChanged);
    }
  }
}

(async function main() {
  let fileMenubar = document.querySelector('#file-menubar');
  let videoPane = document.querySelector('#video-pane');
  let editorPane = document.querySelector('#editor-pane');
  let sharePane = document.querySelector('#share-pane');
  renderDummyContent({fileMenubar, videoPane, editorPane, sharePane});

  // Parse the URL:
  let perms = urlToPermissions(window.location);

  let video, editor, share;
  if (perms === null) {
    // First load, get the video and editor:

    let choice = await askForVideoAndCaptions(videoPane);
    let captions = choice.captions;
    video = choice.video;

    editor = new CaptionsEditor(video, captions);
    share = Share.fromNewEditor(editor);
  } else {
    // Restore the Share state:
    let shareEditor = await Share.loadWithEditor(perms);
    share = shareEditor.share;
    editor = shareEditor.editor;
    video = editor.video;
  }

  window.editor = editor;
  window.share = share;

  // Render the real content:
  let fileMenu = new FileMenu(video, editor);
  render(fileMenu.render(), fileMenubar);
  render(renderEditorPane({html}, {editor}), editorPane);
  render(share.render(), sharePane);
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
