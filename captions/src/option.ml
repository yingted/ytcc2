exception Empty_option
let value_exn t =
  match t with
  | Some x -> x
  | None -> raise Empty_option

let is_some t =
  match t with
  | Some _ -> true
  | None -> false

let value t ~default =
  match t with
  | Some x -> x
  | None -> default

let map f t =
  match t with
  | Some x -> Some (f x)
  | None -> None

let bind t f =
  match t with
  | None -> None
  | Some x -> f x

let map2 f x y =
  match x, y with
  | Some x, Some y -> Some (f x y)
  | _ -> None
