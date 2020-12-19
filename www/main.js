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
import {asyncReplace} from 'lit-html/directives/async-replace.js';
import {YouTubeVideo} from './youtube.js';
import {CaptionsEditor} from './editor.js';
import {decodeJson3FromJson, decodeSrv3, decodeSrt, stripRaw} from 'ytcc2-captions';
import {listTracks} from './youtube_captions.js';
import {onRender} from './util.js';
import dialogPolyfill from 'dialog-polyfill';
import {youtubeLanguages} from './gen/youtube_languages.js';
import {renderBrowser} from './preview_browser.js';
import {myReceiptsText, myReceiptsLink, renderFileReceipt, renderCookieReceipts, addCookie, renderFileReceiptString} from './receipt.js';
import {AsyncRef, Signal} from './util.js';
import {sign_keyPair} from 'tweetnacl-ts';
import {script} from './script_web.js';
import {ObjectUrl} from './object_url.js';

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

class UnofficialTrack {
  /**
   * @param {string} options.captionsId
   * @param {string} options.language
   * @param {string} options.srt
   */
  constructor(options) {
    Object.assign(this, options);
  }

  getCaptions() {
    return decodeSrt(this.srt);
  }

  friendlyLanguage() {
    let isoCode = this.language;
    for (let {id, name} of youtubeLanguages) {
      if (id === isoCode) return name;
    }
    return `(${isoCode})`;
  }
}

function getTrackId(track) {
  if (track instanceof UnofficialTrack) {
    return 'unofficial-' + track.captionsId;
  } else {
    return 'youtube-' + track.lang;
  }
}

function getFriendlyName(track) {
  if (track instanceof UnofficialTrack) {
    return `Unofficial ${track.friendlyLanguage()} (${track.captionsId})`;
  } else {
    return `YouTube ${track.langOriginal}`;
  }
}

// Video model/view:
const video = new YouTubeVideo(params.videoId);
window.video = video;

