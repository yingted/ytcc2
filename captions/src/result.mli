type ('ok, 'err) t = ('ok, 'err) result
val is_ok: ('ok, 'err) t -> bool
val return: 'a -> ('a, 'err) t
val bind: ('a, 'err) t -> ('a -> ('b, 'err) t) -> ('b, 'err) t
val map: ('a, 'err) t -> f:('a -> 'b) -> ('b, 'err) t
