(* Mutable arrays that are backed by an allocator, for when you need
 * to prevent aliasing. *)
type ('a, 'b, +'mode) t = {
  lens: ('a, 'b) Lens.t;
  alloc: ('a, 'mode) Allocator.t;
  data: 'a Js.Array.t;
}

let create initial lens alloc =
  let data = [||] in
  List.iter (fun x ->
    let _ = Js.Array.push x data in
    ()) initial;
  { lens; alloc; data; }

let length t = Js.Array.length t.data
let inspect t =
  List.init (length t) (Js.Array.unsafe_get t.data)

exception Index_out_of_range of int * int
let index_check (i: int) (l: int): unit =
  if 0 <= i && i < l
  then ()
  else raise (Index_out_of_range (i, l));
  ()

let unsafe_get t i =
  Js.Array.unsafe_get t.data i
  |> Lens.get t.lens
let unsafe_set t i v =
  let x = Js.Array.unsafe_get t.data i in
  let x = Lens.set t.lens v x in
  Js.Array.unsafe_set t.data i x
let get_exn t i =
  index_check i (length t);
  unsafe_get t i
let set_exn t i v =
  index_check i (length t);
  unsafe_set t i v


let emplace_exn t i =
  index_check i (length t + 1);
  let x = Allocator.new_ t.alloc in
  let _ = Js.Array.spliceInPlace ~pos:i ~remove:0 ~add:[|x|] t.data in
  Lens.get t.lens x

let swap_exn t i j =
  index_check i (length t);
  index_check j (length t);
  let x = Js.Array.unsafe_get t.data i in
  let y = Js.Array.unsafe_get t.data j in
  Js.Array.unsafe_set t.data i y;
  Js.Array.unsafe_set t.data j x;
  ()


let delete_exn t i =
  index_check i (length t);
  let ax = Js.Array.spliceInPlace ~pos:i ~remove:1 ~add:[||] t.data in
  Allocator.delete t.alloc (Js.Array.unsafe_get ax 0);
  ()

let insert_copy_exn t src dst =
  index_check dst (length t + 1);
  let x = Js.Array.unsafe_get t.data src |> Allocator.copy t.alloc in
  let _ = Js.Array.spliceInPlace ~pos:dst ~remove:0 ~add:[|x|] t.data in
  ()

let overwrite_copy_exn t src dst =
  index_check dst (length t);
  let x = Js.Array.unsafe_get t.data src |> Allocator.copy t.alloc in
  Js.Array.unsafe_get t.data dst |> Allocator.delete t.alloc;
  Js.Array.unsafe_set t.data dst x;
  ()

let to_list t =
  List.init (length t) (unsafe_get t)
