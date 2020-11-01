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

exception Unknown_ass_tag of string
(* Parse an ASS tag. This always returns the original tag, just in case. *)
let ass_tag_codec: (string, Style.t) Codec.t =
  (* TODO *)
  Codec.make
    ~try_decode:(fun tag ->
      Error (Unknown_ass_tag tag))
    ~encode:(fun x ->
      "")

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

exception Assertion_error

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
      let html_style = Html.default_style () in
      let ass_style = ref [] in
      tokens
      |> List.map (map_first @@ fun (token: _) : Track.token ->
          match token with
          (* ASS tag *)
          | Ok (Ok (Ok style)) ->
              ass_style := style :: !ass_style;
              Set_style (Style.cascade !ass_style)
          | Ok (Ok (Error _ass)) ->
              (* Unknown, just treat as empty *)
              Set_style (Style.empty)
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
              (* TODO: parse this properly *)
              let _style = Html.apply html_style html in
              Set_style (failwith "not implemented")
          (* Plain text *)
          | Error (Error text) -> Append text))
    ~encode:(fun xs ->
      xs
      |> List.map (map_first @@ fun (x: Track.token) ->
          let _html_style = Html.default_style () in
          match x with
          (* TODO: decide between ASS and HTML style *)
          | Set_style style ->
              let html = failwith "not implemented" in
              Error (Ok html)
          | Append text -> Error (Error text)))

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
