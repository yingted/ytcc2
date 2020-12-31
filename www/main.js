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
import {ifDefined} from 'lit-html/directives/if-defined.js';
import {YouTubeVideo} from './youtube.js';
import {CaptionsEditor, captionsToText, captionsFromText} from './editor.js';
import {listTracks, getDefaultTrack} from './youtube_captions.js';
import {decodeJson3FromJson, decodeSrv3, stripRaw, empty} from 'ytcc2-captions';
import {onRender, render0, AsyncRef, Signal} from './util.js';
import dialogPolyfill from 'dialog-polyfill';
import {youtubeLanguages} from './gen/youtube_languages.js';
import {box, sign, hash, randomBytes} from 'tweetnacl';
import {ObjectUrl} from './object_url.js';
import {fetchCaptions, makeFileInput, HomogeneousTrackPicker} from './track_picker.js';
import {ChangeSet, tagExtension} from '@codemirror/next/state';
import {unfoldAll, foldAll} from '@codemirror/next/fold';
import {Html5Video, DummyVideo} from './video.js';
import * as permissions from './permissions.js';
import {generateAsync} from './pow.js';
import {asrLanguages} from './youtube_languages.js';

import './node_modules/dialog-polyfill/dist/dialog-polyfill.css';
import 'purecss/build/base.css';
import 'purecss/build/forms-nr.css';
import 'purecss/build/buttons.css';
import './purecss_a11y.css';

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
  // TODO: enhance this for the view page
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
  <main>
    <h1>Edit captions</h1>

    ${window.onerror ? html`
      <h2>
        <font color="red">Internal: recording activity and errors</font>
      </h2>
    ` : []}

    <div id="file-menubar">
    </div>

    <div id="video-container" style="width: 100%; padding-bottom: calc(56.25% + 30px); position: relative;">
      <div id="video-pane" style="width: 100%; height: 100%; position: absolute;">
      </div>
    </div>

    <div id="editor-pane">
    </div>

    <div id="share-pane">
    </div>

    <div id="abuse-pane">
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

        <form class="pure-form" method="dialog" @submit=${onSubmit}>
          <div style="display: flex;">
            <input id="youtube-url" name="v"
                placeholder="https://www.youtube.com/watch?v=gKqypLvwd70"
                @input=${updateValidity}
                @change=${updateValidity}
                style="display: inline-block; flex-grow: 1; min-width: 0;"
                autofocus required spellcheck="false">
          </div>

          <button class="pure-button pure-button-primary">Open</button>
          <button class="pure-button button-cancel" type="button" @click=${function(e) {
            dialog.close();
            resolve(null);
          }}>
            Cancel
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
 * Preview video (optional)
 * [File]
 * [YouTube]
 * [Cancel]
 *
 * Video will have null captions.
 * @returns {YouTubeVideo|Html5Video|null}
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
            resolve(null);
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}>
        <h2 id="video-dialog-heading">Choose video (optional)</h2>

        <form method="dialog" class="pure-form video-picker-form">
          <style>
            ul.listview {
              padding: 0;
            }
            ul.listview > li {
              display: block;
            }
            ul.listview > li > button {
              text-align: left;
              width: 100%;
              margin: 4px 0;
            }
            .file-icon::before {
              content: "📂";
            }
            .cookie-icon::before {
              content: "🍪";
            }
          </style>

          Show your captions on a video.<br>
          Shared links show YouTube videos but not video files.<br>

          <ul class="listview" role="group" aria-label="Preview videos">
            <!-- YouTube -->
            <li>
              <button class="pure-button pure-button-primary" @click=${async function(e) {
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
              <button class="pure-button" type="button" @click=${function(e) {
                let file = this.closest('li').querySelector('input[type=file]');
                file.value = '';
                file.click();
                e.preventDefault();
              }}>
                <h3><span class="file-icon"></span>Choose video file</h3>
                Your video file won't be shared.
              </button>
              <input type="file" accept="video/*" style="display: none;" @change=${function(e) {
                if (e.target.files.length === 0) return;
                let video = new Html5Video(videoFileUrl.create({}, () => e.target.files[0]));
                dialog.close();
                resolve(video);
              }}>
            </li>
          </ul>

          <button class="pure-button button-cancel" type="button" @click=${function(e) {
            dialog.close();
            resolve(null);
          }}>
            Cancel
          </button>
        </form>
      </dialog>
    `);
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

function getLanguages() {
  let langs = [];
  let langSet = new Set();
  let add = function add(lang) {
    if (langSet.has(lang)) return;
    langSet.add(lang);
    langs.push(lang);
    if (/-/.test(lang)) {
      add(lang.replace(/-.*/, ''));
    }
  };
  add(navigator.language);
  for (let lang in navigator.languages) {
    add(lang);
  }
  return langs;
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

    let proxyStatus;

    let askForMoreTracks = function askForMoreTracks() {
      return new Promise(resolve => {
        let checkButton;
        let dialog = render0(html`
          <dialog
              role="dialog"
              aria-modal="true"
              aria-labelledby="youtube-proxy-dialog-heading"
              @render=${registerDialog}
              @cancel=${function(e) {
                resolve(null);
              }}
              @close=${function(e) {
                document.body.removeChild(dialog);
              }}>
            <style>
              .youtube-proxy-form a[href],
              .youtube-proxy-form label:not(.readonly) {
                display: inline-block;
                padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
              }
            </style>
            <h2 id="youtube-proxy-dialog-heading">Check for new automatic captions</h2>

            YouTube's new auto captions don't support hotlinking.<br>
            This website can check for captions on your behalf.

            <form method="dialog" class="pure-form youtube-proxy-form"
                @submit=${async function(e) {
                  if (checkButton.disabled) return;
                  checkButton.disabled = true;
                  e.preventDefault();

                  try {
                    // This part is slow, so show progress to the user:

                    // Solve the PoW:
                    render(`Removing robots...`, proxyStatus);
                    let nonce = await newNonce();
                    let pow = await generateAsync(nonce, /*iters=*/100, /*length=*/8192);

                    render(`Checking captions...`, proxyStatus);
                    let res;
                    try {
                      res = await fetch('/ytasr_proxy/' + encodeURIComponent(videoId), {
                        method: 'POST',
                        referrer: 'no-referrer',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          nonce,
                          pow,
                        }),
                      });
                    } catch (e) {
                      render(`Error: ${e.message}`, proxyStatus);
                      return;
                    }

                    if (!res.ok) {
                      render(`Error: ${res.statusText}`, proxyStatus);
                      return;
                    }

                    let {tracks} = await res.json();
                    tracks = tracks.map(({lang, srv3Url}) => new AsrProxyTrack(videoId, lang, srv3Url));

                    dialog.close();
                    resolve(tracks);
                  } finally {
                    checkButton.disabled = false;
                  }
                }}>
              <div>
                <label class="readonly">
                  YouTube video URL:<br>
                  <input type="text" value="youtu.be/${videoId}" readonly>
                </label>
              </div>

              <div>
                <label>
                  <input type="checkbox" required checked>
                  I'm not a robot.
                </label>
              </div>

              ${checkButton = render0(html`<button class="pure-button pure-button-primary">Check</button>`)}
              <button class="pure-button button-cancel" type="button" @click=${function(e) {
                dialog.close();
                resolve(null);
              }}>
                Cancel
              </button>
            </form>

            ${proxyStatus = render0(html`<div role="alert" aria-live="polite"></div>`)}
          </dialog>
        `);
        document.body.appendChild(dialog);
        dialog.showModal();
      });
    };

    let pickerContainer;
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

        <form method="dialog" class="pure-form youtube-track-picker-form"
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
            .youtube-track-picker-form a[href] {
              display: inline-block;
              padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
            }
          </style>
          ${pickerContainer = render0(html`
            <div>
              ${picker.renderOnce()}
            </div>
          `)}

          Can't find the captions? <a href="javascript:" @click=${async function(e) {
            let moreTracks = await askForMoreTracks();
            if (moreTracks === null) return;

            let allTracks = moreTracks.concat(tracks);
            picker.setTracks(allTracks);
            picker.selectTrack(getDefaultTrack(allTracks));
            render(picker.renderOnce(), pickerContainer);
          }}>Check for more</a><br>

          <button class="pure-button pure-button-primary">Open</button>
          <button class="pure-button button-cancel" type="button" @click=${function(e) {
            dialog.close();
            resolve(null);
          }}>
            Cancel
          </button>
        </form>
      </dialog>
    `);
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

