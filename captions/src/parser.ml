type 'a t = (string, 'a * string) Codec.t

exception Bad_parse_expected_prefix_but_got of string * string

let postprocess p c =
  Codec.stack p
    (Codec.make
      ~try_decode:(fun (output1, tail) ->
        match Codec.try_decode c output1 with
        | Ok output2 -> Ok (output2, tail)
        | Error e -> Error e)
      ~encode:(fun (output2, tail) ->
        (Codec.encode c output2, tail)))
let pair p1 p2 =
  Codec.stack p1
    (Codec.make
      ~try_decode:(fun (output1, tail1) ->
        match Codec.try_decode p2 tail1 with
        | Ok (output2, tail2) -> Ok ((output1, output2), tail2)
        | Error e -> Error e)
      ~encode:(fun ((output1, output2), tail2) ->
        (output1, Codec.encode p2 (output2, tail2))))

let ignore v t =
  postprocess t
    (Codec.pure ~decode:(Util.const ()) ~encode:(Util.const v))

type matches = string Js.Nullable.t array
exception Assertion_error
let regexMatchPrefix: Js.Re.t -> string -> matches Js.Nullable.t = [%raw {|
  function regexMatchPrefix(re, input) {
    re.lastIndex = 0;
    var m = re.exec(input);
    return m !== null && m.index === 0 ? m : null;
  }
|}]
exception No_match of Js.Re.t * string
let string_of_match match_: string =
  let s = Js.Array.unsafe_get match_ 0 in
  match Js.Nullable.toOption s with
  (* Match 0 always exists *)
  | None -> raise Assertion_error
  | Some s -> s
exception Regexp_missing_g of Js.Re.t
let re_match re: matches t =
  Codec.make
    ~try_decode:(fun input ->
      if Js.Re.flags re |> Js.String.indexOf "g" = -1
      then raise (Regexp_missing_g re)
      else
        match regexMatchPrefix re input |> Js.Nullable.toOption with
        | Some match_ ->
            Ok (match_, Js.String.substringToEnd input ~from:(Js.Re.lastIndex re))
        | None -> Error (No_match (re, input)))
    ~encode:(fun (match_, tail) ->
      string_of_match match_
      |> Js.String.concat tail)

let re_match0 re: string t =
  postprocess (re_match re)
    (Codec.pure
      ~decode:string_of_match
      ~encode:(fun s -> [|(Js.Nullable.return s)|]))

let re_expect re s =
  postprocess (re_match0 re) (Codec.assume () s)

let id: string t =
  Codec.pure
    ~decode:(fun s -> (s, ""))
    ~encode:(fun (s, tail) -> s ^ tail)

let empty: unit t =
  Codec.pure
    ~decode:(fun s -> ((), s))
    ~encode:(fun ((), tail) -> tail)

let text_int =
  postprocess
    (re_match0 (Js.Re.fromStringWithFlags "^(?:\\d+)" ~flags:"g"))
    Codec.text_int

let text_float =
  postprocess
    (re_match0 (Js.Re.fromStringWithFlags "^(?:\\d+(?:\\.\\d*)?|\\.\\d+)" ~flags:"g"))
    Codec.text_float

let expect prefix =
  Codec.make
    ~try_decode:(fun input ->
      let prefixLen = Js.String.length prefix in
      if Js.String.substring input ~from:0 ~to_:prefixLen = prefix
      then Ok ((), Js.String.substringToEnd input ~from:prefixLen)
      else Error (Bad_parse_expected_prefix_but_got (prefix, input)))
    ~encode:(fun ((), tail) -> Js.String.concat tail prefix)

let try_catch (a: 'a t) (b: 'b t): ('a, 'b) result t =
  Codec.make
    ~try_decode:(fun input ->
      match Codec.try_decode a input with
      | Ok (a_, tail) -> Ok (Ok a_, tail)
      | Error _a_error ->
          match Codec.try_decode b input with
          | Ok (b_, tail) -> Ok (Error b_, tail)
          | Error b_error -> Error b_error)
    ~encode:(fun (a_or_b, tail) ->
      match a_or_b with
      | Ok a_ -> Codec.encode a (a_, tail)
      | Error b_ -> Codec.encode b (b_, tail))

