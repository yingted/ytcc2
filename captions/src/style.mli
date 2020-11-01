module Attr : sig
  (* A single style attribute, like "font-family: Arial;". *)
  include (module type of Style_intf.Attr)
  (* module Diff : (Diff_intf.S with type value = value') *)
  module Map : Map.S with type key = t
end

module Style : sig
  (* A set of attr bindings representing the computed style. *)
  type t
  (* module Diff : (Diff_intf.S with type value = t) *)

  (* Get or set the attribute values *)
  val get: 'a Attr.attr -> t -> 'a option
  val set: 'a Attr.attr -> 'a option -> t -> t

  (* Same thing, but as a Diff.t *)
  (* Advantage of a Diff.t over t -> t is that we can print it to the screen and file. *)
  val set': 'a Attr.attr -> 'a option -> Diff.t

  (* Apply multiple attributes, taking the first if there are conflicts. *)
  val merge_first: Diff.t list -> Diff.t

  val to_list: t -> Attr.binding' list
end
