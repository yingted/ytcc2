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
let time_parser: Track.seconds Parser.t =
  Codec.make
    ~try_decode:(fun s ->
      match Scanf.sscanf s "%d:%02d:%02d,%03d%n"
        (fun hh mm ss mmm n ->
          (
            float_of_int (hh * 3600 + mm * 60 + ss) +. float_of_int mmm *. 0.001,
            String.sub s n (String.length s - n)))
      with
      | (secs, tail) -> Ok (secs, tail)
      | exception Scanf.Scan_failure err -> Error (Invalid_time err))
    ~encode:(fun (ss, tail) ->
      let (ss, mmm) = divmod ss 1. in
      let mmm = int_of_float (round (mmm *. 1000.)) in
      let (mm, ss) = idivmod ss 60 in
      let (hh, mm) = idivmod mm 60 in
      Printf.sprintf "%02d:%02d:%02d,%03d" hh mm ss mmm ^ tail)

(* Same as time_parser, but prefer to skip leading zeros and hours. *)
let short_time_parser: Track.seconds Parser.t =
  Codec.make
    ~try_decode:(fun s ->
      match Scanf.sscanf s "%d:%02d:%f%n"
        (fun hh mm ssmmm n ->
          (
            float_of_int (hh * 3600 + mm * 60) +. ssmmm,
            String.sub s n (String.length s - n)))
      with
      | (secs, tail) -> Ok (secs, tail)
      | exception Scanf.Scan_failure _err ->
      match Scanf.sscanf s "%d:%f%n"
        (fun mm ssmmm n ->
          (
            float_of_int (mm * 60) +. ssmmm,
            String.sub s n (String.length s - n)))
      with
      | (secs, tail) -> Ok (secs, tail)
      | exception Scanf.Scan_failure err -> Error (Invalid_time err))
    ~encode:(fun (ss, tail) ->
      let (ss, mmm) = divmod ss 1. in
      let mmm = int_of_float (round (mmm *. 100.)) in
      let (mm, ss) = idivmod ss 60 in
      let (hh, mm) = idivmod mm 60 in
      if hh = 0
      then Printf.sprintf "%d:%02d.%02d" mm ss mmm ^ tail
      else Printf.sprintf "%d:%02d:%02d.%02d" hh mm ss mmm ^ tail)

let with_raw p =
  Codec.make
    ~try_decode:(fun s ->
      match Codec.try_decode p s with
      | Ok (output, tail) ->
          let head = String.sub s 0 (String.length s - String.length tail) in
          Ok ((output, Some head), tail)
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

let merge_tokens (tokens : (Track.token * string option) list) : (Track.token * string option) list =
  tokens
  |> List.filter (fun (token, _raw) -> token != Track.Append "")
  |> merge (fun (prev_token, prev_raw) (token, raw) ->
      match prev_raw with
      | Some "\\n" | Some "\\N" | Some "\\h" -> None
      | _ ->
      match raw with
      | Some "\\n" | Some "\\N" | Some "\\h" -> None
      | _ ->
      let open Track in
      match prev_token, token with
      | Append a, Append b ->
          Some (Append (a ^ b), Option.map2 (^) prev_raw raw)
      | Set_style _a, Set_style b ->
          Some (Set_style b, Option.map2 (^) prev_raw raw)
      | Wait_until a, Wait_until b ->
          Some (Wait_until (max a b), Option.map2 (^) prev_raw raw)
      | _ -> None)

let split_tokens (tokens : (Track.token * string option) list) : (Track.token * string option) list =
  tokens
  |> List.map (fun (token, raw) ->
      match token with
      | Track.Append s when String.length s > 1 ->
          let a = [||] in
          s |> String.iter (fun c ->
            let _ = Js.Array.push (Track.Append (String.make 1 c), None) a in
            ());
          a |> Array.to_list
      | _ -> [(token, raw)])
  |> List.flatten

let text_parser: text Parser.t =
  let ( * ) = Parser.pair in
  let tag: (Style.t, string) result Parser.t =
    Parser.((expect "{\\" * (postprocess (easy_re0 "[^{}]*") (or_raw ass_tag_codec)) * expect "}") |> first |> second)
  in
  let special = Parser.(expect "\\" * easy_re0 "[nNh]" |> second) in
  Parser.Ocaml.(result
    (* ASS format *)
    (result tag special)
    (result Html.tag_parser Html.entity_parser))
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
          | Error (Error text) -> Append text)
      |> merge_tokens)
    ~encode:(fun xs ->
      (* The most recent style *)
      let last_set_style = ref Styles.empty in
      (* The most recent style that was used for Append *)
      let last_append_style = ref Styles.empty in
      (* List of text and styles, some of which have a raw repr. *)
      (* Preserve the raw reprs, but possibly add styles around them. *)
      xs
      |> split_tokens
      (* Ensure we close all our tags *)
      |> (fun x -> x @ [(Set_style Style.empty, None); (Append "", None)])
      |> List.map (fun ((x : Track.token), (raw : string option)) : ((_, _) result * string option) list ->
          (* Interpret the token, ignoring raw. *)
          match x with
          (* No karaoke support *)
          | Wait_until _t -> []
          | Set_style new_style ->
              last_set_style := Styles.of_style new_style;
              []
          | Append text ->
              let append_ops : (_ * string option) list = [(Error (Error text), raw)] in

              (* Diff the old and new styles. *)
              let old_open_tags = ref @@ Styles.open_tags !last_append_style in
              let close_tags = ref @@ Styles.close_tags !last_append_style in
              let open_tags = ref @@ Styles.open_tags !last_set_style in
              last_append_style := !last_set_style;

              (* Close tags are stored leaves first, open tags are roots first. *)
              (* Temporarily flip it to roots first so we can compress away the common roots. *)
              close_tags := List.rev !close_tags;
              while !open_tags != [] && !old_open_tags != [] && List.hd !open_tags = List.hd !old_open_tags do
                open_tags := List.tl !open_tags;
                old_open_tags := List.tl !old_open_tags;
                close_tags := List.tl !close_tags;
              done;
              close_tags := List.rev !close_tags;

              (* Change the style and append some text. *)
              (* Only one of the style change and append types should be here at any time. *)
              let wrap tags = tags |> List.map (fun tag -> (Error (Ok tag), None)) in
              (wrap !close_tags) @
              (* [(Error (Error ""), Some "(close)")] @ *)
              (wrap !open_tags) @
              (* [(Error (Error ""), Some "(open)")] @ *)
              append_ops
              (* @ [(Error (Error ""), Some "(append)")] *)
        )
      |> List.flatten)

