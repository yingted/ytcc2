type seconds = Track.seconds

(* Unrecognized tags *)
type raw = string
type cue = raw Track.cue
type text = raw Track.text

(* Parse the sequence *)
let seq_parser: int Parser.t = Parser.(first (pair text_int any_newline))

(* Parse the time *)
let rem: float -> float -> float =
  [%raw {| function rem(a, b) { return a % b; } |}]
let round: float -> float = [%raw {| Math.round |}]
let divmod a b: int * float =
  let rem = rem a b in
  (int_of_float (round ((a -. rem) /. b)), rem)
let idivmod (a: int) (b: int): int * int =
  let (q, r) = divmod (float_of_int a) (float_of_int b) in
  (q, int_of_float r)

exception Invalid_time of string
let time_parser: seconds Parser.t =
  Codec.make
    ~try_decode:(fun s ->
      match Scanf.sscanf s "%02d:%02d:%02d,%03d%n"
        (fun hh mm ss mmm n ->
          (
            float_of_int (hh * 3600 + mm * 60 + ss) +. float_of_int mmm *. 0.001,
            String.sub s n (String.length s)))
      with
      | (secs, tail) -> Ok (secs, tail)
      | exception Scanf.Scan_failure err -> Error (Invalid_time err))
    ~encode:(fun (ss, tail) ->
      let (ss, mmm) = divmod ss 1. in
      let mmm = int_of_float (round (mmm *. 1000.)) in
      let (mm, ss) = idivmod ss 60 in
      let (hh, mm) = idivmod mm 60 in
      Printf.sprintf "%02d:%02d:%02d,%03d" hh mm ss mmm ^ tail)

let with_raw p =
  Codec.make
    ~try_decode:(fun s ->
      match Codec.try_decode p s with
      | Ok (output, tail) -> Ok ((output, Some s), tail)
      | Error error -> Error error)
    ~encode:(fun ((output, raw), tail) ->
      (match raw with
      | Some raw -> raw ^ tail
      | None -> Codec.encode p (output, tail)))

exception Assertion_error
exception Unknown_ass_tag of string
(* Parse an ASS tag. This always returns the original tag, just in case. *)
let ass_tag_codec: (string, Style.t) Codec.t =
  Codec.make
    ~try_decode:(fun tag ->
      match tag with
      | "b0" -> Ok (Style.singleton Bold @@ Some false)
      | "b1" -> Ok (Style.singleton Bold @@ Some true)
      | "i0" -> Ok (Style.singleton Italic @@ Some false)
      | "i1" -> Ok (Style.singleton Italic @@ Some true)
      | "u0" -> Ok (Style.singleton Underline @@ Some false)
      | "u1" -> Ok (Style.singleton Underline @@ Some true)
      | "s0" -> Ok (Style.singleton Strikethrough @@ Some false)
      | "s1" -> Ok (Style.singleton Strikethrough @@ Some true)
      (* TODO: parse other tags *)
      | _ -> Error (Unknown_ass_tag tag))
    (* Decode only, encode is HTML. *)
    ~encode:(fun _x -> raise Assertion_error)

let or_raw (codec: (string, 'a) Codec.t): (string, ('a, string) result) Codec.t =
  Codec.pure
    ~decode:(fun s ->
      match Codec.try_decode codec s with
      | Ok output -> Ok output
      | Error _ -> Error s)
    ~encode:(fun r ->
      match r with
      | Ok output -> Codec.encode codec output
      | Error s -> s)

let map_first f = fun (x, y) -> (f x, y)

