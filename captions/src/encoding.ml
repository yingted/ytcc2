type bytes = Js.TypedArray2.ArrayBuffer.t

let decode: string -> bytes -> string = [%raw {|
  function decode(codec, buf) {
    let TD = typeof TextDecoder !== 'undefined' ? TextDecoder : require('util').TextDecoder;
    let decoder;
    try {
      decoder = new TD(codec);
    } catch (e) {
      decoder = new TD('utf-8');
    }
    return decoder.decode(buf);
  }
|}]
let encodeUtf8: string -> bytes = [%raw {|
  function encodeUtf8(s) {
    let TE = typeof TextEncoder !== 'undefined' ? TextEncoder : require('util').TextEncoder;
    return new TE().encode(s).buffer;
  }
|}]
let guessEncoding: bytes -> string = [%raw {|
  (function() {
    const jschardet = require('jschardet');
    return function guessEncoding(b) {
      let u8 = new Uint8Array(b);
      let latin1Chars = [];
      for (let c of u8) {
        latin1Chars.push(String.fromCharCode(c));
      }
      let latin1Decode = latin1Chars.join('');
      let guess = jschardet.detect(b, latin1Decode);
      if (guess && guess.encoding) {
        return guess.encoding;
      }
      return 'utf-8';
    }
  })()
|}]

let prefer_utf8 =
  Codec.pure
    ~decode:(fun s ->
      let encoding = guessEncoding s in
      decode encoding s)
    ~encode:encodeUtf8