/**
 * Ask for file/YouTube/empty captions. Can't be cancelled.
 * @returns {{captions: Srt.raw Track.t, videoId: null|string}}
 */
function askForCaptions() {
  return new Promise(resolve => {
    let filePicker = makeFileInput(captions => {
      dialog.close();
      resolve({captions, videoId: null});
    });
    filePicker.style.display = 'none';
    let dialog = render0(html`
      <dialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="captions-dialog-heading"
          @render=${registerDialog}
          @cancel=${function(e) {
            e.preventDefault();
          }}
          @close=${function(e) {
            document.body.removeChild(dialog);
          }}>
        <h2 id="captions-dialog-heading">Choose captions</h2>

        <form class="pure-form" method="dialog">
          <style>
            ul.listview {
              padding: 0;
            }
            ul.listview > li {
              display: block;
            }
            ul.listview > li > button {
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

          Upload your captions, or edit someone else's.<br>
          Then, make a private link that lasts 30 days.<br>

          <ul class="listview" role="group" aria-label="Choose captions">
            <!-- File -->
            <li>
              <button class="pure-button pure-button-primary" type="button" @click=${function(e) {
                filePicker.click();
              }}>
                <h3><span class="file-icon"></span>Upload captions</h3>
                YouTube (srv3) and SRT files are supported.
              </button>
              ${filePicker}
            </li>

            <!-- YouTube -->
            <li>
              <button class="pure-button" type="button" @click=${async function(e) {
                this.disabled = true;
                let tracks, videoId;
                try {
                  let video = await askForYouTubeVideo();
                  if (video === null) return;
                  videoId = video.videoId;

                  tracks = await listTracks(videoId);
                } finally {
                  this.disabled = false;
                }

                let captions = await askForYouTubeCaptions(
                    videoId, tracks, getDefaultTrack(tracks));
                if (captions == null) return;
                dialog.close();
                resolve({captions, videoId});
              }}>
                <h3>${youtubeLogo}Edit YouTube captions</h3>
                Start with the official or automatic captions.
              </button>
            </li>

            <!-- None -->
            <li>
              <button class="pure-button" @click=${function(e) {
                resolve({
                  captions: captionsFromText(
                    '0:00 Hello\n' +
                    '0:01 <i>Narrator: Hello</i>'),
                  videoId: null,
                });
              }}>
                <h3><span class="new-icon"></span>Blank captions</h3>
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

function renderDummyVideo({html}) {
  return html`
    <video style="width: 100%; height: 100%; position: absolute; z-index: -1;" controls>
    </video>
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
   * @param {string|undefined} lastHash current value to delete
   */
  async delete(writer, signal, lastHash) {
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
   * Download captions.
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
    let {pubkeys, encryptedData, hasPopups} = await res.json();

    // Verify everything:
    perms.setWriterPublic(permissions.WriterPublic.fromJSON(pubkeys));

    return {
      value: this.deserialize(perms.decrypt(encryptedData)),
      lastHash: permissions.hashUtf8(encryptedData),
      hasPopups,
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

class AsrProxyTrack {
  /**
   * Make a new captions
   * @param {string} videoId
   * @param {string} lang language ISO code
   * @param {string} srv3Url the srv3 XML URL
   */
  constructor(videoId, lang, srv3Url) {
    this._videoId = videoId;
    this._languageIsoCode = lang;
    this._srv3Url = srv3Url;
  }

  _friendlyLanguage() {
    let isoCode = this._languageIsoCode;
    for (let {id, name} of youtubeLanguages) {
      if (id === isoCode) return name;
    }
    return `(${isoCode})`;
  }

  /**
   * @returns {string}
   */
  get name() {
    return `YouTube automatic ${this._friendlyLanguage()}`;
  }

  /**
   * @returns {string}
   */
  get id() {
    return 'ytasr-' + this._languageIsoCode;
  }

  get languageIsoCode() {
    return this._languageIsoCode;
  }

  /**
   * Get the captions
   */
  async fetchCaptions() {
    let res = await fetch(this._srv3Url);
    if (!res.ok) {
      throw new Error('Failed to fetch captions: ' + res.statusText);
    }
    return stripRaw(decodeSrv3(await res.text()));
  }
}

/**
 * Permalink thread.
 */
class Share {
  constructor(uploader, ref, setSaved, initialShare) {
    this._uploader = uploader;
    this._ref = ref;
    this._setSaved = setSaved;

    this._permalinkWidget = render0(html`
      <div style="display: flex;">
      </div>
    `);
    this._statusMessage = render0(html`
      <div role="alert" aria-live="polite">
      </div>
    `);
    this._shareButton = render0(html`
      <button class="pure-button pure-button-primary" type="submit">
        <style>
          .link-icon::before {
            content: "🔗";
          }
        </style>
        <span class="link-icon"></span>Copy link
      </button>
    `);
    this._unshareButton = render0(html`
      <button class="pure-button pure-button-active" type="reset" aria-label="Delete link">
        <style>
          .cancel-icon::before {
            content: "❌";
          }
        </style>
        <span class="cancel-icon"></span>Copy link
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
      doc: editor.getText(),
      // For karaoke:
      json3: JSON.parse(new TextDecoder().decode(editor.getJson3Captions())),
    };
  }
  /**
   * Share a doc in "unsaved" state.
   */
  static fromNewEditor(editor, initialShare) {
    let stateRef = new AsyncRef(this._stateFromEditor(editor));
    // Make sure we're synced up:
    // TODO: avoid the two history entries:
    let hasUnsavedChanges = editor.hasUnsavedChanges();
    editor.setCaptions(decodeJson3FromJson(stateRef.value.json3), /*addToHistory=*/true);
    editor.setText(stateRef.value.doc, /*addToHistory=*/true);
    if (!hasUnsavedChanges) editor.setSaved();
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
    let {value, lastHash, hasPopups} = await uploader.download(perms);

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
      editor.setCaptions(captions, /*addToHistory=*/false);
      editor.setText(doc, /*addToHistory=*/false);
      editor.setSaved();
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
      let editor = new CaptionsEditor(video, captions, {readOnly: true});
      editor.setCaptions(captions, /*addToHistory=*/false);
      editor.setText(doc, /*addToHistory=*/false);
      editor.setSaved();
      return {
        editor,
        share: Share.readonly(perms),
        hasPopups,
      };
    }
    throw new Error('invalid perms');
  }
  render() {
    // TODO: don't show the ToS line on the view page
    return html`
      <form class="pure-form"
          @submit=${function(e) {
            e.preventDefault();
          }}>
        By clicking "Copy link", I agree to the <a href="/terms">terms of service</a>.
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
  async _retryWithBackoff(f, base, exp) {
    let delay = base;
    for (;;) {
      try {
        return await f();
      } catch (e) {
        render(html`
          <details class="sync-error">
            <style>
              details.sync-error > summary {
                padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
              }
            </style>
            <summary>Error, retrying in ${delay} second${delay === 1 ? '' : 's'}.</summary>
            ${e.toString()}
          </details>
        `, this._statusMessage);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        base += exp;
      }
    }
  }
  async _waitForShare() {
    let thiz = this;
    let writer;

    // Wait for share request:
    this._updatePermalink(/*busy=*/false, /*link=*/'');
    await new Promise(resolve => thiz._shareButton.onclick = function() {
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
    let lastHash = await this._retryWithBackoff(
      () => this._uploader.upload(writer, value),
      5, 2);
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
      thiz._setSaved(false);

      sync.abort();

      resolve();
    });

    // Avoid overlapping upload/delete requests:
    await sync.join();

    // Wait for unshare response:
    await this._retryWithBackoff(
      () => this._uploader.delete(writer, undefined, lastHash),
      5, 2);
    this._updatePermalink(/*busy=*/false, /*link=*/'');
    render('Link deleted.', thiz._statusMessage);
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

        // await this._waitForUnshare({writer, lastHash: sync.lastHash, sync});
        await this._waitForUnshare({writer, sync});
      }
    } catch (e) {
      render(html`
        <details class="sync-error">
          <style>
            details.sync-error > summary {
              padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
            }
          </style>
          <summary>Error, please save your data and reload the page.</summary>
          ${e.toString()}
        </details>
      `, this._statusMessage);
      throw e;
    }
  }
}

function warnCaptionsAreUnofficial(hasVideo) {
  return new Promise(resolve => {
    let dialog = render0(html`
      <dialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="unofficial-warning-heading"
          @render=${registerDialog}
          @close=${function(e) {
            document.body.removeChild(dialog);
            resolve();
          }}
          style="width: calc(min(100%, 25em)); box-sizing: border-box;">
        <h2 id="unofficial-warning-heading">Unofficial captions</h2>

        <form method="dialog">
          ${hasVideo ?
            "The captions' author and the video's uploader are" :
            "The video's uploader is"} <b>not affiliated</b> with this website.<br>
          Anyone can create and share captions for any video for free.<br>

          <button class="pure-button pure-button-primary">I understand</button>
        </form>
      </dialog>
    `);
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

function renderEmail({html}, body) {
  let email = String.fromCharCode.apply(String, params.emailCharCodes);
  return html`<a href="mailto:${encodeURIComponent(email)}?body=${encodeURIComponent(body)}">${email}</a>`;
}

/**
 * Render the report abuse and request takedown pane.
 * @params {function} html
 * @params {string|null} videoId
 * @params {string} readFingerprint
 */
function renderReportAbuse({html}, {videoId, readFingerprint}) {
  return html`
    <details class="report-abuse">
      <style>
        details.report-abuse summary {
          padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
        }
      </style>
      <summary>Report abuse</summary>

      ${videoId ? html`
        <details>
          <summary>The video is ...</summary>
          For issues with <a href="https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}">the YouTube video</a>, please contact YouTube.
        </details>
      ` : []}

      <details>
        <summary>My captions got uploaded without my permission</summary>
        Email me this page's URL and proof that it's your captions: ${renderEmail({html},
`Captions URL: ${location.href}
Please take down my captions. Proof it's my captions: (please fill in)
`)}.<br>
      </details>

      <details>
        <summary>My video shows these captions I don't agree with</summary>
        Add a pop-up reminder that these captions can be uploaded by anyone:<br>
        <form class="pure-form" action="/add_popup" method="post" class="add-popup-form">
          <div>
            <label>
              Captions ID:
              <input readonly name="read_fingerprint" value=${readFingerprint}>
            </label>
          </div>
          <button class="pure-button pure-button-primary">Add pop-up</button>
          <button class="pure-button" type="button" @click=${function(e) {
            warnCaptionsAreUnofficial(videoId !== null);
          }}>Preview pop-up</button>
        </form>
      </details>

      <details>
        <summary>These captions are wrong</summary>
        Consider asking the author of the captions, who provided the captions to this website.<br>
        Or, you can <a href="/">create or share your own captions</a> for any video for free.
        No account needed.
      </details>

      <details>
        <summary>There is a bug in this website</summary>
        Please <a href="https://github.com/yingted/ytcc2/issues/new">report an issue on GitHub</a>.
      </details>

      <details>
        <summary>Other</summary>
        Email me the problem at ${renderEmail({html},
`Captions URL: ${location.href}

For website issues:
Preferred language: ${navigator.language}
All languages: ${navigator.languages}
Useragent: ${navigator.userAgent}

For copyright issues:
Copyrighted work: (please fill in)
`)}.<br>
      </details>
    </details>
  `;
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
  render(new CaptionsEditor(null, `0:00 [Music]`, {readOnly: true}).render(), editorPane);
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
  static EMPTY_CAPTIONS = {};
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
      let key = () => editor._rawCaptions === empty ? FileMenu.EMPTY_CAPTIONS : editor._rawCaptions;
      let updateSrv3 = () => srv3Url = srv3Blob.create(key(), () => new Blob([editor.getSrv3Captions()]));
      let updateSrt = () => srtUrl = srtBlob.create(key(), () => new Blob([editor.getSrtCaptions()]));
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
  let abusePane = document.querySelector('#abuse-pane');
  renderDummyContent({fileMenubar, videoPane, editorPane, sharePane});

  // Parse the URL:
  let perms = urlToPermissions(window.location);

  let video, editor, share, hasPopups = false;
  if (perms === null) {
    // First load, get the video and editor:

    let {captions, videoId} = await askForCaptions();

    // Preview the editor:
    editor = new CaptionsEditor(new DummyVideo(), captions);
    render(editor.render(), editorPane);

    if (videoId !== null) {
      video = new YouTubeVideo(videoId);
    } else {
      video = await askForVideo();
      if (video === null) {
        video = new DummyVideo();
      }
    }

    editor = new CaptionsEditor(video, captions);
    share = Share.fromNewEditor(editor);
  } else {
    // Restore the Share state:
    let shareEditor;
    try {
      shareEditor = await Share.loadWithEditor(perms);
    } catch (e) {
      // Clear all the sections
      render([], fileMenubar);
      render(html`
        <h2>Captions not found</h2>
        <p>
          The captions you requested can't be found.<br>
          <a href="/">Create or upload new captions</a>
        </p>
      `, editorPane);
      render([], sharePane);
      document.querySelector('#video-container').remove();
      return;
    }
    share = shareEditor.share;
    editor = shareEditor.editor;
    hasPopups = shareEditor.hasPopups;
    video = editor.video;

    // Also render the video:
    render(video.render(), videoPane);
  }

  window.editor = editor;
  window.share = share;

  // Render the real content:
  let fileMenu = new FileMenu(video, editor);
  render(fileMenu.render(), fileMenubar);
  render(video.render(), videoPane);
  render(editor.render(), editorPane);
  render(share.render(), sharePane);

  if (editor.readOnly) {
    document.querySelector('h1').textContent = 'View captions';

    render(renderReportAbuse(
      {html},
      {
        videoId: video instanceof YouTubeVideo ? video.videoId : null,
        readFingerprint: perms.fingerprint,
      }),
      abusePane);

    if (hasPopups) {
      await warnCaptionsAreUnofficial(video instanceof YouTubeVideo);
    }
  }
})();
