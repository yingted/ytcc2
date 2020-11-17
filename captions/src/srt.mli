type t
type raw
val text_codec: (string, raw Track.text) Codec.t
(* Track interface *)
val codec: (Encoding.bytes, raw Track.t) Codec.t
(* For when everything is UTF-8: *)
val string_codec: (string, raw Track.t) Codec.t

val ass_tag_codec: (string, Style.t) Codec.t

(* For pseudo-SRT encoding: *)
type raw_cue = {
  time: Track.seconds;
  text: string;
}
val to_raw_cues : 'raw Track.t -> raw_cue array
