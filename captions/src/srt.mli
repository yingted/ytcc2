type t
type text
val text_codec: (string, text) Codec.t
val codec: (Encoding.bytes, t) Codec.t

(* Track interface *)
val track: (t, Track.t) Lens.t
