open Jest
open Expect

let _ =
describe "parser" (fun () ->
  test "text_int" (fun () ->
    Codec.try_decode
      Parser.text_int
      "123\n456"
    |> expect
    |> toEqual (Ok (123, "\n456")));

  test "text_int any_newline" (fun () ->
    Codec.try_decode
      Parser.(first (pair text_int any_newline))
      "123\n456"
    |> expect
    |> toEqual (Ok (123, "456")));

  test "list (text_int any_newline)" (fun () ->
    Codec.try_decode
      Parser.(repeated (first (pair text_int any_newline)))
      "123\n456\n789"
    |> expect
    |> toEqual (Ok ([123; 456], "789")));
);
