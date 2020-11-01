module Attr = struct
  include Style_intf.Attr

  module Map = Map.Make(struct
    type t = attr'
    let compare = compare
  end)
end

type t = Attr.value' Attr.Map.t

let empty = Attr.Map.empty
let from_list kvs =
  List.fold_right
    (fun kv t ->
      let Attr.Binding (k, v) = kv in
      Attr.Map.add (Attr k) (Attr.Value v) t)
    kvs Attr.Map.empty
let to_list m =
  Attr.Map.bindings m
  |> List.map (fun (Attr.Attr k, Attr.Value v) ->
      Attr.Binding (k, Obj.magic v))

let singleton k v =
  Attr.Map.singleton (Attr.Attr k) (Attr.Value v)

let set k v t =
  let v = v |> Option.map (fun x -> Attr.Value x) in
  Attr.Map.update (Attr k) (fun _ -> v) t
let get k t =
  Attr.Map.find_opt (Attr k) t
  |> Option.map (fun (Attr.Value v) -> Obj.magic v)

let cascade ts =
  ts
  |> List.map to_list
  |> List.flatten
  |> from_list
