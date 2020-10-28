type t
type text
val text_codec: (string, text) Codec.t
val codec: (Encoding.bytes, t) Codec.t

(* Track interface *)
type cue_update
type nonstandard_tag
val track: (t, (cue_update, nonstandard_tag) Track.t) Lens.t
