(**
   Copyright 2020 Google LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*)

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