// Save as model/view:
const srtUrl = new ObjectUrl();
const srv3Url = new ObjectUrl();
const BaseNameState = Object.freeze({
  // Initially default value:
  PREFILLED: Symbol('prefilled'),
  // Logically default, but cleared to prevent filtering:
  FOCUSED: Symbol('focused'),
  // onchange fired:
  MODIFIED: Symbol('modified'),
});
const saveAs = new AsyncRef({
  /** @type {CaptionsEditor|null} */
  editor: null,
  /** @type {string} */
  baseName: 'captions',
  /** @type {string} */
  videoIdBaseName: 'captions',
  /** @type {string|null} */
  titleBaseName: null,
  baseNameState: BaseNameState.PREFILLED,
  fileType: 'srv3',
});
const saveAsView = saveAs.map(state => {
  let {editor, baseName, videoIdBaseName, titleBaseName, baseNameState, fileType} = state;
  let fileName = baseName;
  let blobUrl = '';
  if (editor !== null) {
    let captions = editor._rawCaptions;
    switch (fileType) {
      case 'srv3':
        blobUrl = srv3Url.create(captions, () => new Blob([editor.getSrv3Captions()]));
        fileName += '.srv3.xml';
        break;
      case 'srt':
        blobUrl = srtUrl.create(captions, () => new Blob([editor.getSrtCaptions()]));
        fileName += '.srt';
        break;
    }
  }

  return html`
    <dialog class="fixed" @render=${registerDialog} style="
        width: 25em;
        max-width: 100%;
        max-height: 100%;
        box-sizing: border-box;
        overflow-y: auto;">
      <h2><span class="save-icon"></span>Save as</h2>

      <form method="dialog" class="save-form">
        <style>
          .save-input-group {
            padding: 0.2em 0;
          }
          .save-form > fieldset {
            width: 100%;
            min-width: 100%;
            box-sizing: border-box;
          }
          .save-form select,
          .save-form input,
          .save-input-group button {
            height: var(--touch-target-size);
          }
          .save-form a[href] {
            display: inline-block;
            padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
          }
        </style>

        <div>
          <label>
            Name: 
            <input list="save-basenames" name="basename" .value=${live(baseNameState === BaseNameState.FOCUSED ? '' : baseName)}
                @click=${function(e) {
                  if (baseNameState === BaseNameState.PREFILLED) {
                    saveAs.value = Object.assign({}, state, {
                      baseNameState: BaseNameState.FOCUSED,
                    });
                  }
                }}
                @focus=${function(e) {
                  if (baseNameState === BaseNameState.PREFILLED) {
                    saveAs.value = Object.assign({}, state, {
                      baseNameState: BaseNameState.FOCUSED,
                    });
                  }
                }}
                @blur=${function(e) {
                  if (baseNameState === BaseNameState.FOCUSED) {
                    saveAs.value = Object.assign({}, state, {
                      baseNameState: BaseNameState.PREFILLED,
                    });
                  }
                }}
                @change=${function(e) {
                  saveAs.value = Object.assign({}, state, {
                    baseName: this.value,
                    baseNameState: BaseNameState.MODIFIED,
                  });
                }}>
            <datalist id="save-basenames">
              <!-- lit-html seems to need closing tags: -->
              <option value=${videoIdBaseName}></option>
              ${titleBaseName !== null ? html`<option value=${titleBaseName}></option>` : []}
            </datalist>
          </label>
        </div>

        <div>
          <label>
            File type:
            <select name="filetype" @change=${function(e) {
              saveAs.value = Object.assign({}, state, {
                fileType: this.value,
              });
            }}>
              <option value="srv3" selected>YouTube serving format 3 (.srv3.xml)</option>
              <option value="srt">SubRip Text (.srt)</option>
            </select>
          </label>
        </div>

        Download link: <a href=${blobUrl} download=${fileName}>${fileName}</a>

        <div class="save-input-group">
          <button type="submit"><span class="cancel-icon"></span>Close</button>
        </div>
      </form>
    </dialog>
  `;
});

