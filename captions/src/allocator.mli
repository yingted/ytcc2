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

(* For pure code, just use these ones *)
type ('a, 'b) update =
  | Move of 'a
  | New of 'b
(* Just give the default value *)
val pure: 'b -> (('a, 'b) update, no_copy) t
val pure_lens: ('a, 'b) Lens.t -> (('a, 'b) update, 'b) Lens.t
type ('a, 'b) update_copying =
  | Move of 'a
  | New of 'b
  | Copy of 'a
val pure_copying: 'b -> (('a, 'b) update_copying, copy) t
val pure_copying_lens: ('a, 'b) Lens.t -> (('a, 'b) update_copying, 'b) Lens.t

val new_: ('a, _) t -> 'a
val copy: ('a, copy) t -> 'a -> 'a
val delete: ('a, _) t -> 'a -> unit
