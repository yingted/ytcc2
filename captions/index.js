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

function stripRaw(t) {
  return track.strip_raw(t);
}

var empty = track.empty;

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

/**
 * @params t Srt.raw Track.t
 * @returns {array<{time: ..., text: ...}>}
 */
function toSrtCues(t) {
  return srt.to_raw_cues(t);
}
function fromSrtCues(cues) {
  return srt.from_raw_cues(cues);
}

/**
 * @param srtText {string}
 * @returns {TemplateResult}
 */
function srtTextToHtml(srtText) {
  let text = codec.decode_exn(srt.text_codec, srtText);
  return track.text_to_html(text);
}

/**
 * @param srtText {string}
 * @returns {array<{raw: string, text: string, style: object, start: number}>}
 */
function srtTextToSpans(srtText) {
  let text = codec.decode_exn(srt.text_codec, srtText);
  return track.text_to_spans(text);
}

/**
 * @param srtTimeAndText {string} a string "0:12.34 a" or "a"
 * @returns {{time: number, offset: number}|null} either {time:12.34 offset:8} or null
 */
function decodeTimeSpace(srtTimeAndText) {
  try {
    var [time, tail] = codec.decode_exn(srt.short_time_space, srtTimeAndText);
  } catch (e) {
    return null;
  }
  return {
    time,
    offset: srtTimeAndText.length - tail.length,
  };
}
/**
 * @param time {number}
 * @returns string "0:12.34 "
 */
function encodeTimeSpace(time) {
  return codec.encode(srt.short_time_space, [time, '']);
}

module.exports = {
  decodeJson3,
  stripRaw,
  decodeSrt,
  empty,
  toHtml,
  toSrtCues,
  fromSrtCues,
  srtTextToHtml,
  srtTextToSpans,
  decodeTimeSpace,
  encodeTimeSpace,
};
