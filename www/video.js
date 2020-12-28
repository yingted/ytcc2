import {html, render} from 'lit-html';
import {styleMap} from 'lit-html/directives/style-map.js';
import {onRender, Signal} from './util.js';
import {empty, toHtml} from 'ytcc2-captions';


/**
 * Dummy video element.
 */
export class DummyVideo {
  constructor(title, options) {
    this._title = title || '';
    options = options || {};
    this._time = 0;
    this._update = new Signal();
    this.captions = options.captions || empty;
    this.captionsRegion = null;
    // Duplicate suppression:
    this._lastUpdateCaptions = null;
    this._lastUpdateTime = null;
  }

  /**
   * @returns {TemplateResult}
   */
  render() {
    let thiz = this;
    return html`
      <style>
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
      <div style="width: 100%; height: 100%; background-color: #ccc;">
        ${this._title}
      </div>
    `;
  }

  /**
   * Add a callback f.call(this, this.getCurrentTime()) for the update (per frame).
   * Duplicates are not added.
   */
  addUpdateListener(f) {
    this._update.addListener(f);
  }

  /**
   * Remove a callback for the update.
   */
  removeUpdateListener(f) {
    this._update.removeListener(f);
  }

  getCurrentTime() {
    return this._time;
  }
  /**
   * Sets the current time.
   * @param t {number} the video time in seconds
   */
  seekTo(time) {
    this._time = time;
    this._onUpdate();
  }

  _onUpdate() {
    let t = this.getCurrentTime();

    // Suppress duplicate updates:
    if (this._lastUpdateCaptions === this.captions && this._lastUpdateTime === t) {
      return;
    }
    this._lastUpdateCaptions = this.captions;
    this._lastUpdateTime = t;

    // Callbacks:
    this._update.emit(t);

    // Render captions:
    if (this.captionsRegion !== null) {
      this.html = toHtml({html, styleMap}, this.captions, t);
      render(this.html, this.captionsRegion);
    }
  }
}

/**
 * Wrapper for HTML5 video element.
 * this.captions is a 'raw t you can update.
 */
export class Html5Video {
  /**
   * Construct a video player.
   * @param {string} url 
   * @param {object} [options.captions=empty]
   */
  constructor(url, options) {
    this.url = url;
    options = options || {};
    this._video = null;
    this._update = new Signal();
    this.captions = options.captions || empty;
    this.captionsRegion = null;
    // Duplicate suppression:
    this._lastUpdateCaptions = null;
    this._lastUpdateTime = null;

    // Periodic render:
    let onUpdateThis = this._onUpdate.bind(this);
    window.requestAnimationFrame(function onAnimationFrame() {
      try {
        onUpdateThis();
      } finally {
        window.requestAnimationFrame(onAnimationFrame);
      }
    });
  }

  /**
   * @returns {TemplateResult}
   */
  render() {
    let thiz = this;
    return html`
      <style>
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
      <video width="100%" height="100%" controls @render=${onRender(function() {
        thiz._video = this;
      })}>
        <source src=${this.url}>
      </video>
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
    `;
  }

  /**
   * Add a callback f.call(this, this.getCurrentTime()) for the update (per frame).
   * Duplicates are not added.
   */
  addUpdateListener(f) {
    this._update.addListener(f);
  }

  /**
   * Remove a callback for the update.
   */
  removeUpdateListener(f) {
    this._update.removeListener(f);
  }

  getCurrentTime() {
    if (!this._video) return 0;
    return this._video.currentTime;
  }
  /**
   * Sets the current time.
   * @param t {number} the video time in seconds
   */
  seekTo(time) {
    if (!this._video) return;
    this._video.currentTime = time;
  }

  _onUpdate() {
    let t = this.getCurrentTime();

    // Suppress duplicate updates:
    if (this._lastUpdateCaptions === this.captions && this._lastUpdateTime === t) {
      return;
    }
    this._lastUpdateCaptions = this.captions;
    this._lastUpdateTime = t;

    // Callbacks:
    this._update.emit(t);

    // Render captions:
    if (this.captionsRegion !== null) {
      this.html = toHtml({html, styleMap}, this.captions, t);
      render(this.html, this.captionsRegion);
    }
  }
}
