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
  listFiles (([%raw "__dirname"]) ^ "/data/{pysub-parser/*.srt,courseinfo-rev.srt}")
  |> Js.Array.forEach (fun path ->
    let base_path =
      "." ^
      String.sub path
      (String.length [%raw "__dirname"])
      (String.length path - String.length [%raw "__dirname"])
    in

    test base_path (fun () ->
      let data = readFile path in
      let data1 = roundtrip Srt.codec data in
      let data2 = Result.bind data1 (roundtrip Srt.codec) in
      (* for i = 0 to 999 do *)
      (*   let data1 = roundtrip Srt.codec data in *)
      (*   let data2 = Result.bind data1 (roundtrip Srt.codec) in *)
      (*   () *)
      (* done; *)
      expect (Result.error data1, Result.ok data2)
      |> toEqual (None, Result.ok data1)));
);

describe "parses cues" (fun () ->
  test "at end" (fun () ->
    {|1
00:06:32,270 --> 8784:06:32,270
and your professors
will be your customers.

2...|}
    |> Codec.try_decode Srt.cue_parser
    |> expect
    |> toMatchSnapshot
    (* |> Result.error *)
    (* |> expect *)
    (* |> toEqual None *)
  )
);

describe "decodes" (fun () ->
  test "a<b>b</b>c" (fun () ->
    let text = "a<b>b</b>c" in
    expect(Codec.try_decode Srt.text_codec text) |> toMatchSnapshot);

  test "a single cue" (fun () ->
    let text = "1\n00:00:00,000 --> 00:00:01,234\ntest" in
    expect(Codec.try_decode Srt.string_codec text) |> toMatchSnapshot);
);

describe "encodes" (fun () ->
  test "cues with newlines" (fun () ->
    expect(Codec.encode Srt.string_codec [
      { start = 0.0; end_ = 1.0; text = [Track.Append "\na\n\n\nb\n", None]; };
      { start = 1.0; end_ = 2.0; text = [Track.Append "\nc\n\n\nd\n", None]; };
    ])
    |> toEqual "1\n00:00:00,000 --> 00:00:01,000\na\nb\n\n2\n00:00:01,000 --> 00:00:02,000\nc\nd\n\n");
);

describe "roundtrips" (fun () ->
  test "nested HTML tags" (fun () ->
    let text = "a<font color=\"#00ff00\">b<b>c</b>d</font>e" in
    expect(roundtrip Srt.text_codec text) |> toEqual (Ok text));

  test "cascaded HTML tags get simplified" (fun () ->
    expect(roundtrip Srt.text_codec "<font color=\"#f00\" size=\"1\">a<font size=\"2\">b<font color=00ff00>c</font>d</font>e</font>")
    |> toEqual (Ok "<font color=\"#ff0000\" size=\"1\">a</font><font color=\"#ff0000\" size=\"2\">b</font><font color=\"#00ff00\" size=\"2\">c</font><font color=\"#ff0000\" size=\"2\">d</font><font color=\"#ff0000\" size=\"1\">e</font>"));

  test "non-nested ASS tags" (fun () ->
    expect(roundtrip Srt.text_codec "a{\\i1}b{\\b1}c{\\i0}d{\\b0}e")
    |> toEqual (Ok "a<i>b<b>c</b></i><b>d</b>e"));

  test "unclosed ASS tags" (fun () ->
    expect(roundtrip Srt.text_codec "{\\b1}test")
    |> toEqual (Ok "<b>test</b>"));

  (* With no modification, it round trips. *)
  test "special chars" (fun () ->
    expect(roundtrip Srt.text_codec "\\n\\N\\h")
    |> toEqual (Ok "\\n\\N\\h"));

  test "cues with newlines" (fun () ->
    let text = "1\n00:00:00,000 --> 00:00:01,000\na\nb\n\n2\n00:00:01,000 --> 00:00:02,000\nc\nd\n\n" in
    expect(roundtrip Srt.string_codec text)
    |> toEqual (Ok text));

  (* test "font color" (fun () -> *)
  (*   expect(roundtrip Srt.text_codec "x{\\c&HABCDEF&}y{\\1c&H123456&}z") *)
  (*   |> toEqual (Ok "x<font color=\"#efcdab\">y</font><font color=\"#563412\">z</font>")); *)

  (* test "font face" (fun () -> *)
  (*   expect(roundtrip Srt.text_codec "{\\fnArial}x") *)
  (*   |> toEqual (Ok "<font face=\"arial\">x</font>")); *)

  (* test "font size" (fun () -> *)
  (*   expect(roundtrip Srt.text_codec "{\\fs16}x") *)
  (*   |> toEqual (Ok "<font size=\"3\">x</font>")); *)
);