// Editor model/view:
const editor = window.editor = new AsyncRef({
  // Start the editor as null to avoid drawing an empty editor.
  /** @type {CaptionsEditor|null} */
  editor: null,
  /** @type {string|null} */
  language: null,
});
const editorView = editor.map(function renderEditorAndToolbar({editor, language}) {
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
    </style>

    <ul class="toolbar" aria-label="Toolbar">
      <li>
        ${asyncReplace(saveAsView.observe())}
        <button @click=${function(e) {
          // Safe base name:
          let languageSuffix = language === null ? '' : '.' + language;
          let videoIdBaseName = params.videoId + languageSuffix;

          // Friendly base name:
          let titleBaseName = null;
          let title = null;
          try {
            title = video.player.getVideoData().title;
          } catch (e) {}
          if (typeof title === 'string') {
            titleBaseName = title + languageSuffix;
          }

          saveAs.value = Object.assign({}, saveAs.value, {
            editor,
            videoIdBaseName,
            titleBaseName,
            baseName: videoIdBaseName,
            baseNameState: BaseNameState.PREFILLED,
          });
          let dialog = this.parentElement.querySelector('dialog');
          dialog.showModal();
        }}><span class="save-icon"></span>Save as</button>
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
    </ul>
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
        window.location.href = `/watch?v=${params.videoId}&id=${captionsId}`;

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
          You need your receipt to edit or delete your captions.<br>
          You can save your receipt to a file, or to ${myReceiptsLink({html})}, which uses cookies to track your receipts.
          ${initialized ? renderPreview(receipt) : []}
          <br>
          Save receipt to:<br>
          <style>
            .cookie-icon::before {
              content: "🍪";
            }
          </style>
          <div class="publish-receipt-choice">
            <label>
              <input type="radio" name="receipt" value="file-and-cookie" required ?checked=${receiptType === "file-and-cookie"} @change=${receiptTypeChange}>
              <span class="cookie-icon"></span>Both a receipt file and ${myReceiptsText({html})}
            </label>
          </div>
          <div class="publish-receipt-choice">
            <label>
              <input type="radio" name="receipt" value="file" required ?checked=${receiptType === "file"} @change=${receiptTypeChange}>
              Only a receipt file
            </label>
          </div>
          <div class="publish-receipt-choice">
            <label>
              <input type="radio" name="receipt" value="cookie" required ?checked=${receiptType === "cookie"} @change=${receiptTypeChange}>
              <span class="cookie-icon"></span>Only ${myReceiptsText({html})}
            </label>
          </div>
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

class TrackPicker {
  constructor() {
    // Track picker model, representing programmatic changes:
    this.model = new AsyncRef({
      tracks: [],  // YT tracks
      selectedTrack: null,
    });
    // Signal for picking YouTube captions.
    // Also allow picking null (synthetic only).
    /** @type {Signal<Track>} */
    this.pick = new Signal();
    // Signal for a captions file opened.
    /** @type {Signal<Srt.raw Track.t>} */
    this.openFile = new Signal();
    /** @type {AsyncRef<TemplateResult>} */
    this.view = this.model.map(({tracks, selectedTrack}) => {
      let thiz = this;
      let filePicker;
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
            // Set the track to null:
            let {tracks, selectedTrack} = thiz.model.value;
            selectedTrack = null;
            thiz.model.value = {tracks, selectedTrack};
            thiz.openFile.emit(captions);
          }

          if (this.files === files) {
            this.value = null;
          }
        });
      };
      return html`
        <style>
          h1 {
            font-size: 1.5em;
            padding: 0;
            margin: 0;
          }
          h1 select {
            height: var(--touch-target-size);
          }
        </style>
        <h1>
          <input type="file"
            style="display: none;"
            accept=".srt,text/srt,.xml,application/xml"
            @render=${onRender(function() { filePicker = this; })}
            @change=${openFile}>
          <label style="width: 100%; display: flex; align-items: center;">
            <span style="white-space: pre;">Captions: </span>
            <select style="flex-grow: 1; min-width: 0;" @change=${function() {
              let {tracks, selectedTrack} = thiz.model.value;

              if (this.value === 'open-file') {
                // Switch the picker back to the old value and show the dialog:
                this.value =
                  selectedTrack === null ? 'none' : 'youtube-' + selectedTrack.lang;
                filePicker.click();
                return;
              }

              selectedTrack = null;
              for (let track of tracks) {
                if (getTrackId(track) === this.value) {
                  selectedTrack = track;
                  break;
                }
              }

              thiz.model.value = {tracks, selectedTrack};
              thiz.pick.emit(selectedTrack);
            }}>
              <!-- null track, which users can't select -->
              ${selectedTrack === null ? html`<option value="none" selected></option>` : []}
              <option value="open-file">Choose file</option>
              <optgroup label="YouTube">
                ${tracks.filter(track => !(track instanceof UnofficialTrack)).map(track =>
                  html`<option value="${getTrackId(track)}" ?selected=${selectedTrack === track}>${getFriendlyName(track)}</option>`
                )}
              </optgroup>
              <optgroup label="Unofficial">
                ${tracks.filter(track => track instanceof UnofficialTrack).map(track =>
                  html`<option value="${getTrackId(track)}" ?selected=${selectedTrack === track}>${getFriendlyName(track)}</option>`
                )}
              </optgroup>
            </select>
          </label>
        </h1>
      `;
    });
  }
  /**
   * Redraw this widget and fire a synthetic change event.
   */
  onLoaded(tracks, selectedTrack) {
    this.model.value = {tracks, selectedTrack};
    this.pick.emit(selectedTrack);
  }
  render() {
    return asyncReplace(this.view.observe());
  }
}
const trackPicker = window.trackPicker = new TrackPicker();

