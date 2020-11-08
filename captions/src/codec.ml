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
let make ~try_decode ~encode = { try_decode; encode }
let pure ~decode ~encode = {
  try_decode = (fun s -> Ok (decode s));
  encode;
}
let assume dec co = {
  try_decode = Util.const (Ok dec);
  encode = Util.const co;
}

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

let json_of_string_exn : string -> Js.Types.obj_val = [%raw {|
  function json_of_string_exn(s) {
    return JSON.parse(s);
  }
|}]
let string_of_json : Js.Types.obj_val -> string = [%raw {|
  function string_of_json(obj) {
    return JSON.stringify(obj);
  }
|}]
let json = {
  try_decode = (fun s ->
    match json_of_string_exn s with
    | obj -> Ok obj
    | exception e ->
        Error e);
  encode = string_of_json;
}

let expect x = {
  try_decode = (fun s ->
    if s = x
    then Ok ()
    else Error (Bad_parse_unexpected));
  encode = (fun () -> x);
}

let expect_string x = {
  try_decode = (fun s ->
    if s = x
    then Ok ()
    else Error (Bad_parse_expected_but_got (x, s)));
  encode = (fun () -> x);
}

let stack lower higher = {
  try_decode = (fun s ->
    match lower.try_decode s with
    | Ok s2 -> higher.try_decode s2
    | Error e -> Error e);
  encode = (fun x -> lower.encode (higher.encode x));
}

let fallback a b = {
  try_decode = (fun s ->
    match a.try_decode s with
    | Ok x -> Ok x
    | Error _ -> b.try_decode s);
  encode = a.encode;
}
