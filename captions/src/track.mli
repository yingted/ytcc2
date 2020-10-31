(* Time, relative to the start of the video *)
type seconds = float

(* Formatted text is a sequence of tags and text *)
(* The tag changes the formatting after it, and the text appends something *)
(* There may be adjacent text elements in the list. *)
(* Tokens are trivially copyable, no Lens_array.t needed. *)
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

(* This allocator is pure, but for some reason I need unit here *)
val allocator: unit -> (('repr, 't cue) Allocator.update_copying, Allocator.copy) Allocator.t
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