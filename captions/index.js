const json3 = require('./src/json3.bs.js');
const srt = require('./src/srt.bs.js');
const codec = require('./src/codec.bs.js');
const track = require('./src/track.bs.js');

/**
 * @param m any Track.S
 * @param data {ArrayBuffer|string}
 * @returns 'raw Track.t
 */
function decode(m, data) {
  if (data instanceof ArrayBuffer) {
    return codec.decode_exn(m.codec, data);
  } else if (typeof data === 'string') {
    return codec.decode_exn(m.string_codec, data);
  } else {
    throw new TypeError('invalid type', data);
  }
}

/**
 * @param data {ArrayBuffer|string}
 * @returns Json3.raw Track.t
 */
function decodeJson3(data) {
  return decode(json3, data);
}

/**
 * @param data {ArrayBuffer|string}
 * @returns Srt.raw Track.t
 */
function decodeSrt(data) {
  return decode(srt, data);
}

/**
 * @param deps {html: ..., styleMap: ...}
 * @param t 'raw Track.t
 * @param time {number}
 * @returns {TemplateResult}
 */
function toHtml(deps, t, time) {
  return track.to_html(deps, time, t);
}

module.exports = {
  decodeJson3,
  decodeSrt,
  toHtml,
};
