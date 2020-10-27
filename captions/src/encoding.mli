(* Guess encoding on decode, use UTF-8 on encode *)
(* Unfortunately we use the same type for ??? encoding as real strings *)
val prefer_utf8: (string, string) Codec.t
