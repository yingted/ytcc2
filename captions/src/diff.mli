module Const_diff (M : sig type t end) : Diff_intf.S with type value = M.t
