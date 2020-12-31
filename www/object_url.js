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

export class ObjectUrl {
  constructor() {
    this._keySingleton = new WeakSet();
    this._url = null;
  }
  create(key, makeBlob) {
    // Dedupe calls:
    if (this._keySingleton.has(key)) {
      return this._url;
    }

    // Free the previous URL:
    this._keySingleton = new WeakSet();
    if (this._url !== null) {
      URL.revokeObjectURL(this._url);
    }

    // Make a new URL:
    this._keySingleton.add(key);
    this._url = URL.createObjectURL(makeBlob());
    return this._url;
  }
}
