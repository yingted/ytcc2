(**
   Copyright 2020 Google LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*)

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
type 'raw raw_cue = {
  time : Track.seconds;
  text : string;
  raw : 'raw Track.cue option;
}
(* Convert to a JS array of raw cues. *)
val to_raw_cues : raw Track.t -> raw raw_cue array
(* Convert back from JS array of raw cues, preferring raw over time and text. *)
val from_raw_cues : raw raw_cue array -> raw Track.t
(* Parse "0:01.00 a" to (1.0, "a"): *)
val short_time_space : Track.seconds Parser.t
