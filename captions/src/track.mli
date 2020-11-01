(* This interface is for any captions track to implement. *)

(* Time, relative to the start of the video *)
type seconds = float

(* Captions formats are pretty nasty, with hierarchical styles. *)
(* I've used the analogy of terminal emulators here, where each cue is *)
(* the output of a program that outputted some text and escape sequences. *)
type 't token =
  (* Append some text. *)
  | Append of string
  (* Change the text style. *)
  | Set_style of Style.t
  (* Wait until this time (karaoke) *)
  (* | Wait_until of seconds *)
  (* Window resize/move/restyle *)
  (* | Reconfigure_window of cea708_window *)
  (* Unrecognized data *)
  | Unrecognized of 't

(* Text that shares the same window. *)
type 't cue = {
  start: seconds;
  end_: seconds;
  text: 't token list;
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
