open Jest
open Expect

module M = struct
  type file = {
    path: string;
    size: int;
  }
end
open M

(* Derived format *)
module M_lens = struct
  (* Unpacked layout, a record of lenses *)
  type 'a file = {
    path: ('a, string) Lens.t;
    size: ('a, int) Lens.t;
  }

  (* Vanilla lenses *)
  let (file: M.file file) = {
    path = Lens.make ~get:(fun (x: M.file) -> x.path) ~set:(fun v x -> { x with path = v });
    size = Lens.make ~get:(fun (x: M.file) -> x.size) ~set:(fun v x -> { x with size = v });
  }

  (* Pack a record of lenses to a lens of records *)
  let pack_file (x: 'a file): ('a, M.file) Lens.t =
    let { path; size; } = x in
    Lens.make
      ~get:(fun x -> ({
        path = Lens.get path x;
        size = Lens.get size x;
      }: M.file))
      ~set:(fun v x ->
        x
        |> Lens.set path v.path
        |> Lens.set size v.size
      )

  (* Unpack a lens of records to a record of lenses *)
  let unpack_file (l: ('a, M.file) Lens.t): 'a file =
    let get = Lens.get l in
    let set = Lens.set l in
    {
      path = Lens.make ~get:(fun x -> (get x).path) ~set:(fun v x -> set ({ (get x) with path = v }) x);
      size = Lens.make ~get:(fun x -> (get x).size) ~set:(fun v x -> set ({ (get x) with size = v }) x);
    }
end


let _ =
describe "lens composition" (fun () ->
  test "compose" (fun () ->
    let sign = Lens.make ~get:(fun x -> x < 0) ~set:(fun v x -> if v != (x < 0) then -1 - x else x) in
    let not = Lens.make ~get:(fun x -> x != true) ~set:(fun v _ -> v != true) in
    let nsign = Lens.compose not sign in
    let pnsign = Lens.both sign nsign in
    let signs = Lens.pair sign nsign in

    let sign_n10 = Lens.get sign (-10) in
    let sign_10 = Lens.get sign (Lens.set sign true (-10)) in
    let nsign_10 = Lens.get nsign (Lens.set nsign false (-10)) in
    let pnsign_10 = Lens.get pnsign (-10) in
    let signs_10_10 = Lens.get signs (10, 10) in

    let set_pnsign_0 = Lens.set pnsign (true, true) 0 in
    let set_signs_0_0 = Lens.set signs (true, true) (0, 0) in

    expect @@
      (sign_n10, sign_10, nsign_10, pnsign_10, signs_10_10, set_pnsign_0, set_signs_0_0)
      |> toEqual (true, true, false, (true, false), (false, true), 0, (-1, 0)));

  test "packed" (fun () ->
    let l = M_lens.pack_file M_lens.file in
    let (f: M.file) = { path = "a"; size = 1; } in
    expect @@
      Lens.set l { path = "b"; size = 2; } f
      |> toEqual { path = "b"; size = 2; });

  test "unpacked" (fun () ->
    let { path; size; } = M_lens.file in
    let (f: M.file) = { path = "a"; size = 1; } in
    f
    |> Lens.set path "b"
    |> Lens.set size 2
    |> expect
    |> toEqual { path = "b"; size = 2; });

  test "model-view-presenter" (fun () ->
    (* Fake data to bind *)
    let (model: M.file) = { path = "a"; size = 1; } in

    (* User-defined data binding function *)
    let render (f: ('a, M.file) Lens.t): ('a, string * int) Lens.t =
      let { path; size; } = M_lens.unpack_file f in
      (Lens.both path size) in

    (* Forward binding: *)
    let view = Lens.eval render model in

    (* User modified the view, reverse binding: *)
    let view' = ("b", 2) in
    let model' = Lens.ieval render model view' in

    expect @@
      (view, model')
      |> toEqual (("a", 1), { path = "b"; size = 2; }));
);
