type t
type raw
val text_codec: (string, raw Track.text) Codec.t
(* Track interface *)
val codec: (Encoding.bytes, raw Track.t) Codec.t

val ass_tag_codec: (string, Style.t) Codec.t
