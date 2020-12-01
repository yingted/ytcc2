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

let normalize' (cue : _ cue) =
  let now = ref cue.start in
  let style = ref Style.empty in
  cue.text
  |> List.map (fun (token, raw) ->
      let text =
        match token with
          | Set_style s ->
              style := s;
              ""
          | Wait_until t ->
              now := max !now t;
              ""
          | Append text ->
              (* Do not layout or read text that's never drawn. *)
              if !now < cue.end_
              then text
              else ""
      in
      ({
        start = !now;
        style = !style;
        text;
      }, raw))

let css_color (c : Style.Attr.color) (a : Style.Attr.alpha8) =
  Printf.sprintf "rgba(%d, %d, %d, %f)" c.r8 c.g8 c.b8 (float_of_int a /. 255.)

let css_of_style visible style =
  [
    if visible then None else Some ("visibility", "hidden");

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
        (Style.get Background_color style |> Option.value ~default:({ r8 = 8; g8 = 8; b8 = 8; } : Style.Attr.color))
        (Style.get Background_alpha style |> Option.value ~default:191));
    (* Style.get Border_color style |> Option.map int_of_color; *)

    (* Style.get Ruby style |> Option.map int_of_ruby; *)
  ]
  |> List.filter Option.is_some
  |> List.map Option.value_exn
  |> Js.Dict.fromList

let merge collapse items =
  let merged = ref [] in
  items |> List.iter (fun x ->
    merged := (
      match !merged with
      | prev_x :: tail ->
          (match collapse prev_x x with
          | Some x' -> x' :: tail
          | None -> x :: prev_x :: tail)
      | tail -> x :: tail));
  List.rev !merged

let cue_to_html deps now (cue : _ cue) =
  let merged =
    normalize cue
    |> List.map (fun { start; style; text; } ->
        let s : string Js.Dict.t = css_of_style (start <= now) style in
        (text, s))
    |> merge (fun (prev_text, prev_s) (text, s) ->
        if prev_s = s
        then Some (prev_text ^ text, prev_s)
        else None)
  in
  let plain_text =
    merged
    |> List.map (fun (text, _s) -> text)
    |> String.concat ""
  in
  merged
  |> List.map (fun (text, s) ->
      [%raw {|({html, styleMap}, text, s) => html`<span class="captions-text" style=${styleMap(s)}>${text}</span>`|}] deps text s)
  |> Array.of_list
  |> [%raw {|({html}, plain_text, spans) => html`
    <div role="alert" aria-live="assertive" aria-label=${plain_text}></div>
    <div class="captions-cue" aria-hidden="true">${spans}</div>
  `|}] deps plain_text

let infinity = 1.0 /. 0.0
let text_to_html deps (text : _ text) =
  cue_to_html deps infinity {
    start = 0.0;
    end_ = infinity;
    text;
  }

(* TODO: make a better data structure for this *)
let to_html deps now t =
  t
  |> filter_cues now
  |> List.map (cue_to_html deps now)
  |> Array.of_list
  |> [%raw {|({html}, cues) => html`<div class="captions-bbox">${cues}</div>`|}] deps

let strip_raw (type a) (type b) (t : a t) : b t =
  t |> List.map (fun (cue : a cue) -> {
    cue with text = cue.text
      |> List.map (fun (span, _raw) -> (span, None))
  })

let empty = []

type 'raw span = {
  start : seconds;
  style : string Js.Dict.t;
  text : string;
  raw: 'raw option;
}
let text_to_spans (text : _ text) =
  normalize' {
    start = 0.0;
    end_ = infinity;
    text;
  }
  |> merge (fun
    (({ start; style; text; } : std_token), raw)
    (({ start = start'; style = style'; text = text'; } : std_token), raw') ->
      if style' = style && start' = start && text' != "" && text != ""
      then Some (({
        start;
        style;
        text = text' ^ text;
      } : std_token), Option.map2 (^) raw' raw)
      else None)
  |> List.map (fun (({ start; style; text; } : std_token), raw) ->
      { 
        start;
        style = css_of_style true style;
        text;
        raw;
      })
  |> Array.of_list
