type ('s, 'f) t = {
  get: 's -> 'f;
  set: 'f -> 's -> 's;
}

let make ~get ~set = { get; set; }

let get t = t.get
let set t = t.set

(* let id = make ~get:(fun x -> x) ~set:(fun v _ -> v) *)
let id = {
  get = (fun x -> x);
  set = (fun v _ -> v);
}
let compose (inner: ('i, 'i2) t) (outer: ('o, 'i) t): ('o, 'i2) t = make
  ~get:(fun s -> s |> get outer |> get inner)
  ~set:(fun a s -> set outer (set inner a (get outer s)) s)
(* let readonly t = make ~get:(get t) ~set:(fun _ a -> a) *)

let pair a b =
  make
    ~get:(fun (xa, xb) -> (get a xa, get b xb))
    ~set:(fun (va, vb) (xa, xb) -> (set a va xa, set b vb xb))

let both a b =
  make
    ~get:(fun x -> (get a x, get b x))
    ~set:(fun (va, vb) x -> x |> set a va |> set b vb)

(* let imap ~get ~set t = *)
(*   make *)
(*     ~get:(fun x -> t.get x |> get) *)
(*     ~set:(fun v x -> t.set (set v) x) *)

(* let omap ~get ~set t = *)
(*   make *)
(*     ~get:(fun x -> t.get (get x)) *)
(*     ~set:(fun v x -> t.set v (get x) |> set) *)

let eval f a = get (f id) a
let ieval f a b' =
  let lb = f id in
  set lb b' a
