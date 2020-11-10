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
import {decodeJson3, toHtml} from 'ytcc2-captions';

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

class Timer {
  constructor(callback) {
    this.callback = callback;
    // Last value from setOn
    this.on = false;
    // Whether _onRenderThis will be called soon.
    this.scheduled = false;
    this._onRenderThis = this._onRender.bind(this);
  }

  setOn(on) {
    if (on === this.on) return;
    this.on = on;
    // Schedule it if needed:
    if (on && !this.scheduled) {
      this.scheduled = true;
      window.requestAnimationFrame(this._onRenderThis);
    }
  }

  _onRender() {
    if (this.on) {
      this.callback();
      window.requestAnimationFrame(this._onRenderThis);
    } else {
      this.scheduled = false;
    }
  }
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
    this.ready = false;
    this.timer = new Timer(this._update.bind(this));
    this._handlers = [];
    // TODO: fix this
    this.captions = decodeJson3(params.captions);
    this.captionsRegion = null;
    this.html = null;
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
          background-color: black;
          color: white;
          font-family: Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, sans-serif;
          white-space: pre-wrap;
        }
      </style>
      <div class="player-container" style=${styleMap({
        width: this.width + 'px',
        height: this.height + 'px',
      })}>
        <iframe id=${id} width=${this.width} height=${this.height} frameborder="0" src=${src}
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
   * Sets the current time.
   * @param t {number} the video time in seconds
   * @param allowSeekAhead {boolean} whether to request unbuffered video
   */
  seekTo(t, allowSeekAhead) {
    this.player.seekTo(t, allowSeekAhead);
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
    return this.player.getCurrentTime();
  }

  _onReady(event) {
    this.ready = true;
  }

  _onStateChange(event) {
    if (!this.ready) return;
    switch (event.data) {
      case YT.PlayerState.PLAYING:
        this.timer.setOn(true);
        break;
      case YT.PlayerState.PAUSED:
      case YT.PlayerState.BUFFERING:
        this.timer.setOn(false);
        break;
      default:
        return;
    }
    this._update();
  }

  _update() {
    let t = this.getCurrentTime();
    for (let cb of this._handlers) {
      cb.call(this, t);
    }

    this.html = toHtml({html, styleMap}, this.captions, t);
    render(this.html, this.captionsRegion);
  }
}