(* A hybrid tag stack *)
module Styles = struct
  type kind =
    | Ass
    | Html of string
  type t = (kind * Style.t) list

  let empty = []
  let cons_ass v t = (Ass, v) :: t
  let cons_html k v t = (Html k, v) :: t
  let rec pop_html k t =
    match t with
    | [] -> []
    | (k', _v') :: tail ->
        if k' = Html k
        then tail
        else pop_html k tail
  let style t =
    t
    |> List.map snd
    |> Style.cascade

  let close_tags (t : t) : Html.tag list =
    t
    |> List.map (fun x ->
        match x with
        | (Ass, _style) -> []
        | (Html name, _style) -> [Html.Close name])
    |> List.flatten
  let of_style style =
    style
    |> Html.tags_of_style
    |> List.map (fun (name, attrs) -> (Html name, (Html.style_of_tag name attrs)))
  let open_tags t =
    t
    |> List.rev_map (fun (kind, style) ->
        match kind, Html.tags_of_style style with
        | Html name, [(name', attrs')] ->
            if name' = name
            then Html.Open (name, attrs')
            else raise Assertion_error
        | _ ->
            raise Assertion_error)
end

let text_parser: text Parser.t =
  let ( * ) = Parser.pair in
  let tag: (Style.t, string) result Parser.t =
    Parser.((expect "{\\" * (postprocess (easy_re0 "[^{}]*") (or_raw ass_tag_codec)) * expect "}") |> first |> second)
  in
  let special = Parser.(expect "\\" * easy_re0 "[nNh]" |> second) in
  (* Fallback: don't match into a tag *)
  let plain = Parser.(easy_re0 "(?:(?!\\{\\\\|\\\\[nNh]|</?[a-zA-Z])(?:[^a]|a))+|[^a]|a") in
  Parser.Ocaml.(result
    (* ASS format *)
    (result tag special)
    (result Html.tag_parser plain))
  |> with_raw
  |> Parser.Ocaml.list
  |> Parser.Ocaml.map
    ~decode:(fun tokens ->
      let styles = ref Styles.empty in
      tokens
      |> List.map (map_first @@ fun (token: _) : Track.token ->
          match token with
          (* ASS tag *)
          | Ok (Ok (Ok style)) ->
              styles := Styles.cons_ass style !styles;
              Set_style (Styles.style !styles)
          | Ok (Ok (Error _ass)) ->
              (* Unknown, just treat as empty *)
              Append ""
          (* ASS special character *)
          | Ok (Error special) ->
              (match special with
              | "N" -> Append "\n"
              | "h" -> Append "\xa0"
              (* we should make it \n if we are in mode \q2. *)
              | "n" -> Append " "
              | _ -> raise Assertion_error)
          (* HTML tag *)
          | Error (Ok html) ->
              (match (html : Html.tag) with
              | Open (name, attrs) ->
                  styles := Styles.cons_html name (Html.style_of_tag name attrs) !styles;
              | Close name ->
                  styles := Styles.pop_html name !styles;);
              Set_style (Styles.style !styles)
          (* Plain text *)
          | Error (Error text) -> Append text))
    ~encode:(fun xs ->
      let styles = ref Styles.empty in
      (* List of text and styles, some of which have a raw repr. *)
      (* Preserve the raw reprs, but possibly add styles around them. *)
      xs
      |> List.map (fun ((x : Track.token), (raw : string option)) : ((_, _) result * string option) list ->
          let old_style = !styles in
          (* Interpret the token, ignoring raw. *)
          let append_ops : (_ * string option) list =
            match x with
            | Set_style new_style ->
                styles := Styles.of_style new_style;
                []
            | Append text -> [(Error (Error text), raw)]
          in

          (* Diff the old and new styles. *)
          let close_tags = ref @@ Styles.close_tags old_style in
          let open_tags = ref @@ Styles.open_tags !styles in
          let old_open_tags = ref @@ Styles.open_tags old_style in
          while !open_tags != [] && !old_open_tags != [] && List.hd !open_tags = List.hd !old_open_tags do
            open_tags := List.tl !open_tags;
            old_open_tags := List.tl !old_open_tags;
            close_tags := List.tl !close_tags;
          done;

          (* Change the style and append some text. *)
          (* Only one of the style change and append types should be here at any time. *)
          let wrap tags = tags |> List.map (fun tag -> (Error (Ok tag), None)) in
          (wrap !close_tags) @ (wrap !open_tags) @ append_ops
        )
      |> List.flatten)

let cue_parser: (int * cue) Parser.t =
  let remove_duplicate_newlines_on_encode: (string, string) Codec.t =
    Codec.pure
      ~encode:Util.id
      ~decode:(fun s ->
        String.split_on_char '\n' s
        |> List.filter (fun s -> String.length s = 0)
        |> String.concat "\n") in
  Parser.(
    let ( * ) = pair in
    let term t x = first (x * t) in
    (* First line: sequence *)
    seq_parser *
    (* Second line: timestamps and position *)
    (((time_parser |> term (easy_expect_re ~re:"\\s*-->\\s*" ~default:" --> ")) * time_parser) |> term any_newline) *
    (* Rest of the lines: text *)
    postprocess
      (postprocess
        (easy_re0 ".+" |> term any_newline_or_eof |> repeated |> term any_newline_or_eof |> serialized)
        remove_duplicate_newlines_on_encode)
      (Parser.at_end text_parser)
  )
  |> Parser.Ocaml.map
    ~decode:(fun ((index, (start, end_)), text) ->
      (
        (index: int),
        ({ start; end_; text; } : cue)
      ))
    ~encode:(fun (index, { start; end_; text; }) ->
      ((index, (start, end_)), text))
  

let srt_parser: cue list Parser.t =
  Parser.postprocess
    (Parser.repeated (cue_parser))
    (Codec.pure
      ~decode:(List.map (fun (_i, cue) -> cue))
      ~encode:(List.mapi (fun i cue -> (i + 1, cue))))

type t = cue list
let text_codec = Parser.at_end text_parser
let codec = Codec.stack Encoding.prefer_utf8 (Parser.at_end srt_parser)
