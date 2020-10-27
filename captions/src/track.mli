type seconds = float
type text = string
type cue = {
  start: seconds;
  end_: seconds;
  text: text;
}
type t = cue list

(* Codecs should implement this signature *)
module type S = sig
  type t
  val codec: (string, t) Codec.t
  val track: (t, (* Track.t *) cue list) Lens.t
end
