module Attr = struct
  include Style_intf.Attr

  (* module Diff = Diff.Const_diff(struct type t = value' end) *)
  module Map = Map.Make(struct
    type t = attr'
    let compare = compare
  end)
end

module Style = struct
  type t = Attr.value' Attr.Map.t

  (* module Diff = struct *)
  (*   type value = t *)
  (*   type t = Attr.value' option Attr.Map.t *)
  (* end *)

  let set k v t =
    let v = v |> Option.map (fun x -> Attr.Value x) in
    Attr.Map.update k (fun _ -> v) t
  let get = Attr.Map.find_opt
end
