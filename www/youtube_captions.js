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

class Track {
  /**
   * Make a new captions
   * @param {string} options.videoId
   * @param {string} options.name track name, used to fetch the track
   * @param {string} options.lang language iso code
   * @param {?string} options.ytdataId ID for new YT data API
   */
  constructor(options) {
    Object.assign(this, options);
  }

  /**
   * Get the captions
   */
  fetchJson3() {
    return fetch('https://www.youtube-nocookie.com/api/timedtext?' +
      'v=' + encodeURIComponent(this.videoId) + '&' +
      'lang=' + encodeURIComponent(this.lang) + '&' +
      'name=' + encodeURIComponent(this.name) + '&' +
      'fmt=json3')
    .then(res => {
      if (!res.ok) {
        throw new Error('could not get captions through youtube.com/api');
      }
      return res.json();
    });
  }
}

/**
 * List the captions for a video.
 * @param {string} videoId
 * @returns {Promise<Track>}
 */
export function listTracks(videoId) {
  return fetch('https://www.youtube-nocookie.com/api/timedtext?v=' + encodeURIComponent(videoId) + '&type=list&tlangs=1&asrs=1')
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
        captions.push(new Track({
          videoId,
          lang: track.getAttribute('lang_code'),
          name: track.getAttribute('name'),
        }));
      }
      return captions;
    });
}
