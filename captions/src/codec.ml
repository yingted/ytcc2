exception Bad_parse_int of string
exception Bad_parse_float of string
exception Bad_parse_unexpected
exception Bad_parse_expected_but_got of string * string

type ('co, 'dec) t = {
  try_decode: 'co -> ('dec, exn) result;
  encode: 'dec -> 'co;
}

let try_decode t co = t.try_decode co
let encode t dec = t.encode dec

let parseInt: string -> int option = [%raw {|
    function(str) {
      var x = parseInt(str);
      return isNaN(x) ? undefined : x;
    }
  |}]
let parseFloat: string -> float option = [%raw {|
    function(str) {
      var x = parseFloat(str);
      return isNaN(x) ? undefined : x;
    }
  |}]

let id = {
  try_decode = (fun x -> Ok x);
  encode = (fun x -> x);
}

let text_int = {
  try_decode = (fun s ->
    match parseInt s with
    | Some x -> Ok x
    | None -> Error (Bad_parse_int s));
  encode = Js.Int.toString;
}

let text_float = {
  try_decode = (fun s ->
    match parseFloat s with
    | Some x -> Ok x
    | None -> Error (Bad_parse_float s));
  encode = Js.Float.toString;
}

let expect x = {
  try_decode = (fun s ->
    if s == x
    then Ok ()
    else Error (Bad_parse_unexpected));
  encode = (fun () -> x);
}

let expect_string x = {
  try_decode = (fun s ->
    if s == x
    then Ok ()
    else Error (Bad_parse_expected_but_got (x, s)));
  encode = (fun () -> x);
}