let cue_parser: (int * cue) Parser.t =
  let remove_empty_lines_on_encode: (string, string) Codec.t =
    Codec.pure
      ~decode:Util.id
      ~encode:(fun s ->
        String.split_on_char '\n' s
        |> List.filter (fun s -> String.length s != 0)
        |> String.concat "\n") in
  Parser.(
    let ( * ) = pair in
    let term t x = first (x * t) in
    (* First line: sequence *)
    seq_parser *

    (* Second line: timestamps and position *)
    (((time_parser |> term (easy_expect_re ~re:"\\s*-->\\s*" ~default:" --> ")) * time_parser) |> term any_newline) *

    (* Rest of the lines: text *)
    ((* First, join the lines together: *)
    easy_re0 ".+"
    |> separated ~sep:any_newline
    |> serialized
    |> (Util.flip postprocess) remove_empty_lines_on_encode
    (* Then, parse the text through text_parser: *)
    |> (Util.flip postprocess) (Parser.at_end text_parser)
    (* Finally, add terminators and join the cues together: *)
    |> term any_newline_or_eof
    |> term any_newline_or_eof : raw Track.text Parser.t)
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
    (Parser.repeated cue_parser)
    (Codec.pure
      ~decode:(List.map (fun (_i, cue) -> cue))
      ~encode:(List.mapi (fun i cue -> (i + 1, cue))))

type t = cue list
let text_codec = Parser.at_end text_parser
let string_codec = Parser.at_end srt_parser
let codec = Codec.stack Encoding.prefer_utf8 string_codec

type 'raw raw_cue = {
  time : Track.seconds;
  text : string;
  raw : 'raw Track.cue option;
}
let to_raw_cues t =
  let cues =
    t
    |> List.sort (fun (a : _ Track.cue) (b : _ Track.cue) -> compare a.start b.start)
    |> Array.of_list
  in
  let raw_cues = [||] in
  for i = 0 to Array.length cues - 1 do
    let cue = cues.(i) in
    let ({ start; end_; text } : _ Track.cue) = cue in
    let text = text |> Codec.encode text_codec in
    let _ = Js.Array.push { time = start; text; raw = Some cue; } raw_cues in
    (* Skip clearing the window if we can: *)
    if i + 1 >= Array.length cues then () else
    if end_ = cues.(i + 1).start then () else
    let _ = Js.Array.push { time = end_; text = ""; raw = None; } raw_cues in
    ()
  done;
  raw_cues

let max_cue_seconds = 366 * 24 * 3600 |> float_of_int
let from_raw_cues (raw_cues : 'raw raw_cue array) : 'raw Track.t =
  let cues = [||] in
  for i = 0 to Array.length raw_cues - 1 do
    let { time; text; raw; } = raw_cues.(i) in

    (* Empty captions are already translated into clears. *)
    if text = "" then () else

    (* Raw cues are passed straight through: *)
    match raw with
    | Some cue ->
        let _ = Js.Array.push cue cues in
        ()
    | None ->

    (* Cue with implicit end time: *)
    let _ = Js.Array.push ({
      start = time;
      end_ =
        if i + 1 < Array.length raw_cues
        then raw_cues.(i + 1).time
        else time +. max_cue_seconds;
      text = Codec.decode_exn text_codec text;
    } : 'raw Track.cue) cues in
    ()
  done;
  cues |> Array.to_list

let short_time_space =
  let ( * ) = Parser.pair in
  Parser.(short_time_parser * easy_expect_re ~re:" ?" ~default:" " |> first)

let normalize t =
  to_raw_cues t
  |> Array.map (fun { time; text; raw = _; } ->
      let (time, text) =
        Codec.encode short_time_space (time, text)
        |> Codec.decode_exn short_time_space
      in
      let text = [%raw {|text => text.replace(/^(\d+:\d)/mg, " $1")|}] text in
      { time; text; raw = None; })
  |> from_raw_cues
