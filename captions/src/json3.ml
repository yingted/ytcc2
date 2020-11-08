(* json3 format is (mostly) documented here: *)
(* https://medium.com/@js_jrod/the-first-complete-guide-to-youtube-captions-f886e06f7d9d *)
(* https://github.com/arcusmaximus/YTSubConverter/blob/3526b8f3bc85f3c78d68dcac9de1969b7c7098fc/ytt.ytt *)
(* json3 is pre-parsed and uses the two letter attribute name + full name, so fc -> fcForeColor *)
(* YouTube's captions.js also has both a WebVTT and json3 parser, so it's easy to see what everything means. *)
(* Rescript docs suggests Obj.magic here is mostly safe (unlike in C/C++): *)
(* https://rescript-lang.org/docs/manual/latest/json#parse *)
type pb_bool = int
let (pb_false, pb_true) = (0, 1)
type int_enum = int
type int_percent = int
type int_ms = int
type rgb = int
type alpha = int
type pen = {
  (* inherit *)
  pParentId : int option;
  bAttr : pb_bool option;
  iAttr : pb_bool option;
  uAttr : pb_bool option;
  ofOffset : int_enum option;
  szPenSize : int option;
  etEdgeType : int_enum option;
  ecEdgeColor : rgb option;
  fsFontStyle : int_enum option;
  fcForeColor : rgb option;
  foForeAlpha : alpha option;
  bcBackColor : rgb option;
  boBackAlpha : alpha option;
  (* Bitmask *)
  rbRuby : int option;
  hgHorizGroup : pb_bool option;
}
type win_style = {
  (* inherit *)
  wsParentId : int option;
  mhModeHint : int_enum option;
  juJustifCode : int_enum option;
  sdScrollDir : int_enum option;
  pdPaintDir : int_enum option;
  wfcWinFillColor : rgb option;
  wfoWinFillAlpha : alpha option;
}
type win_pos = {
  (* inherit *)
  wpParentId : int option;
  apPoint : int_enum option;
  ahHorPos : int_percent option;
  avVerPos : int_percent option;
  rcRows : int option;
  ccCols : int option;
}
type seg = {
  utf8 : string option;
  tOffsetMs : int_ms option;
  pPenId : int option;
}
(* A window or text: *)
type event = {
  (* shared fields: timing *)
  tStartMs : int_ms;
  dDurationMs : int_ms option;
  (* shared fields: window *)
  wpWinPosId : int option;
  wsWinStyleId : int option;
  rcRowCount : int option;
  ccColCount : int option;
  (* shared fields: format *)
  pPenId : int option;

  (* win fields *)
  id : int option;

  (* text fields *)
  wWinId : int option;
  (* In roll-up mode (2), if aAppend and utf8 = "\n", we skip. otherwise, append to the previous window (auto caps) *)
  (* default false *)
  aAppend : pb_bool option;
  segs : seg array;
}
type window = {
  style : win_style;
  pos : win_pos;
}
let empty_window = {
  style = {
    wsParentId = None;
    mhModeHint = None;
    juJustifCode = None;
    sdScrollDir = None;
    pdPaintDir = None;
    wfcWinFillColor = None;
    wfoWinFillAlpha = None;
  };
  pos = {
    wpParentId = None;
    apPoint = None;
    ahHorPos = None;
    avVerPos = None;
    rcRows = None;
    ccCols = None;
  };
}
type raw = window
type track = {
  wireMagic : string;  (* must be pb3 *)
  pens : pen array;
  wsWinStyles : win_style array;
  wpWinPositions : win_pos array;
  events : event array;
}

let inherit_inplace' : string -> 'a array -> unit =
  [%raw {|
    function inherit_inplace(parentAttr, tree) {
      for (let i = 0; i < tree.length; ++i) {
        // Worse case quadratic, in case of cycles, which are not allowed.
        let depth = 0;
        while (tree[i][parentAttr] !== undefined && depth++ < tree.length - 1) {
          let parent = tree[tree[i][parentAttr]];
          delete tree[i][parentAttr];
          tree[i] = Object.assign({}, parent, tree[i]);
        }
      }
    }
  |}]
let inherit_inplace parent_attr tree =
  inherit_inplace' parent_attr (Obj.magic tree)
let apply_window =
  [%raw {|
    function apply_window(w, e) {
      return Object.assign({}, w, e);
    }
  |}]

(* PB conversions *)
let font_size_of_int x = ((float_of_int x) -. 100.) /. 400. +. 1.
let int_of_font_size x = (x -. 1.) *. 400. +. 100. +. 0.5 |> int_of_float
let bool_of_pb (x : pb_bool) = x = pb_true
let pb_of_bool x = if x then pb_true else pb_false
(* Enums *)
let make_enum values =
  let enum_of_int x = values.(x) in
  let ivalues = values |> Array.to_list |> List.mapi (fun i x -> (x, i)) in
  let int_of_enum x = List.assoc x ivalues in
  (enum_of_int, int_of_enum)
let (font_style_of_int, int_of_font_style) = make_enum Style.Attr.[|
  Default_0;
  Mono_serif_1;
  Serif_2;
  Mono_sans_3;
  Sans_4;
  Casual_5;
  Cursive_6;
  Small_caps_7;
|]
let (font_script_of_int, int_of_font_script) = make_enum Style.Attr.[|
  Sub;
  Normal;
  Super;
|]
let (border_style_of_int, int_of_border_style) = make_enum Style.Attr.[|
  None_0;
  Raised_1;
  Depressed_2;
  Uniform_3;
  Left_drop_shadow_4;
  Right_drop_shadow_5;
|]
let alpha_of_int x =
  max 0 (min 255 x)
let int_of_alpha = alpha_of_int
let color_of_int x = Style.Attr.{
  r8 = alpha_of_int (x asr 16);
  g8 = alpha_of_int (x asr 8);
  b8 = alpha_of_int x;
}
let int_of_color (c : Style.Attr.color) =
  (c.r8 lsl 16) + (c.g8 lsl 8) + c.b8
let (ruby'_of_int, int_of_ruby') = make_enum Style.Attr.[|
  Style.Attr.None;
  Base;
  Fallback_parenthesis;
  Text_auto;
  Text_top;
  Text_bottom;
  Text_left;
  Text_right;
|]
let ruby_of_int x =
  (ruby'_of_int (x land 7), x land 8 = 8)
let int_of_ruby (ruby, bouten) =
  int_of_ruby' ruby lor (if bouten then 8 else 0)

module IdMap = struct
  type 'a t = {
    values : 'a array;
    assoc : ('a * int) list ref;
  }

  let make () = {
    values = [||];
    assoc = ref [];
  }

  let get t a =
    match List.assoc_opt a !(t.assoc) with
    | Some i -> i
    | None ->
        let i = Js.Array.push a t.values - 1 in
        t.assoc := (a, i) :: !(t.assoc);
        i

  let values t = t.values
end

exception Invalid_data
let codec' : (track, raw Track.t) Codec.t =
  Codec.make
    ~try_decode:(fun track ->
      if track.wireMagic != "pb3" then Error Invalid_data else
      (* Resolve all declared styles (p/ws/wp) inheritance: *)
      let () = inherit_inplace "pParentId" track.pens in
      let () = inherit_inplace "wsParentId" track.wsWinStyles in
      let () = inherit_inplace "wpParentId" track.wpWinPositions in
      (* We've eliminated all the inheritance. *)
      (* We have final styles that will be associated with window/text events. *)

      (* Convert the pens *)
      let pens =
        track.pens |> Array.map (fun p -> lazy (
          let open Style.Attr in
          [
            p.bAttr |> Option.map (fun x -> Binding (Bold, bool_of_pb x));
            p.iAttr |> Option.map (fun x -> Binding (Italic, bool_of_pb x));
            p.uAttr |> Option.map (fun x -> Binding (Underline, bool_of_pb x));
            (* Some @@ Binding (Strikethrough, true); *)

            p.fsFontStyle |> Option.map (fun x -> Binding (Font_style, font_style_of_int x));
            p.ofOffset |> Option.map (fun x -> Binding (Font_script, font_script_of_int x));
            p.szPenSize |> Option.map (fun x -> Binding (Font_size, font_size_of_int x));
            p.etEdgeType |> Option.map (fun x -> Binding (Border_style, border_style_of_int x));

            p.fcForeColor |> Option.map (fun x -> Binding (Font_color, color_of_int x));
            p.bcBackColor |> Option.map (fun x -> Binding (Background_color, color_of_int x));
            p.ecEdgeColor |> Option.map (fun x -> Binding (Border_color, color_of_int x));
            p.foForeAlpha |> Option.map (fun x -> Binding (Font_alpha, alpha_of_int x));
            p.boBackAlpha |> Option.map (fun x -> Binding (Background_alpha, alpha_of_int x));
            (* p.eoEdgeAlpha |> Option.map (fun x -> Binding (Border_alpha, alpha_of_int x)); *)

            p.rbRuby |> Option.map (fun x -> Binding (Ruby, ruby_of_int x));
            (* p.hgHorizGroup |> Option.map (fun x -> Binding (Force_horizontal, x)); *)
          ]
          |> List.filter Option.is_some
          |> List.map Option.value_exn
          |> Style.from_list
        ))
      in

      (* Resolve all declared windows and styles: *)
      let windows = Belt.MutableMap.Int.make () in
      let rec uninherit events acc =
        match events with
        | [] -> acc
        | e :: tail ->
            match e.id with
            | Some win_id ->
                (* (re)define a window *)
                let e = { e with id = None } in
                Belt.MutableMap.Int.set windows win_id e;
                uninherit tail acc
            | None ->
                (* inherit from the window *)
                let w = Option.bind e.wWinId (Belt.MutableMap.Int.get windows) in
                let e =
                  match w with
                  | None -> e
                  | Some w -> apply_window w e
                in
                let { segs } = e in
                let segs : seg array = segs
                  |> Array.map (fun (seg : seg) ->
                    let { pPenId } = seg in
                    let pPenId =
                      match pPenId, e.pPenId with
                      | Some pPenId, _
                      | None, Some pPenId -> Some pPenId
                      | None, None -> None
                    in
                    ({ seg with pPenId } : seg))
                in
                let e = { e with segs } in
                uninherit tail (e :: acc)
      in
      let events = uninherit (Array.to_list track.events) [] |> List.rev in
      (* We've eliminated the windows (since we don't do rollup captions). *)

      (* Resolve all aAppend. Not sure why it's still used today, but captions.js hacks around it. *)
      let rec unappend events acc =
        match events with
        | [] -> acc
        | e :: tail ->
            if e.aAppend != Some pb_true
            then unappend tail (e :: acc)
            else
              (* Handle append: *)
              match acc with
              (* Nothing to append, try again without aAppend: *)
              | [] -> unappend ({ e with aAppend = None } :: tail) acc
              | acc_hd :: acc_tl ->
                  (* acc_hd.segs <- Array.append acc_hd.segs e.segs; *)
                  let _ = Js.Array.spliceInPlace
                    ~pos:(Js.Array.length acc_hd.segs)
                    ~remove:0
                    ~add:e.segs
                    acc_hd.segs
                  in
                  unappend tail (acc_hd :: acc_tl)
      in
      let events = unappend events [] |> List.rev in
      (* Eliminated all aAppend. *)

      (* Convert each event to a cue: *)
      events |> List.map (fun event ->
        let convert_time t = float_of_int t /. 1000. in
        let start = event.tStartMs |> convert_time in
        let end_ = event.tStartMs + (event.dDurationMs |> Option.value_exn) |> convert_time in
        let win = {
          pos = event.wpWinPosId
              |> Option.map (fun i -> track.wpWinPositions.(i))
              |> Option.value ~default:empty_window.pos;
          style = event.wsWinStyleId
              |> Option.map (fun i -> track.wsWinStyles.(i))
              |> Option.value ~default:empty_window.style;
        } in
        let rec convert_seg now segs acc =
          match segs with
          | [] -> acc
          | seg :: segs ->
              (* Relative to segment start *)
              let now' = seg.tOffsetMs |> Option.map convert_time |> Option.value ~default:now in
              let text = Option.value ~default:"" seg.utf8 in
              let pen = seg.pPenId |> Option.map (fun i -> pens.(i)) in
              let style =
                match pen with
                | None -> Style.empty
                | Some (lazy style) -> style
              in
              let acc =
                if now = now'
                then acc
                else (Track.Wait_until (start +. now'), None) :: acc
              in
              let acc = (Track.Set_style style, Some win) :: acc in
              let acc =
                if text = ""
                then acc
                else (Append text, None) :: acc
              in
              convert_seg now' segs acc;
        in
        ({
          start;
          end_;
          text = convert_seg 0. (Array.to_list event.segs) [] |> List.rev;
        } : raw Track.cue)
      )
      |> List.rev
      |> (fun x -> Ok x)
    )
    ~encode:(fun track ->
      let pens = IdMap.make () in
      let win_styles = IdMap.make () in
      let win_pos = IdMap.make () in
      let events = track
        |> List.map (fun ({ start; end_; text; } : _ Track.cue) ->
            let convert_time t = t *. 1000. +. 0.5 |> int_of_float in
            let start_ms = convert_time start in
            let end_ms = convert_time end_ in
            let style = ref Style.empty in
            let now = ref start in
            let now' = ref start in
            let segs = [||] in
            let window = text
              |> List.map snd
              |> List.find_opt Option.is_some
              |> Option.map Option.value_exn in
            text |> List.iter (fun (token, _raw) ->
              match token with
              | Track.Set_style s ->
                  style := s;
              | Track.Wait_until t ->
                  now' := t;
              | Track.Append s ->
                  let tOffsetMs =
                    if !now = !now'
                    then None
                    else Some (!now' -. start |> convert_time)
                  in
                  now := !now';
                  let pPenId =
                    if !style = Style.empty
                    then None
                    else Some (IdMap.get pens !style)
                  in
                  let seg = {
                    utf8 = Some s;
                    tOffsetMs;
                    pPenId;
                  } in
                  let _ = Js.Array.push seg segs in
                  ()
            );
            {
              tStartMs = start_ms;
              dDurationMs = Some (end_ms - start_ms);
              segs;
              wpWinPosId = window |> Option.map (fun w -> IdMap.get win_pos w.pos);
              wsWinStyleId = window |> Option.map (fun w -> IdMap.get win_styles w.style);
              rcRowCount = None;
              ccColCount = None;
              pPenId = None;
              id = None;
              wWinId = None;
              aAppend = None;
            })
        |> Array.of_list in
      {
        wireMagic = "pb3";
        pens = pens |> IdMap.values |> Array.map (fun style -> {
          pParentId = None;
          bAttr = Style.get Bold style |> Option.map pb_of_bool;
          iAttr = Style.get Italic style |> Option.map pb_of_bool;
          uAttr = Style.get Underline style |> Option.map pb_of_bool;

          fsFontStyle = Style.get Font_style style |> Option.map int_of_font_style;
          ofOffset = Style.get Font_script style |> Option.map int_of_font_script;
          szPenSize = Style.get Font_size style |> Option.map int_of_font_size;
          etEdgeType = Style.get Border_style style |> Option.map int_of_border_style;

          fcForeColor = Style.get Font_color style |> Option.map int_of_color;
          bcBackColor = Style.get Background_color style |> Option.map int_of_color;
          ecEdgeColor = Style.get Border_color style |> Option.map int_of_color;
          foForeAlpha = Style.get Font_alpha style |> Option.map int_of_alpha;
          boBackAlpha = Style.get Background_alpha style |> Option.map int_of_alpha;

          rbRuby = Style.get Ruby style |> Option.map int_of_ruby;
          hgHorizGroup = None;
        });
        wsWinStyles = win_styles |> IdMap.values;
        wpWinPositions = win_pos |> IdMap.values;
        events;
      })

(* Assume the object is json3. *)
let cast_json : (Js.Types.obj_val, track) Codec.t =
  Codec.pure ~decode:Obj.magic ~encode:Obj.magic

let codec = codec'
  |> Codec.stack cast_json
  |> Codec.stack Codec.json
  |> Codec.stack Encoding.prefer_utf8
