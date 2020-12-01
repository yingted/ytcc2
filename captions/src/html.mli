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

(* Parsing almost-HTML. *)
(* Tags don't have to be correctly nested. *)
type attrs
type tag =
  (* All strings get lowercased *)
  | Open of string * attrs
  | Close of string

val tag_parser : tag Parser.t
(* Only supports a few HTML entities, rest are passed through. *)
val entity_parser : string Parser.t
val style_of_tag : string -> attrs -> Style.t
val tags_of_style : Style.t -> (string * attrs) list
