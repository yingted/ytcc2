include module type of Track_intf

val normalize : 'raw cue -> std_token list

(* val at : seconds -> 'raw t -> (cea708_window * 'raw text) list *)
val at : seconds -> 'raw t -> 'raw text list
(* deps(html, styleMap) -> seconds -> 'raw t -> TemplateResult *)
val to_html : Js.Types.obj_val -> seconds -> 'raw t -> Js.Types.obj_val

(* deps(html, styleMap) -> 'raw text -> TemplateResult *)
val text_to_html : Js.Types.obj_val -> 'raw text -> Js.Types.obj_val

val empty : 'raw t
