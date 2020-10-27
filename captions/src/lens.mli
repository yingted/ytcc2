type ('o, 'i) t

val make: get:('o -> 'i) -> set:('i -> 'o -> 'o) -> ('o, 'i) t

val get: ('o, 'i) t -> 'o -> 'i
val set: ('o, 'i) t -> 'i -> 'o -> 'o

val id: ('a, 'a) t
val compose: ('i, 'i2) t -> ('o, 'i) t -> ('o, 'i2) t
val readonly: ('o, 'i) t -> ('o, 'i) t

val pair: ('o1, 'i1) t -> ('o2, 'i2) t -> ('o1 * 'o2, 'i1 * 'i2) t
(* Set both values. Sets the left inner value first. *)
val both: ('o, 'i1) t -> ('o, 'i2) t -> ('o, 'i1 * 'i2) t
(* Inner map *)
val imap: get:('i -> 'i2) -> set:('i2 -> 'i) -> ('o, 'i) t -> ('o, 'i2) t
(* Outer map *)
val omap: get:('o2 -> 'o) -> set:('o -> 'o2) -> ('o, 'i) t -> ('o2, 'i) t

(* Forward mode eval *)
val eval: (('a, 'a) t -> ('a, 'b) t) -> 'a -> 'b
(* Backward mode eval, which requires some data from the forward mode *)
val ieval: (('a, 'a) t -> ('a, 'b) t) -> 'a -> 'b -> 'a
