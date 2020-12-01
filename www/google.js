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

/**
 * Wait for window.gapi to be ready.
 */
function waitForGapi() {
  let ready = new Promise(resolve => {
    window.onGapiReady = resolve;
  });
  waitForGapi = () => ready;

  var tag = document.createElement('script');

  tag.src = "https://apis.google.com/js/api.js?onload=onGapiReady";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  return waitForGapi();
}

/**
 * @returns Promise<gapi.constructor>
 */
function getGapi() {
  return waitForGapi()
    .then(() => {
      // We can only have one API key, so put it here.
      window.gapi.client.setApiKey('AIzaSyB0B_pl4rt1CFhSdtZFSrVBYjh9UL3zYv4');
      return window.gapi;
    });
}
