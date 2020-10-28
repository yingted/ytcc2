type t
type text
val text_codec: (string, text) Codec.t
val codec: (Encoding.bytes, t) Codec.t

(* Track interface *)
type cue_update
val track: (t, cue_update Track.t) Lens.t
