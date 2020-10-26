type 'a t = (string, 'a * string) Codec.t

exception Bad_parse_expected_prefix_but_got of string * string

let stack_output p c =
  Codec.stack p
    (Codec.make
      ~try_decode:(fun (output1, tail) ->
        match Codec.try_decode c output1 with
        | Ok output2 -> Ok (output2, tail)
        | Error e -> Error e)
      ~encode:(fun (output2, tail) ->
        (Codec.encode c output2, tail)))
let stack_tail p1 p2 =
  Codec.stack p1
    (Codec.make
      ~try_decode:(fun (output1, tail1) ->
        match Codec.try_decode p2 tail1 with
        | Ok (output2, tail2) -> Ok ((output1, output2), tail2)
        | Error e -> Error e)
      ~encode:(fun ((output1, output2), tail2) ->
        (output1, Codec.encode p2 (output2, tail2))))

type matches = string Js.Nullable.t array
exception Assertion_error
let regexMatchPrefix: Js.Re.t -> string -> matches Js.Nullable.t = [%raw {|
  function regexMatchPrefix(re, input) {
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

let makeArray: unit -> 'a array = [%raw {|Array|}]

let re_match0 re: string t =
  stack_output (re_match re)
    (Codec.pure
      ~decode:string_of_match
      ~encode:(fun s ->
        let a = makeArray () in
        let _ = Js.Array.push(a, (Js.Nullable.return s)) in
        a))

let re_expect re s =
  stack_output (re_match0 re) (Codec.assume () s)

let text_int =
  stack_output
    (re_match0 (Js.Re.fromStringWithFlags "^(?:\\d+)" ~flags:"g"))
    Codec.text_int

let text_float =
  stack_output
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
  stack_output (try_catch a (expect ""))
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

let fst a =
  stack_output a (Codec.pure
    ~decode:(fun (a, ()) -> a)
    ~encode:(fun a -> (a, ())))
let snd a =
  stack_output a (Codec.pure
    ~decode:(fun ((), a) -> a)
    ~encode:(fun a -> ((), a)))