describe "parses tags" (fun () ->
  let t tag =
    test tag (fun () ->
      expect(Codec.try_decode Srt.ass_tag_codec tag |> Result.error)
      |> toEqual (None))
  in

  (* http://docs.aegisub.org/3.2/ASS_Tags/ *)
  t "b1";
  t "i0";
  (* t "b100"; *)
  (* t "bord0"; *)
  (* t "bord1.2"; *)
  (* t "xbord2.3"; *)
  (* t "shad0"; *)
  (* t "be0"; *)
  (* t "be2"; *)
  (* t "blur0"; *)
  (* t "blur1"; *)
  (* t "blur2.3"; *)
  (* t "fnArial"; *)
  (* t "fs12"; *)
  (* t "fscx115"; *)
  (* t "fscy115"; *)
  (* t "fsp-1.2"; *)
  (* t "frx-10"; *)
  (* t "frz1000"; *)
  (* t "fr0"; *)
  (* t "fay.5"; *)
  (* t "fax-0.5"; *)
  (* t "fe0"; *)
  (* t "fe1"; *)
  (* t "fe2"; *)
  (* t "c&H123456"; *)
  (* t "4c&H123456"; *)
  (* t "2a&HFC"; *)
  (* t "an"; *)
  (* t "a1"; *)
  (* t "a11"; *)
  (* t "k123"; *)
  (* t "K123"; *)
  (* t "kf123"; *)
  (* t "ko123"; *)
  (* t "q3"; *)
  (* t "r"; *)
  (* t "rAlternate"; *)
  (* t "pos(12,34)"; *)
  (* t "move(1,2,3,4)"; *)
  (* t "move(1,2,3,4,5,6)"; *)
  (* t "org(1,2)"; *)
  (* t "fad(12,34)"; *)
  (* t "fade(12,34,56,23,45,67)"; *)
  (* (1* Animations skipped *1) *)
  (* t "clip(1,2,3,4)"; *)
  (* t "iclip(1,2,3,4)"; *)
  (* t "p0"; *)
  (* t "p1"; *)
  (* t "p2"; *)
  (* t "pbo-4"; *)
);

describe "encodes and decodes text" (fun () ->
  let test_encodes name (tokens : Track.token list) markup =
    test (name ^ " encodes") (fun () ->
      tokens
      |> List.map (fun token -> (token, None))
      |> Codec.encode Srt.text_codec
      |> expect
      |> toEqual markup
    );

    test (name ^ " decodes") (fun () ->
      markup
      |> Codec.decode_exn Srt.text_codec
      |> List.map fst
      |> expect
      |> toEqual tokens
    );
  in

  let b1 = Style.singleton Bold @@ Some true in

  test_encodes "empty"
    []
    "";

  test_encodes "single char"
    [
      Append "a";
    ]
    "a";

  test_encodes "multiple chars together"
    [
      Append "abc";
    ]
    "abc";

  test_encodes "html with ambiguous entities"
    [
      Append "<&amp;>";
    ]
    "&lt;&amp;amp;>";

  test_encodes "html without unambiguous entities"
    [
      Append "\"\'>";
    ]
    "\"\'>";

  test_encodes "formatting"
    [
      Append "ab";
      Set_style b1;
      Append "cd";
      Set_style Style.empty;
      Append "ef";
    ]
    "ab<b>cd</b>ef";
);
