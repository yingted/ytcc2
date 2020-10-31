(* CSS algebra *)
(* Each key has an associated value type and diff type. *)
(* THe diff type only applies if they are different. *)
type ('v, 'd) k =
  | Bold: (bool, bool) k
  | Italic: (bool, bool) k
  | Underline: (bool, bool) k
  | Strikethrough: (bool, bool) k

(* A map of attribute to their values *)
type v
type t = v
val none: v
(* Attribute access: *)
val at: ('v, 'd) k -> (v, 'v option) Lens.t


(* A map of attribute to diffs *)
(* type d *)
(* val id: d *)
(* Diffing: ab = diff a b *)
val diff: ('v, 'd) k -> 'v -> 'v -> 'd option
(* Patching: b = patch ab a *)
val patch: ('v, 'd) k -> 'd -> 'v -> 'v
