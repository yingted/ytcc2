exception Empty_option
let value_exn t =
  match t with
  | Some x -> x
  | None -> raise Empty_option

let is_some t =
  match t with
  | Some _ -> true
  | None -> false
