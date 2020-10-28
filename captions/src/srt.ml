type seconds = float
type text = string
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

let text_parser: text Parser.t = Parser.id

let cue_parser: cue Parser.t =
  Parser.postprocess
    Parser.(
      let ( * ) = pair in
      let term x t = first (x * t) in
      (* First line: sequence *)
      seq_parser *
      (* Second line: timestamps and position *)
      (term time_parser (easy_expect_re0 ~re:"\\s*-->\\s*" ~default:" --> ")) * time_parser *
        (term (optional (easy_re0 " .*")) any_newline) *
      (* Rest of the lines: text *)
      term (repeated (term (easy_re0 ".+") any_newline_or_eof)) any_newline_or_eof)
    (Codec.pure
      ~decode:(fun ((((index, start), end_), position), lines) ->
        let text = String.concat "\n" lines in
        { index; start; end_; position; text; })
      ~encode:(fun { index; start; end_; position; text; } ->
        let lines =
          String.split_on_char '\n' text
          |> List.filter (fun s -> String.length s = 0) in
        ((((index, start), end_), position), lines)))
  

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
type cue_update =
  | Move of cue
  | New of Track.cue
  | Copy of cue
let cue_of_update =
  Lens.make
    ~get:(fun x ->
      match x with
      | Move cue -> Lens.get track_cue cue
      | New cue -> cue
      | Copy cue -> Lens.get track_cue cue)
    ~set:(fun v x ->
      match x with
      | Move cue -> Move (Lens.set track_cue v cue)
      | New _cue -> New v
      | Copy cue -> Copy (Lens.set track_cue v cue))
let allocator = Allocator.create_copying
  ~new_:(fun () -> New { start = 0.; end_ = 0.; text = ""; })
  ~delete:(fun _x -> ())
  ~copy:(fun x ->
    match x with
    | Copy cue -> Copy cue
    | New cue -> New cue
    | Move cue -> Copy cue)
let list_filter_map f l =
  l |> List.map (fun x ->
    match f x with
    | None -> []
    | Some y -> [y]) |> List.flatten
let track: (t, cue_update Track.t) Lens.t =
  Lens.make
    ~get:(fun { cues; } ->
      (* Need to create a new one each time. *)
      let updates = List.map (fun cue -> Move cue) cues in
      Lens_array.create updates cue_of_update allocator)
    ~set:(fun cues _t ->
      let updates = Lens_array.inspect cues in
      let indices =
        updates
        |> list_filter_map (fun u ->
            match u with
            | Move cue -> Some (string_of_int cue.index, ())
            | _ -> None)
        |> Js.Dict.fromList
      in
      let next_index = ref 1 in
      let cues =
        updates
        |> List.map (fun u ->
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
