module Attr = struct
  type cea708_style =
    | Default_0  (* YouTube defaults to 4 *)
    | Mono_serif_1
    | Serif_2
    | Mono_sans_3
    | Sans_4
    | Casual_5
    | Cursive_6
    | Small_caps_7
  (* colors and alpha *)
  type color = {
    r8: int;
    g8: int;
    b8: int;
  }
  type alpha8 = int
  type script = Normal | Sub | Super
  type cea708_border =
    | None_0
    | Raised_1
    | Depressed_2
    | Uniform_3
    | Left_drop_shadow_4
    | Right_drop_shadow_5
  type ruby =
    | None
    | Base
    | Fallback_parenthesis
    (* Ruby text positioned on this side of the base text *)
    | Text_auto
    | Text_top
    | Text_bottom
    | Text_left
    | Text_right
  type 'a attr =
    (* Formats *)
    | Bold: bool attr
    | Italic: bool attr
    | Underline: bool attr
    | Strikethrough: bool attr

    (* Styles *)
    | Font_style: cea708_style attr
    | Font_script: script attr
    | Font_size: float attr
    | Border_style: cea708_border attr

    (* Color *)
    | Font_color: color attr
    | Background_color: color attr
    | Border_color: color attr
    | Font_alpha: alpha8 attr
    | Background_alpha: alpha8 attr
    | Border_alpha: alpha8 attr

    (* Ruby and bouten (set together) *)
    | Ruby: (ruby * bool) attr

  (* type cea708_window = { *)
  (*   print_direction: `Left_to_right | `Right_to_left | `Top_to_bottom | `Bottom_to_top; *)
  (*   scroll_direction: `Left_to_right | `Right_to_left; *)
  (*   justification: `Left | `Center | `Right; *)
  (*   num_rows: int; *)
  (*   num_cols: int; *)
  (*   fill: color; *)
  (*   fill_alpha: alpha8; *)
  (*   border_type: ...; *)
  (*   border: color; *)
  (*   border_alpha: alpha8; *)
  (* } *)

  type attr' = Attr: 'a attr -> attr'
  type value' = Value: 'a -> value'
  type binding' = Binding: 'a attr * 'a -> binding'

  type t = attr'
end
