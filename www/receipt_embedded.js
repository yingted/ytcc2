import {sign} from 'tweetnacl-ts';
let form = document.currentScript.closest('form');
function stringToUint8Array(data) {
  return new Uint8Array(
    Array.from(data)
    .map(c => c.charCodeAt(0)));
}
function uint8ArrayToString(data) {
  return btoa(String.fromCharCode.apply(string, Array.from(data)));
}
let secretKey = stringToUint8Array(atob(form.querySelector('input[name=secretKeyBase64]').value));

/**
 * Send an HTTP POST to this URL.
 * Also include form params.
 */
function postNavigate(url, params = {}) {
  let form = document.createElement('form');
  form.style.display = 'none';
  form.setAttribute('action', url);
  form.setAttribute('method', 'post');
  for (let [k, v] of Object.entries(params)) {
    let input = document.createElement('input');
    input.name = k;
    input.value = v;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

/**
 * Perform a private POST action.
 * The server is assumed to be partly trusted because we want people to
 * import a database of public keys and make their clone websites.
 *
 * We are trusting the server with our request params, but a malicious
 * server could forward us the real server's nonce.
 * We still sign it, but we include the URL so the real server can figure out
 * if the nonce is trustworthy or not.
 *
 * First, POST without any parameters to get a challenge.
 * Then, POST with _signatureBase64 with a redirect.
 * @param {string} url the target, like 'http://localhost:8080/edit'
 * @param {Object.<string, string>} params the args, like {v: '...'}
 */
async function showReceiptAndNavigate(url, params) {
  // Ask the server for a random challenge.
  // The server will verify we only used it once.
  let challenge = await (await fetch(url, {
    method: 'POST',
    cache: 'no-cache',
    referrerPolicy: 'no-referrer',
    body: '',
  })).json();
  let untrustedNonce = challenge.untrustedNonce + '';

  // Sign the challenge along with the request.
  // The server can trust that the URL and params came from us.
  let signedRequest = uint8ArrayToString(sign(stringToUint8Array(JSON.stringify({
    url,
    params,
    untrustedNonce,
  })), secretKey));

  postNavigate(url, {signedRequest});
}

form.querySelector('.receipt-captions-edit-link')
  .addEventListener('click', () => showReceiptAndNavigate(form.elements.origin.value + '/edit', {
    v: form.elements.v.value,
    id: form.elements.id.value,
  }));

form.querySelector('.receipt-captions-delete-link')
  .addEventListener('click', () => showReceiptAndNavigate(form.elements.origin.value + '/delete', {
    v: form.elements.v.value,
    id: form.elements.id.value,
  }));

let cookieImport = form.querySelector('.receipt-cookie-import-link');
if (cookieImport !== null) {
  cookieImport.addEventListener('click', () => postNavigate(form.elements.origin.value + '/add_receipt#' + [
    ['v', form.elements.v.value],
    ['lang', form.elements.lang.value],
    ['id', form.elements.id.value],
    ['secretKeyBase64', form.elements.secretKeyBase64.value],
  ].map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&')));
}

form.querySelector('.receipt-show-button')
  .addEventListener('click', () => showReceiptAndNavigate(form.elements.target.value, {}));