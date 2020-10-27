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
val postprocess: 'a t -> ('a, 'b) Codec.t -> 'b t
val pair: 'a t -> 'b t -> ('a * 'b) t
val try_catch: 'a t -> 'b t -> ('a, 'b) result t
val optional: 'a t -> 'a option t
val repeated: 'a t -> 'a list t
val first: ('a * unit) t -> 'a t
val second: (unit * 'a) t -> 'a t

(* Easy version that turns "my_regex" into /^(?:my_regex)/g *)
val easy_re0: string -> string t
val easy_expect_re0: re:string -> default:string -> unit t

(* Miscellaneous *)
val any_newline: unit t

module Text : sig
  val i: int t
  val f: float t
end
