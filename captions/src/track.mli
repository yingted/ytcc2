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

include module type of Track_intf

val normalize : 'raw cue -> std_token list
val normalize' : 'raw cue -> (std_token * 'raw option) list

(* val at : seconds -> 'raw t -> (cea708_window * 'raw text) list *)
val at : seconds -> 'raw t -> 'raw text list
(* deps(html, styleMap) -> seconds -> 'raw t -> TemplateResult *)
val to_html : Js.Types.obj_val -> seconds -> 'raw t -> Js.Types.obj_val

(* deps(html, styleMap) -> 'raw text -> TemplateResult *)
val text_to_html : Js.Types.obj_val -> 'raw text -> Js.Types.obj_val

val strip_raw : 'a t -> 'b t

val empty : 'raw t

type 'raw span = {
  start : seconds;
  style : string Js.Dict.t;
  text : string;
  raw: 'raw option;
}
val text_to_spans : string text -> string span array
