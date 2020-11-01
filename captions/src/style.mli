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

(* Get or set the attribute values *)
val get : 'a Attr.attr -> t -> 'a option
val set : 'a Attr.attr -> 'a option -> t -> t

(* Merge from list, preferring first bindings (near list head). *)
val cascade : t list -> t
