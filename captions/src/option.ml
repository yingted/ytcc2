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
