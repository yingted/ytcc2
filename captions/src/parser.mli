(**
   Copyright 2020 Google LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*)

(* A parser is a codec which decodes a prefix of the encoded and returns the
 * unparsed suffix. *)
type 'a t = (string, 'a * string) Codec.t

(* Common parsers *)
val id: string t
val empty: unit t
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
(* Ignore, with a default value on encode *)
val ignore: 'a -> 'a t -> unit t
(* Decode to the serialized representation *)
val serialized: 'a t -> string t
(* Decode with the first if possible. Encode with the first. *)
val fallback: 'a t -> 'a t -> 'a t

(* Like repeated, but with a separator. *)
(* t is responsible for stopping before the separator. *)
(* Only the first match must succeed. *)
(* On encode, an empty list encodes to the empty string. *)
(* repeated t = separated ~sep:empty t *)
val separated: 'a t -> sep:(unit t) -> 'a list t
(* Match t followed by a delimiter. *)
(* t is responsible for stopping before the separator. *)
(* t = delimited ~sep:empty t *)
(* val delimited: 'a t -> sep:(unit t) -> 'a t *)

(* Easy version that turns "my_regex" into /^(?:my_regex)/g *)
val easy_re0: string -> string t
val easy_expect_re: re:string -> default:string -> unit t

(* Convert to codec *)
val at_end: 'a t -> (string, 'a) Codec.t

(* Miscellaneous *)
val any_newline: unit t
val any_newline_or_eof: unit t

module Text : sig
  (* Printf names for text format *)
  val i: int t
  val f: float t
end
module Ocaml : sig
  (* Ocaml names for combinators *)
  val pair  : 'a t -> 'b t ->                                         ('a * 'b                         ) t
  val tuple3: 'a t -> 'b t -> 'c t ->                                 ('a * 'b * 'c                    ) t
  val tuple4: 'a t -> 'b t -> 'c t -> 'd t ->                         ('a * 'b * 'c * 'd               ) t
  val tuple5: 'a t -> 'b t -> 'c t -> 'd t -> 'e t ->                 ('a * 'b * 'c * 'd * 'e          ) t
  val tuple6: 'a t -> 'b t -> 'c t -> 'd t -> 'e t -> 'f t ->         ('a * 'b * 'c * 'd * 'e * 'f     ) t
  val tuple7: 'a t -> 'b t -> 'c t -> 'd t -> 'e t -> 'f t -> 'g t -> ('a * 'b * 'c * 'd * 'e * 'f * 'g) t
  val result: 'a t -> 'b t -> ('a, 'b) result t
  val option: 'a t -> 'a option t
  val list: 'a t -> 'a list t
  val unit: 'a -> 'a t -> unit t

  val map: decode:('a -> 'b) -> encode:('b -> 'a) -> 'a t -> 'b t
end
