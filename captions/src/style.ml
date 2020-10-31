type ('v, 'd) k =
  | Bold: (bool, bool) k
  | Italic: (bool, bool) k
  | Underline: (bool, bool) k
  | Strikethrough: (bool, bool) k

type kp = Key: ('v, 'd) k -> kp
type vp = Value: 'v -> vp
(* type dp = Diff: 'd -> dp *)
module ValueMap = Map.Make(struct
  type t = kp
  let compare = compare
end)

type v = vp ValueMap.t
type t = v
let none = ValueMap.empty
let at (k: ('v, 'd) k) =
  let k = Key k in
  Lens.make
    ~get:(fun m ->
      match ValueMap.find_opt k m with
      | None -> None
      | Some (Value v) ->
          Some ((Obj.magic v): 'v))
    ~set:(fun v m ->
      ValueMap.update k (Util.const (Some (Value v))) m)

(* module DiffMap = Map.Make(struct *)
(*   type t = kp *)
(*   let compare = compare *)
(* end) *)
(* type d = dp DiffMap.t *)
(* let id = DiffMap.empty *)

let diff (type v) (type d) (k: (v, d) k) (v1: v) (v2: v): d option =
  if v1 = v2
  then None
  else
    match k with
    | Bold -> Some v2
    | Italic -> Some v2
    | Underline -> Some v2
    | Strikethrough -> Some v2

let patch (type v) (type d) (k: (v, d) k) (d: d) (_v: v): v =
  match k with
  | Bold -> d
  | Italic -> d
  | Underline -> d
  | Strikethrough -> d
