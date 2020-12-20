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

/**
 * Wrapper around youtube.com/api/timedtext
 * Usage:
 * (await listTracks(videoId)).forEach(track =>
 *     console.log(track, JSON.stringify(track.fetchJson3())));
 */

class YouTubeTrack {
  /**
   * Make a new captions
   * @param {string} options.videoId
   * @param {string} options.name track name, used to fetch the track
   * @param {string} options.lang language iso code
   * @param {string} options.langOriginal language in the language
   * @param {string} options.langTranslated language in our language
   * @param {string} options.langDefault maybe the default for this language?
   */
  constructor({videoId, name, lang, langOriginal, langTranslated, langDefault}) {
    this._videoId = videoId;
    this._trackName = name;
    this._languageIsoCode = lang;
    this._languageInLanguage = langOriginal;
    this._languageName = langTranslated;
    this._isDefault = langDefault;
  }

  /**
   * @returns {string}
   */
  get name() {
    let name = this._trackName;
    if (name) {
      name = ` (${name})`;
    }
    return `YouTube ${this._languageInLanguage}${name}`;
  }

  /**
   * @returns {string}
   */
  get id() {
    return 'youtube-' + this._languageIsoCode + '--' + this._trackName;
  }

  /**
   * Get the captions
   */
  async fetchJson3() {
    const res = await fetch('https://www.youtube-nocookie.com/api/timedtext?' +
      'v=' + encodeURIComponent(this._videoId) + '&' +
      'lang=' + encodeURIComponent(this._languageIsoCode) + '&' +
      'name=' + encodeURIComponent(this._trackName) + '&' +
      'fmt=json3');
    if (!res.ok) {
      throw new Error('could not get captions through youtube.com/api');
    }
    return res.json();
  }
}

/**
 * List the captions for a video.
 * @param {string} videoId
 * @returns {Promise<YouTubeTrack>}
 */
export function listTracks(videoId) {
  return fetch('https://www.youtube-nocookie.com/api/timedtext?v=' + encodeURIComponent(videoId) + '&type=list&asrs=1')
    .then(res => {
      if (!res.ok) {
        throw new Error('could not list captions through youtube.com/api');
      }
      return res.text();
    })
    .then(text => {
      let doc = new DOMParser().parseFromString(text, 'text/xml');
      let captions = [];
      for (let track of doc.querySelectorAll('transcript_list > track')) {
        captions.push(new YouTubeTrack({
          videoId,
          name: track.getAttribute('name'),
          lang: track.getAttribute('lang_code'),
          langOriginal: track.getAttribute('lang_original'),
          langTranslated: track.getAttribute('lang_translated'),
          langDefault: track.getAttribute('lang_default') == 'true',
        }));
      }
      return captions;
    });
}

/**
 * Get the YouTube default track based on navigator.language.
 * @param {YouTubeTrack[]} tracks
 * @returns {YouTubeTrack|null}
 */
export function getDefaultTrack(tracks) {
  let languages = [navigator.language];
  if (/-/.test(navigator.language)) {
    languages.push(navigator.language.replace(/-.*/, ''));
  }
  for (let language of languages) {
    for (let track of tracks) {
      if (track._languageIsoCode === language && track._isDefault) return track;
    }
    for (let track of tracks) {
      if (track._languageIsoCode === language) return track;
    }
  }
  if (tracks.length > 0) return tracks[0];
  return null;
}
