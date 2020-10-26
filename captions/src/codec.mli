(* Encoded stream, decoded data *)
type ('co, 'dec) t

(* Make a codec *)
val make:
  try_decode:('co -> ('dec, exn) result) ->
  encode:('dec -> 'co) ->
  ('co, 'dec) t
(* If never fails: *)
val pure:
  decode:('co -> 'dec) ->
  encode:('dec -> 'co) ->
  ('co, 'dec) t
(* If it doesn't even need the inputs *)
val assume: 'dec -> 'co -> ('co, 'dec) t

(* Use codecs *)
val try_decode: ('co, 'dec) t -> 'co -> ('dec, exn) result
val encode: ('co, 'dec) t -> 'dec -> 'co

(* Codec combinators *)
val stack: ('a, 'b) t -> ('b, 'c) t -> ('a, 'c) t


(* Common codecs *)
val id: ('a, 'a) t
val text_int: (string, int) t
val text_float: (string, float) t

(* Assertion *)
val expect: 'co -> ('co, unit) t
val expect_string: string -> (string, unit) t