// Render the page once:
let trackPickerPrompt = document.createElement('DIV');
render(html`
  <style>
    :root {
      --touch-target-size: 48px;
    }
  </style>

  <nav>
    <style>
      ul.navbar {
        width: 100%;
        min-width: 0;
        list-style-type: none;
        padding: 0;
        margin: 0 -1em 0 0;
      }
      ul.navbar > li {
        display: inline-block;
        margin: 0 1em 0 0;
      }
      ul.navbar > li > a[href] {
        display: inline-block;
        padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
      }
      .pencil-icon::before {
        content: "✏️";
      }
      .bug-icon::before {
        content: "🐛";
      }
    </style>
    ${trackPicker.render()}
    ${trackPickerPrompt}

    <ul class="navbar">
      <li>
        <a href="https://studio.youtube.com/video/${params.videoId}/translations"
            aria-label="Edit in YouTube Studio">
          <span class="pencil-icon"></span>${youtubeLogo} Studio
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

      <li>
        ${myReceiptsLink({html})}
      </li>
    </ul>
  </nav>

  <main>
    ${video.render()}
    <hr>
    ${asyncReplace(editorView.observe())}
  </main>
`, document.body);

let pickCaptionsDialog = document.querySelector('.pick-captions-dialog');
if (pickCaptionsDialog !== null) {
  pickCaptionsDialog.showModal();
}

// Main controller, binding everything together:

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
            <button type="submit"><span class="accept-icon"></span>${getFriendlyName(unofficial)}</button>
            <button type="button" @click=${function() {
              confirmed = false;
              this.closest('dialog').close();
            }}><span class="cancel-icon"></span>${getFriendlyName(official)}</button>
          </div>
        </form>
      </dialog>
      `, trackPickerPrompt);
    trackPickerPrompt.querySelector('dialog').showModal();
  });
}

(async function main() {
  let tracks = await listTracks(params.videoId);
  window.tracks = tracks;
  let track = getDefaultTrack(tracks);
  // Make sure we don't pick this as the default:
  for (let track of params.tracks) {
    tracks.push(new UnofficialTrack(track));
  }
  let requestedUnofficialTrack = (function() {
    if (params.captionsId == null) return null;
    for (let track of tracks) {
      if (track instanceof UnofficialTrack && track.captionsId === params.captionsId) {
        return track;
      }
    }
    return null;
  })();
  if (requestedUnofficialTrack !== null) {
    let allowUnofficial = await confirmOpenUnofficialTrack(requestedUnofficialTrack, track);
    if (allowUnofficial) {
      track = requestedUnofficialTrack;
    }
  }

  let setCaptions = function setCaptions(editor, captions) {
    if (editor === null) {
      editor = new CaptionsEditor(video, captions);
    } else {
      editor.setCaptions(captions, /*addToHistory=*/true, /*isSaved=*/true);
    }
    return editor;
  };
  trackPicker.pick.addListener(async track => {
    let {editor: editor_, language} = editor.value;

    // Load the data:
    let captions;
    language = null;
    if (track !== null) {
      if (track instanceof UnofficialTrack) {
        captions = track.getCaptions();
        language = track.language;
      } else {
        captions = stripRaw(decodeJson3FromJson(await track.fetchJson3()));
        language = track.lang;
      }
    }

    // If we've been cancelled, return:
    if (track !== trackPicker.model.value.selectedTrack) {
      return;
    }

    editor_ = setCaptions(editor_, captions);

    editor.value = {editor: editor_, language};
  });
  trackPicker.openFile.addListener(captions => {
    let {editor: editor_, language} = editor.value;
    editor_ = setCaptions(editor_, captions);
    editor.value = {editor: editor_, language};
  });
  trackPicker.onLoaded(tracks, track);
})();
