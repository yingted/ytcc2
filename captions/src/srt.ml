type seconds = float
type token =
  | Tag of string
  | Plain of string
type text = token list
type cue = {
  start: seconds;
  end_: seconds;
  text: text;

  index: int;
  position: string option;
}
type track = {
  cues: cue list;
}

let seq_parser: int Parser.t = Parser.(first (pair text_int any_newline))

let rem: float -> float -> float =
  [%raw {| function rem(a, b) { return a % b; } |}]
let round: float -> float = [%raw {| Math.round |}]
let divmod a b: int * float =
  let rem = rem a b in
  (int_of_float (round ((a -. rem) /. b)), rem)
let idivmod (a: int) (b: int): int * int =
  let (q, r) = divmod (float_of_int a) (float_of_int b) in
  (q, int_of_float r)

let time_parser: seconds Parser.t =
  Parser.postprocess
    Parser.(Text.(
      let ( * ) = pair in
      let term x c = first (x * expect c) in
      (term i ":") * (term i ":") * (term i ",") * i))
    (Codec.pure
      ~decode:(fun (((hh, mm), ss), mmm) ->
        float_of_int (hh * 3600 + mm * 60 + ss) +. float_of_int mmm *. 0.001)
      ~encode:(fun ss ->
        let (ss, mmm) = divmod ss 1. in
        let mmm = int_of_float (round (mmm *. 1000.)) in
        let (mm, ss) = idivmod ss 60 in
        let (hh, mm) = idivmod mm 60 in
        (((hh, mm), ss), mmm)
      ))

let text_parser: text Parser.t =
  let ( * ) = Parser.pair in
  let tag = Parser.((expect "\\{\\\\" * easy_re0 "[^{}]*" * expect "\\}") |> first |> second) in
  (* Fallback: don't match into a tag *)
  let plain = Parser.(easy_re0 "(?:(?!\\{\\\\).)+|[^a]|a") in
  Parser.Ocaml.result tag plain
  |> Parser.Ocaml.map
    ~decode:(fun x ->
      match x with
      | Ok tag -> Tag tag
      | Error plain -> Plain plain)
    ~encode:(fun x ->
      match x with
      | Tag tag -> Ok tag
      | Plain plain -> Error plain)
  |> Parser.Ocaml.list

let cue_parser: cue Parser.t =
  let remove_duplicate_newlines_on_encode: (string, string) Codec.t =
    Codec.pure
      ~encode:Util.id
      ~decode:(fun s ->
        String.split_on_char '\n' s
        |> List.filter (fun s -> String.length s = 0)
        |> String.concat "\n") in
  Parser.(
    let ( * ) = pair in
    let term x t = first (x * t) in
    (* First line: sequence *)
    seq_parser *
    (* Second line: timestamps and position *)
    (term time_parser (easy_expect_re0 ~re:"\\s*-->\\s*" ~default:" --> ")) * time_parser *
      (term (optional (easy_re0 " .*")) any_newline) *
    (* Rest of the lines: text *)
    postprocess
      (postprocess
        (serialized
          (term (repeated (term (easy_re0 ".+") any_newline_or_eof)) any_newline_or_eof))
        remove_duplicate_newlines_on_encode)
      (Parser.at_end text_parser)
  )
  |> Parser.Ocaml.map
    ~decode:(fun ((((index, start), end_), position), text) ->
      { index; start; end_; position; text; })
    ~encode:(fun { index; start; end_; position; text; } ->
      ((((index, start), end_), position), text))
  

let srt_parser: track Parser.t =
  Parser.postprocess
    (Parser.repeated (cue_parser))
    (Codec.pure ~decode:(fun cues -> { cues }) ~encode:(fun track -> track.cues))

type t = track
let text_codec = Parser.at_end text_parser
let codec = Codec.stack Encoding.prefer_utf8 (Parser.at_end srt_parser)

let track_text = Lens.id
let track_cue =
  (* Ahh, we can't generate this yet. *)
  Lens.make
    ~get:(fun ({ start; end_; text; _ }: cue) ->
      let text = Lens.get track_text text in
      ({ start; end_; text; }: Track.cue))
    ~set:(fun { start; end_; text; } (cue: cue) ->
      let text = Lens.set track_text cue.text text in
      { cue with start; end_; text; })

(* 4 types of updates: delete + default/copy/move constructors *)
type cue_update = (cue, Track.cue) Allocator.update_copying
let cue_of_update = Allocator.pure_copying_lens track_cue
let allocator =
  Allocator.pure_copying
    ({ start = 0.; end_ = 0.; text = ""; }: Track.cue)
let list_filter_map f l =
  l |> List.map (fun x ->
    match f x with
    | None -> []
    | Some y -> [y]) |> List.flatten
let track: (t, cue_update Track.t) Lens.t =
  Lens.make
    ~get:(fun { cues; } ->
      (* Need to create a new one each time. *)
      let updates = List.map (fun cue -> (Move cue: cue_update)) cues in
      Lens_array.create updates cue_of_update allocator)
    ~set:(fun cues _t ->
      let updates = Lens_array.inspect cues in
      (* Assign new ids to each thing *)
      let indices =
        updates
        |> list_filter_map (fun (u: cue_update) ->
            match u with
            | Move cue -> Some (string_of_int cue.index, ())
            | _ -> None)
        |> Js.Dict.fromList
      in
      let next_index = ref 1 in
      let cues =
        updates
        |> List.map (fun (u: cue_update) ->
            match u with
            | Move cue -> cue
            | New { start; end_; text; _; }
            | Copy { start; end_; text; _; } ->
                while Option.is_some (Js.Dict.get indices (string_of_int !next_index)) do
                  next_index := !next_index + 1;
                done;
                Js.Dict.set indices (string_of_int !next_index) ();
                let index = !next_index in
                { start; end_; text; position = None; index; })
      in
      { cues })
