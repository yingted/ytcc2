type seconds = Track.seconds
type ass_tag = string

(* Parsing almost-HTML. *)
(* Tags don't have to be correctly nested. *)
module Html = struct
  type attrs = string Js.Dict.t
  type tag =
    (* All strings got lowercased *)
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
      postprocess
        (re_match (Js.Re.fromStringWithFlags ("^(?:" ^ pat ^ ")") ~flags:"g"))
        (Codec.pure
          ~decode:(fun m -> Js.Array.unsafe_get m 1 |> Js.Nullable.toOption |> Option.value_exn)
          ~encode:(fun s -> [|(Js.Nullable.return s)|])) *
      expect right
      |> first |> second)

  let attrs_parser: (string * string) Parser.t =
    let ( * ) = Parser.pair in
    (* Attribute name *)
    Parser.(easy_re0 "[^\\t\\n\\f />\"'=]+" * Ocaml.option (
      (* Attribute value *)
      (* We're not decoding HTML entities - too much work *)
      expect "\\s*=\\s*" * (
        (* Unquoted *)
        fallback
          (quoted_parser "\"" "[^\"]*" "\"")
          (fallback
            (quoted_parser "" "[^ \\n\\r\\f\\t\"'=<>`]+" "")
            (quoted_parser "'" "[^']*" "'")))
      |> second) |> postprocess)
      (Codec.pure
        ~decode:(fun (name, value) -> (name, Option.value ~default:"" value))
        ~encode:(fun (name, value) -> (name, Some value)))

  let open_parser: (string * string Js.Dict.t) Parser.t =
    let ( * ) = Parser.pair in
    Parser.(expect "<" * tag_name_parser * Ocaml.list (pair (easy_expect_re ~default:" " ~re:"\\s*") attrs_parser |> second) * expect ">" |> first |> postprocess)
      (Codec.pure
        ~decode:(fun (((), tag_name), attrs) ->
          (tag_name, Js.Dict.fromList attrs))
        ~encode:(fun (tag_name, attrs) ->
          (((), tag_name), Js.Dict.entries attrs |> Array.to_list)))

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

  (* type style = attrs Js.Array.t Js.Dict.t *)
  let default_style () = Js.Dict.fromList []

  let obj_assign_many: 'a Js.Dict.t Js.Array.t -> 'a Js.Dict.t =
    [%raw {|
      function obj_assign_many(args) {
        return Object.assign({}, ...args);
      }
    |}]

  let apply style tag =
    match tag with
    | Open (name, attrs) ->
        let a = Js.Dict.get style name
          |> Option.value ~default:[||]
        in
        let _ = Js.Array.push attrs a in
        Js.Dict.set style name a;
        obj_assign_many a
    | Close name ->
        let a = Js.Dict.get style name
          |> Option.value ~default:[||]
        in
        if Array.length a > 0
        then let _ = Js.Array.pop a in ();
        else ();
        obj_assign_many a
end
(* Unrecognized tags *)
type nonstandard_tag =
  | Ass of ass_tag
  | Html of Html.tag
type token = nonstandard_tag Track.token
type text = token list
type super_cue = nonstandard_tag Track.cue
type cue = {
  super: super_cue;
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

let ass_tag_codec: (string, (Style.t, ass_tag) result) Codec.t =
  (* TODO *)
  Codec.pure
    ~decode:(fun s -> Error s)
    ~encode:(fun x ->
      match x with
      | Ok _style -> failwith ""
      | Error tag -> tag)

exception Assertion_error

let text_parser: text Parser.t =
  let ( * ) = Parser.pair in
  let tag = Parser.((expect "{\\" * (postprocess (easy_re0 "[^{}]*") ass_tag_codec) * expect "}") |> first |> second) in
  let special = Parser.(expect "\\" * easy_re0 "[nNh]" |> second) in
  (* Fallback: don't match into a tag *)
  let plain = Parser.(easy_re0 "(?:(?!\\{\\\\|\\\\[nNh]|</?[a-zA-Z])(?:[^a]|a))+|[^a]|a") in
  Parser.Ocaml.(result
    (* ASS format *)
    (result tag special)
    (result Html.tag_parser plain))
  |> Parser.Ocaml.list
  |> Parser.Ocaml.map
    ~decode:(fun tokens ->
      let html_style = Html.default_style () in
      tokens
      |> List.map (fun (token: _): token ->
          match token with
          | Ok (Ok (Ok style)) -> Style style
          | Ok (Ok (Error ass)) -> Unrecognized (Ass ass)
          | Ok (Error special) ->
              (match special with
              | "N" -> Text "\n"
              | "h" -> Text "\xa0"
              (* TODO: make it \n if we are in mode \q2. *)
              | "n" -> Text " "
              | _ -> raise Assertion_error)
          | Error (Ok html) ->
              (* TODO: parse this properly *)
              let _style = Html.apply html_style html in
              Unrecognized (Html html)
          | Error (Error text) -> Text text))
    ~encode:(fun xs ->
      xs
      |> List.map (fun (x: token) ->
          let _html_style = Html.default_style () in
          match x with
          (* TODO: decide between ASS and HTML style *)
          | Style style -> Ok (Ok (Ok style))
          | Unrecognized (Ass ass) -> Ok (Ok (Error ass))
          | Unrecognized (Html html) -> Error (Ok html)
          | Text text -> Error (Error text)
          ))

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
    (term time_parser (easy_expect_re ~re:"\\s*-->\\s*" ~default:" --> ")) * time_parser *
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
      { super = { start; end_; text; }; index; position; })
    ~encode:(fun { super = { start; end_; text; }; index; position; } ->
      ((((index, start), end_), position), text))
  

let srt_parser: track Parser.t =
  Parser.postprocess
    (Parser.repeated (cue_parser))
    (Codec.pure ~decode:(fun cues -> { cues }) ~encode:(fun track -> track.cues))

type t = track
let text_codec = Parser.at_end text_parser
let codec = Codec.stack Encoding.prefer_utf8 (Parser.at_end srt_parser)

let track_cue =
  (* Ahh, we can't generate this yet. *)
  Lens.make
    ~get:(fun cue -> cue.super)
    ~set:(fun super cue -> { cue with super; })

(* 4 types of updates: delete + default/copy/move constructors *)
type cue_update = (cue, super_cue) Allocator.update_copying
let cue_of_update = Allocator.pure_copying_lens track_cue
let allocator = Track.allocator ()
let list_filter_map f l =
  l |> List.map (fun x ->
    match f x with
    | None -> []
    | Some y -> [y]) |> List.flatten
let track: (t, (cue_update, nonstandard_tag) Track.t) Lens.t =
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
      let make_index () =
        while Option.is_some (Js.Dict.get indices (string_of_int !next_index)) do
          next_index := !next_index + 1;
        done;
        Js.Dict.set indices (string_of_int !next_index) ();
        !next_index
      in
      let cues =
        updates
        |> List.map (fun (u: cue_update) ->
            match u with
            | Move cue -> cue
            | New super -> { super; position = None; index = make_index (); }
            | Copy { super; position; _; } -> { super; position; index = make_index (); })
      in
      { cues })
