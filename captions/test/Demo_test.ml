open Jest
open Expect

let _ =
describe "suite" (fun () ->
  test "hello test" (fun () ->
    expect @@
      Demo.square 2
      |> toEqual 4);
);
