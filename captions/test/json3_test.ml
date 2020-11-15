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
