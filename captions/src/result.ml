type ('ok, 'err) t = ('ok, 'err) result

let is_ok r =
  match r with
  | Ok _ -> true
  | Error _ -> false

let ok r =
  match r with
  | Ok x -> Some x
  | Error _ -> None

exception Result_error
let ok_exn r =
  match r with
  | Ok x -> x
  | Error _ -> raise Result_error

let error r =
  match r with
  | Ok _ -> None
  | Error x -> Some x

let bind r f =
  match r with
  | Ok x -> f x
  | Error e -> Error e

let return x = Ok x

let map r ~f =
  match r with
  | Ok x -> Ok (f x)
  | Error e -> Error e

let value r ~default =
  match r with
  | Ok x -> x
  | Error _ -> default
