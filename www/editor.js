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

import {EditorState} from "@codemirror/next/state"
import {EditorView, keymap} from "@codemirror/next/view"
import {defaultKeymap} from "@codemirror/next/commands"
import {history, historyKeymap} from "@codemirror/next/history"
import {html} from 'lit-html';
import {StreamSyntax} from "@codemirror/next/stream-syntax"
import {defaultHighlighter} from "@codemirror/next/highlight"

class TimedTextStreamParser {
  token(stream, state, editorState) {
    if (stream.sol()) {
      if (stream.match(/^\d+:\d{2}(?::\d{2})?(?:\.\d{0,3})?/) !== null) {
        // I guess it's technically a number?
        return 'number';
      }
    }
    stream.skipToEnd();
    return null;
  }
}

export class CaptionsEditor {
  /**
   * Create a captions editor for a video.
   * @param {YouTubeVideo} video 
   */
  constructor(video) {
    this.video = video;
    this.view = new EditorView({
      state: EditorState.create({
        doc: '0:00 hello\n0:12.34 testing',
        extensions: [
          history(),
          keymap([
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          new StreamSyntax(new TimedTextStreamParser()).extension,
          defaultHighlighter,
        ],
      }),
    });
  }

  render() {
    return html`
      ${this.view.dom}
    `;
  }
}
