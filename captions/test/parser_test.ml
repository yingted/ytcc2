open Jest
open Expect

let _ =
describe "parser" (fun () ->
  test "text_int" (fun () ->
    expect(Codec.try_decode Parser.text_int "123\n456")
    |> toEqual (Ok (123, "\n456")));

  test "text_int any_newline" (fun () ->
    expect(Codec.try_decode Parser.(first (pair text_int any_newline)) "123\n456")
    |> toEqual (Ok (123, "456")));
);
