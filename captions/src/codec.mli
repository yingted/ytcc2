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
val decode_exn : ('co, 'dec) t -> 'co -> 'dec

(* Codec combinators *)
val stack: ('a, 'b) t -> ('b, 'c) t -> ('a, 'c) t
val fallback : ('a, 'b) t -> ('a, 'b) t -> ('a , 'b) t


(* Common codecs *)
val id: ('a, 'a) t
val text_int: (string, int) t
val text_float: (string, float) t
val json : (string, Js.Types.obj_val) t

(* Assertion *)
val expect: 'co -> ('co, unit) t
val expect_string: string -> (string, unit) t
