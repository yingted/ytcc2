(* Array wrapper that allows users to model object identity while preventing aliasing. *)
(* The contents are safely stored in an allocator, with read/write access through *)
(* a lens. *)
(* For efficiency, this class is mutable. Don't reuse instances. *)

(* It's like a ('a, 'b) Lens.t, except it has several different mutators *)
(* 'mode is whether copy is supported. Get/set/new/delete are always supported *)
type ('a, 'b, +'mode) t

(* Create from initial values, accessors, new/delete/copy *)
val create:
  'a list ->
  ('a, 'b) Lens.t ->
  ('a, 'mode) Allocator.t ->
  ('a, 'b, 'mode) t
(* Get the underlying list *)
val inspect: ('a, 'b, 'mode) t -> 'a list

(* Array ops *)
val length: (_, 'b, _) t -> int
val get_exn: (_, 'b, _) t -> int -> 'b
val set_exn: (_, 'b, _) t -> int -> 'b -> unit

(* new/delete *)
val emplace_exn: (_, 'b, _) t -> int -> 'b
val delete_exn: (_, 'b, _) t -> int -> unit

(* Identity-preserving updates *)
(* Move ctor *)
val swap_exn: (_, 'b, _) t -> int -> int -> unit
(* Some allocators may have a notion of copying. *)
(* For example, copying a file may preserve its metadata but create a new file id. *)
(* Copy/copy assign ctors *)
(* overwrite_copy_exn t src dst is equivalent to t[dst] = t[src] *)
val insert_copy_exn: ('a, 'b, Allocator.copy) t -> int -> int -> unit
val overwrite_copy_exn: ('a, 'b, Allocator.copy) t -> int -> int -> unit

(* Convenience *)
val to_list: (_, 'b, _) t -> 'b list
