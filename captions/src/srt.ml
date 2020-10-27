type seconds = float
type cue = {
  start: seconds;
  end_: seconds;
  text: string;
}
type track = {
  cues: cue list;
}

let newline: unit Parser.t = Parser.re_expect (Js.Re.fromStringWithFlags "^(?:\\r\\n?|\\n)" ~flags:"g") "\n"

(* let srt_cue_parser: cue Parser.t = *)
(*   let seq_parser = Codec.fst (Parser.stack_output Parser.text_int newline) in *)
  

(* let srt_parser: track Parser.t = *)
(*   Parser.stack_output *)
(*     (Parser.repeated (srt_cue_parser)) *)
(*     (Codec.pure ~decode:(fun cues -> { cues }) ~encode:(fun track -> track.cues)) *)