let optional (a: 'a t): 'a option t =
  postprocess (try_catch a (expect ""))
    (Codec.pure
      ~decode:(fun a_or_unit ->
        match a_or_unit with
        | Ok a_ -> Some a_
        | Error () -> None)
      ~encode:(fun a_opt ->
        match a_opt with
        | Some a_ -> Ok a_
        | None -> Error ()))

(* Repeated field using explicit loop *)
let repeated (a: 'a t): 'a list t =
  Codec.make
    ~try_decode:(fun input ->
      let outputs: 'a list ref = ref [] in
      let rec loop input =
        match Codec.try_decode a input with
        | Error _ -> ([], input)
        | Ok (output, tail) ->
            outputs := output :: !outputs;
            loop tail in
      let (rev_outputs, tail) = loop input in
      Ok (List.rev rev_outputs, tail))
    ~encode:(fun (items, tail) ->
      let output = ref tail in
      let rev_items: 'a list = List.rev items in
      let rec loop rev_items =
        match rev_items with
        | [] -> ()
        | item :: rev_items ->
            output := Codec.encode a (item, !output);
            loop rev_items in
      loop rev_items;
      !output)

let first a =
  postprocess a (Codec.pure
    ~decode:(fun (a, ()) -> a)
    ~encode:(fun a -> (a, ())))
let second a =
  postprocess a (Codec.pure
    ~decode:(fun ((), a) -> a)
    ~encode:(fun a -> ((), a)))

exception Trailing_garbage of string

let serialized (t: 'a t): string t =
  postprocess t (Codec.pure
    ~decode:(fun (x: 'a) -> Codec.encode t (x, ""))
    ~encode:(fun x ->
      let (y, tail) = x
      |> Codec.try_decode t
      |> Result.ok_exn in
      match tail with
      | "" -> y
      | _ -> raise (Trailing_garbage tail)))

let at_end a =
  Codec.stack a (Codec.make
    ~try_decode:(fun (output, tail) ->
      match tail with
      | "" -> Ok output
      | _ -> Error (Trailing_garbage tail))
    ~encode:(fun a -> (a, "")))

let easy_re0 pat: string t =
  re_match0 (Js.Re.fromStringWithFlags ("^(?:" ^ pat ^ ")") ~flags:"g")
let easy_expect_re0 ~re ~default =
  re_expect (Js.Re.fromStringWithFlags ("^(?:" ^ re ^ ")") ~flags:"g") default
let any_newline: unit t =
  easy_expect_re0 ~re:"\\r\\n?|\\n" ~default:"\n"
let any_newline_or_eof: unit t =
  easy_expect_re0 ~re:"\\r\\n?|\\n|$" ~default:"\n"

module Text = struct
  let i = text_int
  let f = text_float
end
module Ocaml = struct
  let pair = pair
  let tuple3 (a: 'a t) (b: 'b t) (c: 'c t): ('a * 'b * 'c) t =
    postprocess
      (c |> pair b |> pair a)
      (Codec.pure
        ~decode:(fun (a, (b, c)) -> (a, b, c))
        ~encode:(fun (a, b, c) -> (a, (b, c))))
  let tuple4 a b c d =
    postprocess
      (d |> pair c |> pair b |> pair a)
      (Codec.pure
        ~decode:(fun (a, (b, (c, d))) -> (a, b, c, d))
        ~encode:(fun (a, b, c, d) -> (a, (b, (c, d)))))
  let tuple5 a b c d e =
    postprocess
      (e |> pair d |> pair c |> pair b |> pair a)
      (Codec.pure
        ~decode:(fun (a, (b, (c, (d, e)))) -> (a, b, c, d, e))
        ~encode:(fun (a, b, c, d, e) -> (a, (b, (c, (d, e))))))
  let tuple6 a b c d e f =
    postprocess
      (f |> pair e |> pair d |> pair c |> pair b |> pair a)
      (Codec.pure
        ~decode:(fun (a, (b, (c, (d, (e, f))))) -> (a, b, c, d, e, f))
        ~encode:(fun (a, b, c, d, e, f) -> (a, (b, (c, (d, (e, f)))))))
  let tuple7 a b c d e f g =
    postprocess
      (g |> pair f |> pair e |> pair d |> pair c |> pair b |> pair a)
      (Codec.pure
        ~decode:(fun (a, (b, (c, (d, (e, (f, g)))))) -> (a, b, c, d, e, f, g))
        ~encode:(fun (a, b, c, d, e, f, g) -> (a, (b, (c, (d, (e, (f, g))))))))
  let result = try_catch
  let option = optional
  let list = repeated
  let unit = ignore
  let map ~decode ~encode a = postprocess a (Codec.pure ~decode ~encode)
end
