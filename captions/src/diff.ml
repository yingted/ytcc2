module Const_diff (M : sig type t end) = struct
  type value = M.t
  type t = value
  let diff v1 v2 = if v1 = v2 then None else Some v2
  let patch t _v = t
end
