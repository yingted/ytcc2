(* A parser is a codec which decodes a prefix of the encoded and returns the
 * unparsed suffix. *)
type 'a t = (string, 'a * string) Codec.t

(* Common parsers *)
val text_int: int t
val text_float: float t
val expect: string -> unit t

(* Regex matchers.
 * RE should have:
 * - "g" flag (mandatory)
 * - "^" at start
 * - no "m" flag
 * *)
(* The full match and the captures *)
val re_match: Js.Re.t -> string Js.Nullable.t array t
(* The full match *)
val re_match0: Js.Re.t -> string t
(* Expect this value on decoding, and encode to this value.
 * The regex must match the string. *)
val re_expect: Js.Re.t -> string -> unit t

(* Combinators *)
val stack_output: 'a t -> ('a, 'b) Codec.t -> 'b t
val stack_tail: 'a t -> 'b t -> ('a * 'b) t
val try_catch: 'a t -> 'b t -> ('a, 'b) result t
val optional: 'a t -> 'a option t
val repeated: 'a t -> 'a list t
val fst: ('a * unit) t -> 'a t
val snd: (unit * 'a) t -> 'a t
