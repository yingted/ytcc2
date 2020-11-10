type raw
val codec: (Encoding.bytes, raw Track.t) Codec.t
(* For when everything is UTF-8: *)
val string_codec: (string, raw Track.t) Codec.t
