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
 * Wrapper for YouTube Data API V3.
 * This needs the server-side secrets, so don't run it on the client.
 * To open a repl:
 * $ node --experimental-repl-await -e "youtube = require('./youtube_trusted.js').getYoutubeApi()" -i
 * > languages = await youtube.i18nLanguages.list({part: ['snippet']})
 */

let config = require('./config_trusted');
var {google} = require('googleapis');

/**
 * @returns {YouTube}
 */
function getYoutubeApi() {
  return google.youtube({
    version: 'v3',
    auth: config.google_api_key,
  });
}

/**
 * @returns {Promise<{id: string, name: string}>}
 */
async function listLanguages() {
  let languages = await getYoutubeApi().i18nLanguages.list({part: ['snippet']});
  return languages.data.items.map(({snippet: {hl, name}}) => ({id: hl, name}));
}

module.exports = {
  getYoutubeApi,
  listLanguages,
};
