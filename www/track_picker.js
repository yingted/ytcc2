import {html} from 'lit-html';
import {asyncReplace} from 'lit-html/directives/async-replace.js';
import {decodeJson3, decodeJson3FromJson, decodeSrv3, decodeSrt, stripRaw} from 'ytcc2-captions';
import {youtubeLanguages} from './gen/youtube_languages.js';
import {AsyncRef, onRender, Signal} from './util.js';
import dialogPolyfill from 'dialog-polyfill';

// Dialogs need this as @render:
let registerDialog = onRender(function() {
  dialogPolyfill.registerDialog(this);
});

export class UnofficialTrack {
  /**
   * @param {string} options.captionsId
   * @param {string} options.language
   * @param {string} options.srt
   */
  constructor({captionsId, language, srt}) {
    this.captionsId = captionsId;
    this._languageIsoCode = language;
    this._srt = srt;
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
    return `Unofficial ${this._friendlyLanguage()} (${this.captionsId})`;
  }

  /**
   * @returns {string}
   */
  get id() {
    return 'unofficial-' + this.captionsId;
  }

  getCaptions() {
    return decodeSrt(this._srt);
  }
}

/**
 * Decode the captions.
 * @param {string} fileName
 * @param {ArrayBuffer} buffer
 * @returns {Srt.raw Track.t|null}
 */
function decodeCaptionsOrAlert(fileName, buffer) {
  let captions = null;

  let trySrt = function trySrt(verbose) {
    try {
      captions = decodeSrt(buffer);
      return true;
    } catch (e) {
      if (verbose) {
        console.error(e);
        alert('Error importing SRT file: ' + fileName);
      }
    }
    return false;
  };
  let trySrv3 = function trySrv3(verbose) {
    try {
      captions = stripRaw(decodeSrv3(buffer));
      return true;
    } catch (e) {
      if (verbose) {
        console.error(e);
        alert('Error importing srv3 file: ' + fileName);
      }
    }
    return false;
  };
  let tryJson3 = function tryJson3(verbose) {
    try {
      captions = stripRaw(decodeJson3(buffer));
      return true;
    } catch (e) {
      if (verbose) {
        console.error(e);
        alert('Error importing srv3 file: ' + fileName);
      }
    }
    return false;
  };

  // If a file type was specified, pick that:
  if (fileName.toLowerCase().endsWith('.srt')) {
    trySrt(/*verbose=*/true);
    return captions;
  }
  if (fileName.toLowerCase().endsWith('.xml')) {
    trySrv3(/*verbose=*/true);
    return captions;
  }
  if (fileName.toLowerCase().endsWith('.json')) {
    tryJson3(/*verbose=*/true);
    return captions;
  }

  // Try guessing file types:
  if (trySrt(/*verbose=*/false)) return captions;
  if (trySrv3(/*verbose=*/false)) return captions;
  if (tryJson3(/*verbose=*/false)) return captions;

  alert('Captions file name should end with .srt or .xml: ' + fileName);
  return null;
}

/**
 * Advanced track picker which uses separate handling for file and web captions.
 */
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
          let captions = decodeCaptionsOrAlert(file.name, buffer);

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
        <select @change=${function() {
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
            if (track.id === this.value) {
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
              html`<option value="${track.id}" ?selected=${selectedTrack === track}>${track.name}</option>`
            )}
          </optgroup>
          <optgroup label="Unofficial">
            ${tracks.filter(track => track instanceof UnofficialTrack).map(track =>
              html`<option value="${track.id}" ?selected=${selectedTrack === track}>${track.name}</option>`
            )}
          </optgroup>
        </select>
        <!-- label uses the first input, so put the hidden input second -->
        <input type="file"
          style="display: none;"
          accept=".srt,text/srt,.xml,application/xml,.json,application/json"
          @render=${onRender(function() { filePicker = this; })}
          @change=${openFile}>
      `;
    });
  }

  /**
   * @returns {Track[]}
   */
  getTracks() {
    return this.model.value.tracks.slice(0);
  }
  /**
   * @params {Track[]} tracks
   */
  setTracks(tracks) {
    let {tracks: oldTracks, selectedTrack} = this.model.value;
    let emit = false;
    if (tracks.indexOf(selectedTrack) === -1 &&
        selectedTrack !== null) {
      selectedTrack = null;
      emit = true;
    }
    this.model.value = {
      tracks,
      selectedTrack,
    };
    this.pick.emit(selectedTrack);
  }
  selectTrack(track) {
    if (this.model.value.tracks.indexOf(track) === -1 ||
        this.model.value.selectedTrack === track) {
      return;
    }
    this.model.value = {
      tracks: this.model.value.tracks,
      selectedTrack: track,
    };
    this.pick.emit(track);
  }

  render() {
    return asyncReplace(this.view.observe());
  }
}

/**
 * Easier version of TrackPicker.
 * captionsChange is emitted each time captions are picked.
 * The default value is {captions: null, language: null, type: null}.
 * Files don't have a language.
 */
export class CaptionsPicker {
  constructor() {
    this._trackPicker = new TrackPicker();
    this.captionsChange = new Signal();

    this._trackPicker.pick.addListener(async track => {
      if (track === null) {
        this.captionsChange.emit({
          captions: null,
          language: null,
          type: null,
        });
        return;
      }

      // Load the data:
      let state;
      if (track instanceof UnofficialTrack) {
        state = {
          captions: track.getCaptions(),
          language: track.language,
          type: 'unofficial',
        };
      } else {
        state = {
          captions: stripRaw(decodeJson3FromJson(await track.fetchJson3())),
          language: track.lang,
          type: 'youtube',
        };
      }

      // If we've been cancelled (during await), return:
      if (track !== this._trackPicker.model.value.selectedTrack) {
        return;
      }

      this.captionsChange.emit(state);
    });

    this._trackPicker.openFile.addListener(captions => {
      this.captionsChange.emit({
        captions,
        language: null,
        type: 'file',
      });
    });
  }
  getTracks() {
    return this._trackPicker.getTracks();
  }
  setTracks(tracks) {
    this._trackPicker.setTracks(tracks);
  }
  selectTrack(tracks) {
    this._trackPicker.selectTrack(tracks);
  }
  render() {
    return this._trackPicker.render();
  }
}
