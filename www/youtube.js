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

import {html} from 'lit-html';
import {randomUuid, onRender} from './util.js';

 /**
  * Wait for `YT.Player` to be ready.
  */
function waitForYouTubeIframeAPI() {
  let ready = new Promise(resolve => {
    window.onYouTubeIframeAPIReady = resolve;
  });
  waitForYouTubeIframeAPI = () => ready;

  var tag = document.createElement('script');

  tag.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  return waitForYouTubeIframeAPI();
}

/**
 * Wrapper for the YouTube IFrame Player API.
 * You can't use more than one of these at once.
 */
export class YouTubeVideo {
  /**
   * Construct a video player.
   * @param {string} videoId 
   * @param {number} [options.height=390]
   * @param {number} [options.width=640]
   */
  constructor(videoId, options) {
    this.videoId = videoId;
    options = options || {};
    this.height = options.height ?? 390;
    this.width = options.width ?? 640;
    this.player = null;
  }

  /**
   * @returns {TemplateResult}
   */
  render() {
    let id = 'youtube-player-' + randomUuid();
    let src = `https://www.youtube.com/embed/${encodeURIComponent(this.videoId)}?enablejsapi=1`;
    return html`
      <iframe id=${id} width=${this.width} height=${this.height} frameborder="0" src=${src}
        @render=${onRender(() => {
          waitForYouTubeIframeAPI().then(() => {
            this.player = new YT.Player(id, {
              events: {
                onReady: this._onReady,
                onStateChange: this._onStateChange,
              },
            });
          });
        })}></iframe>
    `;
  }

  _onReady(event) {
  }

  _onStateChange(event) {
  }
}