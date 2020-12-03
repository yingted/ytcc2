/**
 * Wrapper for YouTube Data API V3.
 * This needs the server-side secrets, so don't run it on the client.
 * To open a repl:
 * $ node --experimental-repl-await -e "youtube = require('./youtube_trusted.js').getYoutubeApi()" -i
 * > languages = await youtube.i18nLanguages.list({part: ['snippet']})
 */

let fs = require('fs');
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
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
