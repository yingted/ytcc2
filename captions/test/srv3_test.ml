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
  listFiles (([%raw "__dirname"]) ^ "/data/YTSubConverter/*.orig.srv3.xml")
  |> Js.Array.forEach (fun path ->
    let base_name = String.sub path 0 (String.length path - String.length ".orig.srv3.xml") in
    let json = lazy (base_name ^ ".json3.json"
      |> readFileUtf8
      |> Js.Json.parseExn)
    in
    let srv3 = lazy (readFileUtf8 path) in
    (* YouTube can't import it's own srv3 exports, we need to fix them: *)
    let srv3_fixed = lazy (base_name ^ ".fixed.srv3.xml" |> readFileUtf8) in

    test (path ^ " to json3") (fun () ->
      Lazy.force srv3
      |> Codec.decode_exn Srv3.xml_codec
      |> Js.Json.stringifyAny
      |> Option.value_exn
      |> Js.Json.parseExn
      |> expect
      |> toEqual (Lazy.force json));

    test (path ^ " from json3") (fun () ->
      Lazy.force json
      |> Js.Json.stringify
      |> Codec.decode_exn Codec.json
      (* Cast untrusted to trusted json3: *)
      |> Obj.magic
      |> Codec.encode Srv3.xml_codec
      |> expect
      (* |> toEqual (Lazy.force srv3_fixed) *)
      |> toMatchSnapshot
      ));
);
