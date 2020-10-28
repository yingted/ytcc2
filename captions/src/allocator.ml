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

let new_ t = t.new_ ()
let copy t = Option.value_exn t.copy
let delete t = t.delete
