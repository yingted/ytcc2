type bytes = Js.TypedArray2.ArrayBuffer.t
(* Guess encoding on decode, use UTF-8 on encode *)
val prefer_utf8: (bytes, string) Codec.t
