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

open Jest
open Expect

[%%raw {|
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
|}]

let listFiles: string -> string Js.Array.t = [%raw {|
  function (pattern) {
    let files = require('glob').sync(pattern);
    if (files.length === 0) {
      throw new Error('no files matched: ' + JSON.stringify(pattern));
    }
    return files;
  }
|}]
let readFile: string -> Encoding.bytes = [%raw {|
  function (path) {
    return require('fs').readFileSync(path);
  }
|}]

let roundtrip codec data =
  data
  |> Codec.try_decode codec
  |> Result.map ~f:(Codec.encode codec)

let _ =
describe "stabilizes" (fun () ->
  listFiles (([%raw "__dirname"]) ^ "/data/YTSubConverter/*.json3.json")
  |> Js.Array.forEach (fun path ->
    test path (fun () ->
      let data = readFile path in
      let data1 = roundtrip Json3.codec data in
      let data2 = Result.bind data1 (roundtrip Json3.codec) in
      let decode_utf8 x = Result.ok x |> Option.map (Codec.decode_exn Encoding.prefer_utf8) in
      expect (Result.error data1, decode_utf8 data2)
      |> toEqual (None, decode_utf8 data1)));
);
