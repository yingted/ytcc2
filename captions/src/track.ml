(* This interface is for any captions track to implement. *)

(* Time, relative to the start of the video *)
type seconds = float

(* Captions formats are pretty nasty, with hierarchical styles. *)
(* I've used the analogy of terminal emulators here, where each cue is *)
(* the output of a program that outputted some text and escape sequences. *)
type token =
  (* Append some text. *)
  | Append of string
  (* Change the text style. *)
  | Set_style of Style.t
  (* (1* Wait until this time (karaoke) *1) *)
  (* | Wait_until of seconds *)
  (* (1* Window resize/move/restyle *1) *)
  (* | Reconfigure_window of cea708_window *)

(* Text that shares the same window. *)
(* 'raw is an optional raw format, preferred for serialization *)
type 'raw text = (token * 'raw option) list
type 'raw cue = {
  start: seconds;
  end_: seconds;
  text: 'raw text;
}

type 'raw t = 'raw cue list

(* Codecs should implement this signature *)
module type S = sig
  val codec: (string, 'raw t) Codec.t
end
