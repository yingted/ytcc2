(* Parsing almost-HTML. *)
(* Tags don't have to be correctly nested. *)
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

(* Usage: *)
(* let html_style = Html.default_style () in *)
(* let style = Html.apply html_style html in *)
(* ...use style *)
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
