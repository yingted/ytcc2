type seconds = float
type text = string
type cue = {
  start: seconds;
  end_: seconds;
  text: text;
}
(* Copying is needed for cases like SRT editing. *)
(* It copies all internal metadata but generate a new cue id. *)
type 'repr t = ('repr, cue, Allocator.copy) Lens_array.t
type 'repr t_not_shadowed = 'repr t

(* Codecs should implement this signature *)
module type S = sig
  type t
  val codec: (string, t) Codec.t
  val track: (t, 'a t_not_shadowed) Lens.t
end
