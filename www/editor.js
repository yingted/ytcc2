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

import {EditorState, EditorSelection} from "@codemirror/next/state"
import {EditorView, keymap, Decoration, ViewPlugin, WidgetType} from "@codemirror/next/view"
import {defaultKeymap} from "@codemirror/next/commands"
import {history, historyKeymap} from "@codemirror/next/history"
import {render, html} from 'lit-html';
import {StreamSyntax} from "@codemirror/next/stream-syntax"
import {decodeJson3, stripRaw, srtTextToHtml, toSrtCues, fromSrtCues, decodeTimeSpace, encodeTimeSpace} from 'ytcc2-captions';
import {RangeSetBuilder} from '@codemirror/next/rangeset';
import {StyleModule} from 'style-mod';

function captionToText({time, text}) {
  return encodeTimeSpace(time) + text.replace(/^(\d+:\d)/mg, " $1");
}
function toText(captions) {
  return captions.map(captionToText).join('\n');
}
function getOffset(state) {
  return state.selection.asSingle().ranges[0].head;
}

// Find an offset <= this time.
function timeToOffset(captions, time) {
  let curOffset = 0;
  let nextOffset = 0;
  // Find the last caption where caption.time <= time:
  for (let caption of captions) {
    let timeLength = captionToText({time: caption.time, text: ''}).length;
    curOffset += timeLength;
    if (caption.time > time) break;
    curOffset = nextOffset;
    nextOffset = curOffset + timeLength + caption.text.length + 1;
  }
  return curOffset;
}

// Find a time when this offset would be rendered.
// We usually prefer earlier times, but for paused karaoke, we prefer later times.
// For simplicity, just prefer earlier times, as it's easier to play forwards than back.
function offsetToTime(captions, offset) {
  let curOffset = 0;
  let curTime = 0;
  // Find the last time where curOffset <= offset:
  for (let caption of captions) {
    curTime = caption.time;
    let nextOffset = curOffset + captionToText(caption).length + 1;
    if (nextOffset > offset) break;
    curOffset = nextOffset;
  }
  return curTime;
}

class TemplateWidget extends WidgetType {
  constructor(template) {
    super(template);
    this._template = template;
  }
  toDOM(view) {
    let div = document.createElement('DIV');
    render(this._template, div);
    console.assert(div.firstElementChild === div.lastElementChild);
    return div.firstElementChild;
  }
}

class CaptionsHighlighter /*extends PluginValue*/ {
  static styleModule = EditorView.styleModule.of(new StyleModule({
    '.cm-content .cue-start-time': {
      color: '#444',
    },
    '[x-caret-line]': {
      'background-color': '#ddd',
    },
  }))
  constructor(view) {
    this.view = view;
    this.decorations = this._getDecorations(view);
  }
  _getDecorations(view) {
    // Syntax:
    let builder = new RangeSetBuilder();
    for (let {from, to} of view.visibleRanges) {
      let text = view.state.doc.sliceString(from, to);
      let lines = text.split('\n');
      let lastLineOffset = 0;
      for (let i = 0, offset = 0; i < lines.length; offset += lines[i].length + 1, ++i) {
        let line = lines[i];
        let timeOffset = decodeTimeSpace(line);
        if (timeOffset === null) {
          // Continuation:
          builder.add(offset, offset, Decoration.widget({
            widget: new TemplateWidget(html`<span class="cue-continuation-indent">${new Array(lastLineOffset + 1).join(' ')}</span>`),
            side: -1,
            block: false,
          }));
        } else {
          let {time, offset: lineOffset} = timeOffset;
          builder.add(offset, offset + lineOffset, Decoration.mark({ class: 'cue-start-time' }));
          lastLineOffset = lineOffset;
        }
      }
    }
    let ranges = builder.finish();

    // Caret:
    let cursorLine = view.state.doc.lineAt(getOffset(view.state));
    ranges = ranges.update({
      add: [
        {
          from: cursorLine.from,
          to: cursorLine.from,
          value: Decoration.line({attributes: { 'x-caret-line': 'true' }}),
        },
      ],
    });
    return ranges;
  }
  update(update) {
    if (update.viewportChanged || update.docChanged || update.selectionSet) {
      this.decorations = this._getDecorations(update.view);
    }
  }
}
let captionsHighlighterExtension = [
  ViewPlugin.define(view => new CaptionsHighlighter(view), {
    decorations: v => v.decorations
  }),
  CaptionsHighlighter.styleModule,
];

export class CaptionsEditor {
  /**
   * Create a captions editor for a video.
   * @param {YouTubeVideo} video 
   */
  constructor(video) {
    // Widgets:
    this.video = video;
    this.view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          history(),
          keymap([
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          captionsHighlighterExtension,
          EditorView.updateListener.of(this._onEditorUpdate.bind(this)),
        ],
      }),
    });

    // Event handlers:
    this._inSetCaptions = false;
    this._inOnVideoUpdate = false;
    this.video.addUpdateListener(this._onVideoUpdate.bind(this));

    // Initialize the captions:
    this.setCaptions(stripRaw(decodeJson3(params.captions)));
  }

  /**
   * Set the captions.
   * @param {Srt.raw Track.t} captions
   */
  setCaptions(captions) {
    this._inSetCaptions = true;
    {
      // {'raw Track.t} captions with style and karaoke, but no unknown tags
      // Used for rendering.
      this._rawCaptions = captions;
      // {array<{time: ..., text: ...}>} captions with style, but no karaoke or unknown tags
      // Used for editing.
      this._editableCaptions = toSrtCues(captions);

      this.video.captions = this._rawCaptions;
      this.view.dispatch(this.view.state.update({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: toText(this._editableCaptions),
        }
      }));
    }
    this._inSetCaptions = false;
  }

  _onEditorUpdate(update) {
    if (this._inSetCaptions) return;
    if (this._inOnVideoUpdate) return;
    {
      if (update.docChanged) {
        // TODO call this.setCaptions
        console.log('update', update.changes);
      }
      if (update.selectionSet) {
        let prevOffset = getOffset(update.prevState);
        let offset = getOffset(update.state);
        let prevTime = offsetToTime(this._editableCaptions, prevOffset);
        let time = offsetToTime(this._editableCaptions, offset);
        if (time !== prevTime) {
          this.video.seekTo(time);
          this._onVideoUpdate(time);
        }
      }
    }
  }

  _onVideoUpdate(time) {
    // Don't scroll the editor if we're focused on it.
    // This means we only focus once after seeking.
    if (this.view.hasFocus) return;
    this._inOnVideoUpdate = true;
    {
      let prevOffset = getOffset(this.view.state);
      let offset = timeToOffset(this._editableCaptions, time);
      if (offset !== prevOffset) {
        // Scroll the current position into view:
        this.view.dispatch(this.view.state.update({
          selection: EditorSelection.single(offset),
          scrollIntoView: true,
        }));
      }
    }
    this._inOnVideoUpdate = false;
  }

  render() {
    let textbox = this.view.dom.querySelector('[role=textbox]');
    if (textbox !== null) {
      textbox.setAttribute('aria-label', 'Captions editor');
    }
    return html`
      <div style="height: 25em; width: 640px; overflow: auto;">
        ${this.view.dom}
      </div>
    `;
  }
}
