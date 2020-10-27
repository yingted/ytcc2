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
);
