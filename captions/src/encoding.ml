(**
   Copyright 2020 Google LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*)

type bytes = Js.TypedArray2.ArrayBuffer.t

let decode: string -> bytes -> string = [%raw {|
  function decode(codec, buf) {
    let decoder;
    try {
      decoder = new TextDecoder(codec);
    } catch (e) {
      decoder = new TextDecoder('utf-8');
    }
    return decoder.decode(buf);
  }
|}]
let encodeUtf8: string -> bytes = [%raw {|
  function encodeUtf8(s) {
    return new TextEncoder().encode(s).buffer;
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
      if (/^<\?xml [^?]*\bencoding=(?:"[uU][tT][fF]-8"|'[uU][tT][fF]-8')[^?]*\?>/.test(latin1Decode)) {
        return 'utf-8';
      }
      let guess = jschardet.detect(latin1Decode);
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
