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

let normalize_json : 'a -> 'a = [%raw {|
  function normalize_json(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
|}]

let _ =
describe "stabilizes" (fun () ->
  listFiles (([%raw "__dirname"]) ^ "/data/YTSubConverter/*.json3.json")
  |> Js.Array.forEach (fun path ->
    let base_path =
      "." ^
      String.sub path
      (String.length [%raw "__dirname"])
      (String.length path - String.length [%raw "__dirname"])
    in

    test base_path (fun () ->
      let data = readFile path in
      let data1 = roundtrip Json3.codec data in
      let data2 = Result.bind data1 (roundtrip Json3.codec) in
      let decode_utf8 x = Result.ok x |> Option.map (Codec.decode_exn Encoding.prefer_utf8) in
      expect (Result.error data1, decode_utf8 data2)
      |> toEqual (None, decode_utf8 data1)));
);

describe "roundtrips" (fun () ->
  let test_encodes name (track : Json3.raw Track.t) json3 =
    test (name ^ " encodes") (fun () ->
      track
      |> Codec.encode Json3.json_codec
      |> normalize_json
      |> expect
      |> toEqual json3
    );

    test (name ^ " decodes") (fun () ->
      json3
      |> Codec.decode_exn Json3.json_codec
      |> List.map (fun (cue : Json3.raw Track.cue) ->
          { cue with text =
            cue.text |> List.map (fun (token, _raw) -> (token, None)) })
      |> expect
      |> toEqual track
    );
  in

  let no_raw (tokens : Track.token list) =
    tokens |> List.map (fun token -> (token, None))
  in
  let b1 = Style.singleton Bold @@ Some true in
  let b0 = Style.singleton Bold @@ Some false in

  test_encodes "empty"
    []
    [%raw {|
      {
        wireMagic: 'pb3',
        pens: [],
        wsWinStyles: [],
        wpWinPositions: [],
        events: [],
      }
    |}];

  test_encodes "single char"
    [
      {
        start = 1.23; end_ = 2.34;
        text = no_raw [
          Append "a";
        ];
      };
    ]
    [%raw {|{
      wireMagic: 'pb3',
      pens: [],
      wsWinStyles: [],
      wpWinPositions: [],
      events: [{
        tStartMs: 1230, dDurationMs: 1110,
        segs: [{utf8: 'a'}],
      }],
    }|}];

  test_encodes "multiple chars together"
    [
      {
        start = 1.23; end_ = 2.34;
        text = no_raw [
          Append "abc";
        ];
      };
    ]
    [%raw {|{
      wireMagic: 'pb3',
      pens: [],
      wsWinStyles: [],
      wpWinPositions: [],
      events: [{
        tStartMs: 1230, dDurationMs: 1110,
        segs: [{utf8: 'abc'}],
      }],
    }|}];

  (* json3 isn't as smart as SRT, so we end up with junk markup *)
  test_encodes "multiple chars separated"
    [
      {
        start = 1.23; end_ = 2.34;
        text = no_raw [
          Append "a";
          Append "b";
          Append "c";
        ];
      };
    ]
    [%raw {|{
      wireMagic: 'pb3',
      pens: [],
      wsWinStyles: [],
      wpWinPositions: [],
      events: [{
        tStartMs: 1230, dDurationMs: 1110,
        segs: [{utf8: 'a'}, {utf8: 'b'}, {utf8: 'c'}],
      }],
    }|}];

  test_encodes "formatting b1 and b0"
    [
      {
        start = 1.23; end_ = 2.34;
        text = no_raw [
          Append "ab";
          Set_style b1;
          Append "cd";
          Set_style b0;
          Append "ef";
        ];
      };
    ]
    [%raw {|{
      wireMagic: 'pb3',
      pens: [
        {bAttr: 1},
        {bAttr: 0},
      ],
      wsWinStyles: [],
      wpWinPositions: [],
      events: [{
        tStartMs: 1230, dDurationMs: 1110,
        segs: [{utf8: 'ab'}, {pPenId: 0, utf8: 'cd'}, {pPenId: 1, utf8: 'ef'}],
      }],
    }|}];

  test_encodes "formatting b1 and empty"
    [
      {
        start = 1.23; end_ = 2.34;
        text = no_raw [
          Append "ab";
          Set_style b1;
          Append "cd";
          Set_style Style.empty;
          Append "ef";
        ];
      };
    ]
    [%raw {|{
      wireMagic: 'pb3',
      pens: [
        {bAttr: 1},
      ],
      wsWinStyles: [],
      wpWinPositions: [],
      events: [{
        tStartMs: 1230, dDurationMs: 1110,
        segs: [{utf8: 'ab'}, {pPenId: 0, utf8: 'cd'}, {utf8: 'ef'}],
      }],
    }|}];
);
