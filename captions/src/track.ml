include Track_intf

let filter_cues now =
  List.filter (fun (cue : _ cue) -> cue.start <= now && now < cue.end_)

let at now t =
  t
  |> filter_cues now
  |> List.map (fun (cue : _ cue) -> cue.text)

let normalize (cue : _ cue) =
  let now = ref cue.start in
  let style = ref Style.empty in
  cue.text
  |> List.map (fun (token, _raw) ->
      match token with
        | Set_style s ->
            style := s;
            []
        | Wait_until t ->
            now := max !now t;
            []
        | Append text ->
            if !now < cue.end_
            then [{
              start = !now;
              style = !style;
              text;
            }]
            else [])
  |> List.flatten

let css_color (c : Style.Attr.color) (a : Style.Attr.alpha8) =
  Printf.sprintf "rgba(%d, %d, %d, %f)" c.r8 c.g8 c.b8 (float_of_int a /. 255.)

(* TODO: make a better data structure for this *)
let to_html deps now t =
  t
  |> filter_cues now
  |> List.map (fun (cue : _ cue) ->
    normalize cue
    |> List.map (fun { start; style; text; } ->
        let s : string Js.Dict.t =
          [
            if start <= now then None else Some ("visibility", "hidden");

            Style.get Bold style |> Option.map (fun x -> ("font-weight", if x then "bold" else "normal"));
            Style.get Italic style |> Option.map (fun x -> ("font-style", if x then "italic" else "normal"));
            Some (
              "text-decoration",
              (match Style.get Underline style |> Option.value ~default:false, Style.get Strikethrough style |> Option.value ~default:false with
              | false, false -> "none"
              | false, true -> "line-through"
              | true, false -> "underline"
              | true, true -> "underline line-through"));

            Style.get Font_style style |> Option.map (fun f ->
              ("font-family", match f with
              | Style.Attr.Serif_2 -> "serif"
              (* Don't have separate mono serif/sans fonts. *)
              | Mono_serif_1
              | Mono_sans_3 -> "monospace"
              | Default_0 -> "inherit"
              (* Set casual/small caps to sans. *)
              | Casual_5
              | Small_caps_7
              | Sans_4 -> "sans-serif"
              | Cursive_6 -> "cursive"
              )
            );
            (* Style.get Font_script style |> Option.map int_of_font_script; *)
            Style.get Font_size style |> Option.map (fun x -> ("font-size", (Js.Float.toString x) ^ "em"));
            (* Style.get Border_style style |> Option.map int_of_border_style; *)

            Some (
              "color",
              css_color
                (Style.get Font_color style |> Option.value ~default:({ r8 = 255; g8 = 255; b8 = 255; } : Style.Attr.color))
                (Style.get Font_alpha style |> Option.value ~default:255));
            Some (
              "background-color",
              css_color
                (Style.get Background_color style |> Option.value ~default:({ r8 = 0; g8 = 0; b8 = 0; } : Style.Attr.color))
                (Style.get Background_alpha style |> Option.value ~default:191));
            (* Style.get Border_color style |> Option.map int_of_color; *)

            (* Style.get Ruby style |> Option.map int_of_ruby; *)
          ]
          |> List.filter Option.is_some
          |> List.map Option.value_exn
          |> Js.Dict.fromList
        in
        [%raw {|({html, styleMap}, text, s) => html`<span class="captions-text" style=${styleMap(s)}>${text}</span>`|}] deps text s
  ))
  |> List.map Array.of_list
  |> Array.of_list
  |> [%raw {|({html}, x) => html`
    <div class="captions-bbox">
      ${x.map(e => html`<div class="captions-cue">${e}</div>`)}
    </div>
  `|}] deps
