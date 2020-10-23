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

import {directive} from 'lit-html';

/**
 * @returns {string} uuid a random UUID in compact hex format
 */
export function randomUuid() {
  for (
    var result = '';
    result.length * 4 < 128;
    result += Math.floor(Math.random() * 16).toString(16));
  return result;
};

/**
 * Usage: html`<div @render=${onRender(f)}></div>`
 * `f` receives the target element as "this"
 * @param {function} f the function to run on render
 */
export const onRender = directive(f => part => {
  f.call(part.element);
});