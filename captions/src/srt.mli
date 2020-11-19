type t
type raw
val text_codec: (string, raw Track.text) Codec.t
(* Track interface *)
val codec: (Encoding.bytes, raw Track.t) Codec.t
(* For when everything is UTF-8: *)
val string_codec: (string, raw Track.t) Codec.t

val ass_tag_codec: (string, Style.t) Codec.t

(* For pseudo-SRT encoding: *)
val short_time_parser : Track.seconds Parser.t
type raw_cue = {
  time: Track.seconds;
  text: string;
}
val to_raw_cues : raw Track.t -> raw_cue array
val from_raw_cues : raw_cue array -> raw Track.t
(* Parse "0:01.00 a" to (1.0, "a"): *)
val short_time_space : Track.seconds Parser.t
