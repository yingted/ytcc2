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

import {getGapi} from './google.js';

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

  fetchJson3Ytdata() {
    if (!this.ytdataId) throw new Error('not from YT data API');
    return getYoutubeApi().then(youtube => {
      return youtube.captions.download({id: this.ytdataId, tfmt: 'json3', tlang: this.lang})
        .then(data => {
          return JSON.parse(data);
        });
    });
  }
}

/**
 * List the captions for a video.
 * @param {string} videoId
 * @returns {Promise<Track>}
 */
export function listTracksYtinternal(videoId) {
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

function getYoutubeApi() {
  let ytapi = getGapi().then(gapi => {
    return gapi.client.load("https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest")
      .then(() => {
        return gapi.client.youtube;
      });
  });
  getYoutubeApi = () => ytapi;
  return getYoutubeApi();
}

/**
 * List captions for a video.
 * Does not work for unlisted videos.
 */
function listTracksYtdata(videoId) {
  getYoutubeApi().then(youtube => {
    return youtube.captions.list({videoId, part: ["id", "snippet"]})
      .then(tracks => {
        return tracks.items.map(track => {
          return new Track({
            videoId,
            name: track.name,
            lang: track.language,
            ytdataId: track.id,
          });
        });
      });
  });
}

function listTracks(videoId) {
  return listTracksYtinternal(videoId)
    .catch(err => {
      if (!window.confirm(
        'Couldn\'t get captions list through YouTube\'s internal API. ' +
        'Try YouTube\'s official API? (requires sending your identity)')) {
        throw err;
      }
      return listTracksYtdata(videoId);
    });
}

/**
 * @returns {Promise<JSON3Track>}
 */
function insertTrack(videoId, trackName, track) {
  getYoutubeApi()
    .then(youtube => {
      youtube.captions.insert({
        part: ['id'],
        sync: false,
      });
    });
}

/**
 * @returns {Promise<JSON3Track>}
 */
function updateTrack(videoId, trackName, track) {
  getYoutubeApi()
    .then(youtube => {
      youtube.captions.update({
        part: ['id'],
        sync: false,
      });
    });
}
