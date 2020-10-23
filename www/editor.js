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

export class CaptionsEditor {
  /**
   * Create a captions editor for a video.
   * @param {YouTubeVideo} video 
   */
  constructor(video) {
    this.video = video;
    this.view = new EditorView({
      state: EditorState.create({
        doc: 'Transcript goes here',
        extensions: [
          history(),
          keymap([
            ...defaultKeymap,
            ...historyKeymap,
          ]),
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