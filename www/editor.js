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
import {EditorView, keymap, Decoration, ViewPlugin} from "@codemirror/next/view"
import {defaultKeymap} from "@codemirror/next/commands"
import {history, historyKeymap} from "@codemirror/next/history"
import {html} from 'lit-html';
import {StreamSyntax} from "@codemirror/next/stream-syntax"
import {decodeJson3, srtTextToHtml, toSrtCues} from 'ytcc2-captions';
import {RangeSetBuilder} from '@codemirror/next/rangeset';
import {StyleModule} from 'style-mod';

function toText(captions) {
  return toSrtCues(captions).map(({time, text}) => {
    return time + ' ' + text;
  }).join('\n');
}

function timeToOffset(captions, time) {
  return time | 0;
}

function offsetToTime(captions, offset) {
  return offset;
}

class CaptionsHighlighter /*extends PluginValue*/ {
  static styleModule = EditorView.styleModule.of(new StyleModule({
    '.cm-content .testing': {
      color: 'red',
    },
  }))
  constructor(view) {
    this.view = view;
    this.decorations = this._getDecorations(view);
  }
  _getDecorations(view) {
    let builder = new RangeSetBuilder();
    // this.view.visibleRanges;
    builder.add(0, 4, Decoration.mark({ class: 'testing' }));
    return builder.finish();
  }
  update(update) {
    // let syntax = update.state.facet(EditorState.syntax);
    // if (!syntax.length) {
    //   this.decorations = Decoration.none;
    // }
    // else if (syntax[0].parsePos(update.state) < update.view.viewport.to) {
    //   this.decorations = this.decorations.map(update.changes);
    // }
    // else if (this.tree != syntax[0].getTree(update.state) || update.viewportChanged) {
    //   this.tree = syntax[0].getTree(update.state);
    //   this.decorations = this.buildDeco(update.view.visibleRanges, this.tree);
    // }
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
    this.video = video;
    // Binding:
    // - this._captions: the actual captions
    // - this.view.state.doc: text rendering of the captions
    // - this.video.captions: next captions to render

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

    this.video.addUpdateListener(this._onVideoUpdate.bind(this));

    this._inSetCaptions = false;
    this._inOnEditorUpdate = false;
    this._inOnVideoUpdate = false;
    this.setCaptions(decodeJson3(params.captions));
  }

  /**
   * Set the captions.
   * @param {'raw Track.t} captions
   */
  setCaptions(captions) {
    this._inSetCaptions = true;
    {
      this._captions = captions
      this.video.captions = captions;
      this.view.dispatch(this.view.state.update({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: toText(this._captions),
        }
      }));
    }
    this._inSetCaptions = false;
  }

  _onEditorUpdate(update) {
    if (this._inSetCaptions) return;
    if (this._inOnVideoUpdate) return;
    this._inOnEditorUpdate = true;
    {
      if (update.docChanged) {
        console.log('update', update.changes);
      }
      if (update.selectionSet) {
        let offset = this.view.state.selection.asSingle().ranges[0].head;
        this.video.seekTo(offsetToTime(this._captions, offset));
      }
    }
    this._inOnEditorUpdate = false;
  }

  _onVideoUpdate(time) {
    if (this._inOnEditorUpdate) return;
    this._inOnVideoUpdate = true;
    {
      this.view.dispatch(this.view.state.update({
        selection: EditorSelection.single(timeToOffset(this._captions, time)),
        scrollIntoView: true,
      }));
      this.view.focus();
    }
    this._inOnVideoUpdate = false;
  }

  render() {
    return html`
      ${this.view.dom}
    `;
  }
}
