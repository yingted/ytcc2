import {sign_detached} from 'tweetnacl-ts';
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
 * The server is assumed to be trusted because we want people to
 * import a database of public keys and make their clone websites.
 *
 * First, POST without any parameters to get a challenge.
 * Then, POST with _signatureBase64 with a redirect.
 * @param {string} url the target, like 'http://localhost:8080/edit'
 * @param {Object.<string, string>} params the args, like {v: '...'}
 */
async function showReceiptAndNavigate(url, params) {
  // Ask the server for a challenge:
  let challenge = await (await fetch(url, {
    method: 'POST',
    cache: 'no-cache',
    referrerPolicy: 'no-referrer',
    body: '',
  })).json();
  let nonce = challenge.nonce + '';

  // Solve the challenge:
  let signatureBase64 = sign_detached(stringToUint8Array(new URLSearchParams({
    url,
    nonce,
  }).sort().toString()), secretKey);

  postNavigate(
    url,
    Object.assign({}, {_signatureBase64: signatureBase64}, params));
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
  cookieImport.addEventListener('click', () => postNavigate('/add_receipt#' + Array.from(form.elements)
    .map(({name, value}) => [name, value])
    .sort(([k1, v1], [k2, v2]) => (k1 > k2) - (k1 < k2))
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&')));
}

form.querySelector('.receipt-show-button')
  .addEventListener('click', () => showReceiptAndNavigate(form.elements.target.value, {}));
