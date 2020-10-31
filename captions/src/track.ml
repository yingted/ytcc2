type seconds = float
type 't token =
  | Text of string
  | Style of Style.v
  | Unrecognized of 't
type 't text = 't token list
type 't cue = {
  start: seconds;
  end_: seconds;
  text: 't text;
}
let allocator (): (('repr, 't cue) Allocator.update_copying, Allocator.copy) Allocator.t =
  Allocator.pure_copying { start = 0.; end_ = 0.; text = []; }
(* Copying is needed for cases like SRT editing. *)
(* It copies all internal metadata but generate a new cue id. *)
type ('repr, 't) t = ('repr, 't cue, Allocator.copy) Lens_array.t
type ('repr, 't) t_not_shadowed = ('repr, 't) t

(* Codecs should implement this signature *)
module type S = sig
  type t
  val codec: (string, t) Codec.t
  val track: (t, ('a, 'b) t_not_shadowed) Lens.t
end
