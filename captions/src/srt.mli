type t
type text
val text_codec: (string, text) Codec.t
val codec: (Encoding.bytes, t) Codec.t

type ass_tag
val ass_tag_codec: (string, (Style.t, ass_tag) result) Codec.t

(* Track interface *)
type cue_update
type nonstandard_tag
val track: (t, (cue_update, nonstandard_tag) Track.t) Lens.t
