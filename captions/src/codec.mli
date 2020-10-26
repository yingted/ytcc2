(* Encoded stream, decoded data *)
type ('co, 'dec) t

(* Use codecs *)
val try_decode: ('co, 'dec) t -> 'co -> ('dec, exn) result
val encode: ('co, 'dec) t -> 'dec -> 'co

(* Common codecs *)
val id: ('a, 'a) t
val text_int: (string, int) t
val text_float: (string, float) t

(* Assertion *)
val expect: 'co -> ('co, unit) t
val expect_string: string -> (string, unit) t

(* Codec combinators *)
