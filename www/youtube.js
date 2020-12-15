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
import {styleMap} from 'lit-html/directives/style-map.js';
import {randomUuid, onRender} from './util.js';
import {empty, toHtml} from 'ytcc2-captions';

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
  document.head.appendChild(tag);

  return waitForYouTubeIframeAPI();
}

/**
 * Wrapper for the YouTube IFrame Player API.
 * You can't use more than one of these at once.
 * this.captions is a 'raw t you can update.
 */
export class YouTubeVideo {
  /**
   * Construct a video player.
   * @param {string} videoId 
   * @param {object} [options.captions=empty]
   */
  constructor(videoId, options) {
    this.videoId = videoId;
    options = options || {};
    this.player = null;
    this.ready = false;
    this._handlers = [];
    this.captions = options.captions || empty;
    this.captionsRegion = null;
    this._lastUpdateCaptions = null;
    this._lastUpdateTime = null;
    this.html = null;

    let updateThis = this._update.bind(this);
    window.requestAnimationFrame(function onAnimationFrame() {
      try {
        updateThis();
      } finally {
        window.requestAnimationFrame(onAnimationFrame);
      }
    });
  }

  /**
   * @returns {TemplateResult}
   */
  render() {
    let id = 'youtube-player-' + randomUuid();
    let src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.videoId)}?enablejsapi=1`;
    let thiz = this;
    return html`
      <style>
        .player-container {
          position: relative;
        }
        .captions-region {
          position: absolute;
          text-align: center;
          pointer-events: none;
          display: flex;
          /* Captions region */
          left: 0%;
          right: 0%;
          top: 50%;
          bottom: 12%;
        }
        /* flex child to stick to the bottom */
        .captions-bbox {
          margin-top: auto;
          width: 100%;
          pointer-events: none;
        }
        /* Correctly-sized line boxes */
        .captions-text {
          pointer-events: auto;
          /* background-color: black; */
          /* color: white; */
          /* YouTube-like fonts: */
          font-family: Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, sans-serif;
          white-space: pre-wrap;
        }
      </style>
      <div class="player-container" style=${styleMap({
        position: 'relative',
        width: '100%',
        'padding-bottom': 'calc(56.25% + 30px)',
      })}>
        <iframe id=${id} width="100%" height="100%" style="position: absolute;" frameborder="0" src=${src}
          title="YouTube player"
          @render=${onRender(() => {
            waitForYouTubeIframeAPI().then(() => {
              this.player = new YT.Player(id, {
                events: {
                  onReady: this._onReady.bind(this),
                  onStateChange: this._onStateChange.bind(this),
                },
              });
            });
          })}></iframe>
        <div class="captions-region" @render=${onRender(function() {
          thiz.captionsRegion = this;
        })}>
          <div class="captions-bbox">
          <!--
            <div class="captions-cue"><span class="captions-text">The quick brown fox jumped over the lazy dogs. The quick brown fox jumped over the lazy dogs.</span></div>
            <div class="captions-cue"><span class="captions-text">The quick brown fox jumped over the lazy dogs.</span></div>
          -->
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Add a callback f.call(this, this.getCurrentTime()) for the update (per frame).
   * Duplicates are not added.
   */
  addUpdateListener(f) {
    if (this._handlers.indexOf(f) === -1) {
      this._handlers.push(f);
    }
  }

  /**
   * Remove a callback for the update.
   */
  removeUpdateListener(f) {
    let i = this._handlers.indexOf(f);
    if (i !== -1) {
      this._handlers.splice(i, 1);
    }
  }

  getCurrentTime() {
    if (!this.ready) return 0;
    return this.player.getCurrentTime();
  }
  /**
   * Sets the current time.
   * @param t {number} the video time in seconds
   */
  seekTo(time) {
    if (!this.ready) return;
    this.player.seekTo(time, /*allowSeekAhead=*/true);
  }

  _onReady(event) {
    this.ready = true;
  }

  _onStateChange(event) {
    if (!this.ready) return;
    switch (event.data) {
      case YT.PlayerState.PLAYING:
        break;
      case YT.PlayerState.PAUSED:
      case YT.PlayerState.BUFFERING:
        break;
      default:
        return;
    }
    this._update();
  }

  _update() {
    let t = this.getCurrentTime();

    // Suppress duplicate updates:
    if (this._lastUpdateCaptions === this.captions && this._lastUpdateTime === t) {
      return;
    }
    this._lastUpdateCaptions = this.captions;
    this._lastUpdateTime = t;

    // Callbacks:
    for (let cb of this._handlers) {
      cb.call(this, t);
    }

    // Render captions:
    if (this.captionsRegion !== null) {
      this.html = toHtml({html, styleMap}, this.captions, t);
      render(this.html, this.captionsRegion);
    }
  }
}
