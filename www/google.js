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
