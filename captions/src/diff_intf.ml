module type S = sig
  (* The value being diffed: *)
  type value
  (* The diff: *)
  type t
  (* Compute the diff, or none if they are equal. *)
  val diff : value -> value -> t option
  (* Patch the value. This may not change the value, if the diff was already merged. *)
  val patch : t -> value -> value
end
