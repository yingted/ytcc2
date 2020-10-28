type no_copy
type copy
type ('a, +'mode) t = {
  new_: unit -> 'a;
  copy: ('a -> 'a) option;
  delete: 'a -> unit;
}

let create ~new_ ~delete =
  { new_; delete; copy = None; }

let create_copying ~new_ ~delete ~copy =
  { new_; delete; copy = Some copy; }

type ('a, 'b) update =
  | Move of 'a
  | New of 'b
let pure_lens lens =
  Lens.make
    ~get:(fun x ->
      match x with
      | Move cur -> Lens.get lens cur
      | New cur -> cur)
    ~set:(fun v x ->
      match x with
      | Move cur -> Move (Lens.set lens v cur)
      | New _cur -> New v)
let pure default: (_ update, no_copy) t = create
  ~new_:(fun () -> New default)
  ~delete:(fun _x -> ())

type ('a, 'b) update_copying =
  | Move of 'a
  | New of 'b
  | Copy of 'a
let pure_copying_lens lens =
  Lens.make
    ~get:(fun x ->
      match x with
      | Move cur -> Lens.get lens cur
      | New cur -> cur
      | Copy cur -> Lens.get lens cur)
    ~set:(fun v x ->
      match x with
      | Move cur -> Move (Lens.set lens v cur)
      | New _cur -> New v
      | Copy cur -> Copy (Lens.set lens v cur))
let pure_copying default = create_copying
  ~new_:(fun () -> New default)
  ~delete:(fun _x -> ())
  ~copy:(fun x ->
    match x with
    | Move cur -> Copy cur
    | other -> other)

let new_ t = t.new_ ()
let copy t = Option.value_exn t.copy
let delete t = t.delete
