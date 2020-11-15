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
