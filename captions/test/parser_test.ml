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
