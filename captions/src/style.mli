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

module Attr : sig
  (* A single style attribute, like "font-family: Arial;". *)
  include (module type of Style_intf.Attr)
  module Map : Map.S with type key = t
end

(* A set of attr bindings representing the computed style. *)
type t

val empty : t
(* Convert from list, preferring first bindings (near list head). *)
val from_list : Attr.binding' list -> t
(* Convert to list. *)
val to_list : t -> Attr.binding' list
val singleton : 'a Attr.attr -> 'a option -> t

(* Get or set the attribute values *)
val get : 'a Attr.attr -> t -> 'a option
val set : 'a Attr.attr -> 'a option -> t -> t

(* Merge from list, preferring first bindings (near list head). *)
val cascade : t list -> t
