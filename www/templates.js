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

function renderFooter({html}) {
  return html`
    <footer>
      <style>
        footer ul {
          margin: 0;
          padding: 0;
        }
        footer ul li {
          display: inline-block;
          padding: 0 0.5em;
        }
        footer ul li a[href] {
          display: inline-block;
          padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
        }
      </style>
      <hr>
      <ul>
        <li>
          <a href="https://github.com/yingted/ytcc2/issues/new">Report an issue</a>
        </li>
        <li>
          <a href="/terms">Terms of service</a>
        </li>
      </ul>
    </footer>
  `;
}

module.exports = {
  renderFooter,
};
