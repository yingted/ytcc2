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
import {YouTubeVideo} from './youtube.js';
import {CaptionsEditor} from './editor.js';

const video = new YouTubeVideo('gKqypLvwd70');
const editor = new CaptionsEditor(video);

// For debugging:
window.video = video;
window.editor = editor;

render(html`
  ${video.render()}
  ${editor.render()}
`, document.body);
