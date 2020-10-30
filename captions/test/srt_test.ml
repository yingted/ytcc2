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
    test path (fun () ->
      let data = readFile path in
      let data1 = roundtrip Srt.codec data in
      let data2 = Result.bind data1 (roundtrip Srt.codec) in
      expect (Result.error data1, Result.ok data1)
      |> toEqual (None, Result.ok data2)));
);

describe "roundtrips" (fun () ->
  test "nested HTML tags" (fun () ->
    let text = "a<font color=\"#00FF00\">b<b>c</b>d</font>e" in
    expect(roundtrip Srt.text_codec text) |> toEqual (Ok text));

  test "non-nested ASS tags" (fun () ->
    let text = "a{\\i1}b{\\b1}c{\\i0}d{\\b0}e" in
    expect(roundtrip Srt.text_codec text) |> toEqual (Ok text));

  test "unclosed ASS tags" (fun () ->
    let text = "{\\b1}test" in
    expect(roundtrip Srt.text_codec text) |> toEqual (Ok text));

  test "special chars" (fun () ->
    let text = "\\n\\N\\h" in
    expect(roundtrip Srt.text_codec text) |> toEqual (Ok text));
);

describe "parses tags" (fun () ->
  let t tag =
    test tag (fun () ->
      expect(roundtrip Srt.ass_tag_codec tag) |> toEqual (Ok tag))
  in

  (* http://docs.aegisub.org/3.2/ASS_Tags/ *)
  t "b100";
  t "b1";
  t "i0";
  t "bord0";
  t "bord1.2";
  t "xbord2.3";
  t "shad0";
  t "be0";
  t "be2";
  t "blur0";
  t "blur1";
  t "blur2.3";
  t "fnArial";
  t "fs12";
  t "fscx115";
  t "fscy115";
  t "fsp-1.2";
  t "frx-10";
  t "frz1000";
  t "fr0";
  t "fay.5";
  t "fax-0.5";
  t "fe0";
  t "fe1";
  t "fe2";
  t "c&H123456";
  t "4c&H123456";
  t "2a&HFC";
  t "an";
  t "a1";
  t "a11";
  t "k123";
  t "K123";
  t "kf123";
  t "ko123";
  t "q3";
  t "r";
  t "rAlternate";
  t "pos(12,34)";
  t "move(1,2,3,4)";
  t "move(1,2,3,4,5,6)";
  t "org(1,2)";
  t "fad(12,34)";
  t "fade(12,34,56,23,45,67)";
  (* Animations skipped *)
  t "clip(1,2,3,4)";
  t "iclip(1,2,3,4)";
  t "p0";
  t "p1";
  t "p2";
  t "pbo-4";
);
