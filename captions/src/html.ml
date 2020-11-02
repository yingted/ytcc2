type attrs = (string * string) list
type tag =
  | Open of string * attrs
  | Close of string

let tag_name_parser: string Parser.t =
  Parser.(easy_re0 "[a-zA-Z][a-zA-Z0-9]*" |> postprocess)
    (Codec.pure
      ~decode:String.lowercase_ascii
      ~encode:Util.id)

let quoted_parser left pat right: string Parser.t =
  let ( * ) = Parser.pair in
  Parser.(
    expect left *
    easy_re0 pat *
    expect right
    |> first |> second)

let attrs_parser: (string * string) Parser.t =
  let ( * ) = Parser.pair in
  (* Attribute name *)
  Parser.(easy_re0 "[^\\t\\n\\f />\"'=]+" * Ocaml.option (
    (* Attribute value *)
    (* We're not decoding HTML entities - too much work *)
    easy_expect_re ~default:"=" ~re:"\\s*=\\s*" * (
      (* Unquoted *)
      fallback
        (quoted_parser "\"" "[^\"]*" "\"")
        (fallback
          (quoted_parser "" "[^ \\n\\r\\f\\t\"'=<>`]+" "")
          (quoted_parser "'" "[^']*" "'")))
    |> second) |> postprocess)
    (Codec.pure
      ~decode:(fun (name, value) -> (String.lowercase_ascii name, Option.value ~default:"" value))
      ~encode:(fun (name, value) -> (name, Some value)))

let open_parser: (string * attrs) Parser.t =
  let ( * ) = Parser.pair in
  Parser.(expect "<" * tag_name_parser * Ocaml.list (pair (easy_expect_re ~default:" " ~re:"\\s*") attrs_parser |> second) * expect ">" |> first |> postprocess)
    (Codec.pure
      ~decode:(fun (((), tag_name), attrs) ->
        (tag_name, attrs))
      ~encode:(fun (tag_name, attrs) ->
        (((), tag_name), attrs)))

let close_parser: string Parser.t =
  let ( * ) = Parser.pair in
  Parser.(expect "</" * tag_name_parser * easy_expect_re ~default:"" ~re:"\\s*" * expect ">" |> first |> first |> second)

let tag_parser: tag Parser.t =
  Parser.Ocaml.result open_parser close_parser
  |> Parser.Ocaml.map
    ~decode:(fun result ->
      match result with
      | Ok (name, attrs) -> Open (name, attrs)
      | Error name -> Close name)
    ~encode:(fun tag ->
      match tag with
      | Open (name, attrs) -> Ok (name, attrs)
      | Close name -> Error name)

(* https://stackoverflow.com/questions/819079/how-to-convert-font-size-10-to-px *)
let rem_of_html4_font_size =
  [|0.63; 0.82; 1.0; 1.13; 1.5; 2.; 3.|]
(* https://www.w3.org/TR/2002/WD-css3-color-20020418/#html4 *)
let html4_colors =
  Belt.Map.String.fromArray [|
    ("black", "#000000");
    ("green", "#008000");
    ("silver", "#c0c0c0");
    ("lime", "#00ff00");
    ("gray", "#808080");
    ("olive", "#808000");
    ("white", "#ffffff");
    ("yellow", "#ffff00");
    ("maroon", "#800000");
    ("navy", "#000080");
    ("red", "#ff0000");
    ("blue", "#0000ff");
    ("purple", "#800080");
    ("teal", "#008080");
    ("fuchsia", "#ff00ff");
    ("aqua", "#00ffff");
  |]
let common_fonts =
  let open Style.Attr in
  [
    ("courier", Mono_serif_1);
    ("courier new", Mono_serif_1);
    ("times new roman", Serif_2);
    ("georgia", Serif_2);
    ("arial mono", Mono_sans_3);
    ("lucida console", Mono_sans_3);
    ("arial", Sans_4);
    ("roboto", Sans_4);
    ("comic sans ms", Casual_5);
    ("monotype corsiva", Cursive_6);
  ]

let common_fonts_inv =
  common_fonts
  |> List.map (fun (k, v) -> (v, k))
  |> List.sort compare

let style_of_tag (name : string) (a : attrs) : Style.t =
  match name with
  | "strong" | "b" -> Style.singleton Bold @@ Some true
  | "em" | "i" -> Style.singleton Italic @@ Some true
  | "u" -> Style.singleton Underline @@ Some true
  | "strike" | "del" | "s" -> Style.singleton Strikethrough @@ Some true
  | "font" ->
      a
      |> List.map (fun (attr, value) ->
          let value =
            value
            |> String.lowercase_ascii
            |> String.trim
          in
          match attr with
          | "size" ->
              (match int_of_string value with
              | size when 1 <= size && size <= 7 ->
                  Style.singleton Font_size @@
                  Some (Array.get rem_of_html4_font_size (size - 1))
              | _ -> Style.empty
              | exception Invalid_argument _ -> Style.empty)
          | "color" ->
              (let value = Belt.Map.String.get html4_colors value |> Option.value ~default:value in
              let value =
                if String.length value >= 1 && String.sub value 0 1 != "#"
                then "#" ^ value
                else value
              in
              match String.length value with
              | 4 ->
                  let rgb = Scanf.sscanf value "#%x%!" Util.id in
                  Style.singleton Font_color @@
                  Some {
                    r8 = ((rgb asr  8) land 0xf) * 0x11;
                    g8 = ((rgb asr  4) land 0xf) * 0x11;
                    b8 = ( rgb         land 0xf) * 0x11;
                  }
              | 7 ->
                  let rrggbb = Scanf.sscanf value "#%x%!" Util.id in
                  Style.singleton Font_color @@
                  Some {
                    r8 = (rrggbb asr 16) land 0xff;
                    g8 = (rrggbb asr  8) land 0xff;
                    b8 =  rrggbb        land 0xff;
                  }
              | _ -> Style.empty)
          | "face" ->
              (match List.assoc_opt value common_fonts with
              | None -> Style.empty
              | Some font -> Style.singleton Font_style @@ Some font)
          | _ -> Style.empty)
      (* Prefer first attrs *)
      |> Style.cascade
  | _ -> Style.empty

let clip x = max 0 (min 255 x)

let tags_of_style (style : Style.t) : (string * attrs) list =
  let tags = Belt.MutableMap.String.make () in
  let set_attr tag (kvs : (string * string) list) =
    (* Ensure we have this tag *)
    Belt.MutableMap.String.update tags tag (fun x ->
      match x with
      | Some x -> Some x
      | None -> Some (Belt.MutableMap.String.make ()));
    let attrs = Belt.MutableMap.String.getExn tags tag in
    kvs |> List.iter (fun (k, v) -> Belt.MutableMap.String.set attrs k v)
  in
  let open Style.Attr in
  style
  |> Style.to_list
  |> List.iter (fun (Binding (k, v)) ->
      match (k, v) with
      | (Bold, true) -> set_attr "b" []
      | (Italic, true) -> set_attr "i" []
      | (Underline, true) -> set_attr "u" []
      | (Strikethrough, true) -> set_attr "s" []
      | (Font_color, { r8; g8; b8; }) ->
          set_attr "font" [("color", Printf.sprintf "#%02x%02x%02x" (clip r8) (clip g8) (clip b8))]
      | (Font_style, style) ->
          (match List.assoc_opt style common_fonts_inv with
          | None -> ()
          | Some font -> set_attr "font" [("face", font)])
      | (Font_size, size) ->
          let min_by_dist =
            (fun (i1, x1) (i2, x2) ->
              if abs_float (size -. x2) < abs_float (size -. x1)
              then (i2, x2)
              else (i1, x1))
          in
          let html4_size =
            rem_of_html4_font_size
            |> Array.to_list
            |> List.mapi (fun i x -> (i + 1, x))
            |> (fun x -> List.fold_left min_by_dist (List.hd x) (List.tl x))
            |> fst
          in
          set_attr "font" [("size", string_of_int html4_size)]
      | _ -> ());
  tags
  |> Belt.MutableMap.String.toList
  |> List.map (fun (name, attrs) -> (name, Belt.MutableMap.String.toList attrs))
