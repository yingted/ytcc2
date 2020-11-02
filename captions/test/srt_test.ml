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
