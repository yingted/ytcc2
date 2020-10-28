(* Mutable allocator for modelling object identity *)
type no_copy
type copy
type ('a, +'mode) t

val create:
  new_:(unit -> 'a) ->
  delete:('a -> unit) ->
  ('a, no_copy) t

val create_copying:
  new_:(unit -> 'a) ->
  delete:('a -> unit) ->
  copy:('a -> 'a) ->
  ('a, copy) t

val new_: ('a, _) t -> 'a
val copy: ('a, copy) t -> 'a -> 'a
val delete: ('a, _) t -> 'a -> unit
