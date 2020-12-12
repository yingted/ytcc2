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

let listFiles: string -> string Js.Array.t = [%raw {|
  function (pattern) {
    let files = require('glob').sync(pattern);
    if (files.length === 0) {
      throw new Error('no files matched: ' + JSON.stringify(pattern));
    }
    return files;
  }
|}]
let readFileUtf8: string -> string = [%raw {|
  function (path) {
    return require('fs').readFileSync(path, {encoding: 'utf-8'});
  }
|}]

let _ =
describe "converts" (fun () ->
  listFiles (([%raw "__dirname"]) ^ "/data/YTSubConverter/*.srv3.xml")
  |> Js.Array.forEach (fun path ->
    test path (fun () ->
      let json =
        (String.sub path 0 (String.length path - String.length ".srv3.xml")
        ^ ".json3.json")
        |> readFileUtf8
        |> Js.Json.parseExn
      in

      readFileUtf8 path
      |> Codec.decode_exn Srv3.xml_codec
      |> Js.Json.stringifyAny
      |> Option.value_exn
      |> Js.Json.parseExn
      |> expect
      |> toEqual json));
);
