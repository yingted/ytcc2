type raw = Json3.raw

(* An attribute value: string | null *)
(* All attributes are of the form x="1" (int) or y="#012ABC" (color) *)
type attr_value = string Js.Null.t
let int_value : (attr_value, int option) Codec.t =
  Codec.pure
    ~decode:[%raw {|
      function int_attr_decode(s_or_null) {
        if (s_or_null/* !== null && s_or_null !== ''*/) {
          return s_or_null | 0;
        }
      }
    |}]
    ~encode:[%raw {|
      function int_attr_encode(x) {
        return x === undefined ? null : x + '';
      }
    |}]
let color_value : (attr_value, int option) Codec.t =
  Codec.pure
    ~decode:[%raw {|
      function color_attr_decode(value) {
        if (value === null) return;
        let m = value.match(/^#([0-9a-f]{6})$/i);
        if (m === null) return;
        return parseInt(m[1], 16);
      }
    |}]
    ~encode:[%raw {|
      function color_attr_encode(c) {
        if (c === undefined) return null;
        return '#' + ('00000' + (c & 0xffffff).toString(16).toUpperCase()).substr(-6);
      }
    |}]
type attr = {
  key : string;  (* json3 name *)
  attr : string;  (* srv3 name *)
  codec : (attr_value, int option) Codec.t;
}
type schema = attr array

(* Try to keep things in YouTube order: *)
let pen_schema = [|
  { key = "pParentId"; attr = "p"; codec = int_value; };

  { key = "bAttr"; attr = "b"; codec = int_value; };
  { key = "iAttr"; attr = "i"; codec = int_value; };
  { key = "uAttr"; attr = "u"; codec = int_value; };

  { key = "fsFontStyle"; attr = "fs"; codec = int_value; };
  { key = "fcForeColor"; attr = "fc"; codec = color_value; };
  { key = "foForeAlpha"; attr = "fo"; codec = int_value; };

  { key = "bcBackColor"; attr = "bc"; codec = color_value; };
  { key = "boBackAlpha"; attr = "bo"; codec = int_value; };

  { key = "ecEdgeColor"; attr = "ec"; codec = color_value; };
  { key = "szPenSize"; attr = "sz"; codec = int_value; };
  { key = "etEdgeType"; attr = "et"; codec = int_value; };

  { key = "ofOffset"; attr = "of"; codec = int_value; };

  { key = "rbRuby"; attr = "rb"; codec = int_value; };
  { key = "hgHorizGroup"; attr = "hg"; codec = int_value; };
|]
let window_style_schema = [|
  { key = "wsParentId"; attr = "ws"; codec = int_value; };

  { key = "mhModeHint"; attr = "mh"; codec = int_value; };
  { key = "juJustifCode"; attr = "ju"; codec = int_value; };
  { key = "pdPrintDir"; attr = "pd"; codec = int_value; };
  { key = "sdScrollDir"; attr = "sd"; codec = int_value; };

  { key = "wfcWinFillColor"; attr = "wfc"; codec = color_value; };
  { key = "wfoWinFillAlpha"; attr = "wfo"; codec = int_value; };
|]
let window_position_schema = [|
  { key = "wpParentId"; attr = "wp"; codec = int_value; };

  { key = "apPoint"; attr = "ap"; codec = int_value; };
  { key = "ahHorPos"; attr = "ah"; codec = int_value; };
  { key = "avVerPos"; attr = "av"; codec = int_value; };

  { key = "rcRows"; attr = "rc"; codec = int_value; };
  { key = "ccCols"; attr = "cc"; codec = int_value; };
|]
let base_event_schema = [|
  (* timing *)
  { key = "tStartMs"; attr = "t"; codec = int_value; };
  { key = "dDurationMs"; attr = "d"; codec = int_value; };
  (* window *)
  { key = "wpWinPosId"; attr = "wp"; codec = int_value; };
  { key = "wsWinStyleId"; attr = "ws"; codec = int_value; };
  { key = "rcRowCount"; attr = "rc"; codec = int_value; };
  { key = "ccColCount"; attr = "cc"; codec = int_value; };
  (* format *)
  { key = "pPenId"; attr = "p"; codec = int_value; };
|]
let cue_schema = Array.append base_event_schema [|
  { key = "id"; attr = "id"; codec = int_value; };
|]
let window_schema = Array.append base_event_schema [|
  { key = "wWinId"; attr = "w"; codec = int_value; };
  { key = "aAppend"; attr = "a"; codec = int_value; };
|]
(* Pen, window style, or window position: *)
type obj = {
  id : int;
  attrs : int option Js.Dict.t;
}
(* Single node (pen/ws/wp): *)
type node
type document

let obj_codec (node_name : string) (schema : schema) (doc : document) : (node, obj) Codec.t =
  let (decode, encode) = [%raw {|
    function(doc, node_name, decode_exn, encode, schema, int_value) {
      return [
        function decode_obj(node) {
          // Decode the ID:
          let id = decode_exn(int_value, node.getAttribute('id'));

          // Decode the attributes:
          let attrs = {};
          for (let {key, attr, codec} of schema) {
            attrs[key] = decode_exn(codec, node.getAttribute(attr));
          }
          return {id, attrs};
        },
        function encode_obj({id, attrs}) {
          let node = doc.createElement(node_name);
          
          // Encode the ID:
          let id_attr = encode(int_value, id);
          if (id_attr !== null) {
            node.setAttribute('id', id_attr);
          }

          // Encode the attributes:
          for (let {key, attr, codec} of schema) {
            let value = encode(codec, attrs[key]);
            if (value !== null) {
              node.setAttribute(attr, value);
            }
          }
          return node;
        },
      ];
    }
  |}] doc node_name Codec.decode_exn Codec.encode schema int_value in
  Codec.pure ~decode ~encode

(* Iterable of XML nodes: *)
type nodes
let objs_codec (obj : (node, obj) Codec.t) : (nodes, obj option array) Codec.t =
  let (decode, encode) = [%raw {|
    function(decode_exn, encode, obj) {
      return [
        function decode_objs(nodes) {
          let values = [];
          let maxEmpty = nodes.length * 10;  // limit for safety
          for (let node of nodes) {
            let {id, attrs} = decode_exn(obj, node);
            if (id !== undefined) {
              values[id] = attrs;
            }
          }
          // Fill in the empty values:
          for (let i = 0; i < values.length && i < maxEmpty; ++i) {
            if (values[i] === undefined) {
              values[i] = {};
            }
          }
          return values;
        },
        function encode_objs(objs) {
          // We should renumber the ids, but let's already assume that's done.
          return objs.map((attrs, id) => encode(obj, {attrs, id}));
        },
      ];
    }
  |}] Codec.decode_exn Codec.encode obj in
  let encode' objs = objs |> Array.map Option.value_exn |> encode in
  Codec.pure ~decode ~encode:encode'
let pens_codec doc =
  obj_codec "pen" pen_schema doc |> objs_codec
let window_styles_codec doc =
  obj_codec "ws" window_style_schema doc |> objs_codec
let window_positions_codec doc =
  obj_codec "wp" window_position_schema doc |> objs_codec
let window_codec =
  obj_codec "w" window_schema
let cue_codec =
  obj_codec "p" cue_schema

let srv3_to_json_exn : string -> Json3.json =
  [%raw {|
    (decode_exn, pens_codec, window_styles_codec, window_positions_codec, window_codec, cue_codec) =>
    function srv3_to_json_exn(xmlUtf8) {
      let doc = new DOMParser().parseFromString(xmlUtf8, 'application/xml');

      return {
        wireMagic: 'pb3',
        pens: decode_exn(pens_codec(doc), doc.querySelectorAll('pen')),
        wsWinStyles: decode_exn(window_styles_codec(doc), doc.querySelectorAll('ws')),
        wpWinPositions: decode_exn(window_positions_codec(doc), doc.querySelectorAll('wp')),
        events: Array.from(doc.querySelectorAll('p, w')).map(pw => {
          if (pw.tagName.toLowerCase() === 'w') {
            return decode_exn(window_codec(doc), pw).attrs;
          }

          let event = decode_exn(cue_codec(doc), pw).attrs;

          // Decode spans:
          let segs = [];
          event.segs = segs;
          for (let span of pw.childNodes) {
            let seg;
            switch (span.nodeType) {
              case Node.TEXT_NODE:
                seg = {
                  utf8: span.textContent,
                };
                break;
              case Node.ELEMENT_NODE:
                seg = {
                  utf8: span.textContent,
                  tOffsetMs: decode_exn(int_value, span.getAttribute('t')),
                  pPenId: decode_exn(int_value, span.getAttribute('p')),
                };
                break;
              default:
                continue;
            }
            if (!(seg.tOffsetMs === undefined && seg.pPenId === undefined && seg.utf8 === '')) {
              segs.push(seg);
            }
          }
          return event;
        }),
      };
    }
  |}]
    Codec.decode_exn
    pens_codec window_styles_codec window_positions_codec window_codec cue_codec

let srv3_newlines = true
let empty_leading_span = true
let json3_to_srv3 : Json3.json -> string =
  [%raw {|
    (newlines, empty_leading_span,
    encode,
    pens_codec, window_styles_codec, window_positions_codec, window_codec, cue_codec) =>
    function json3_to_srv3(track) {
      let doc = new DOMParser().parseFromString(
`<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<head>
</head>
<body>
</body>
</timedtext>`, 'application/xml');

      // Write the head:
      {
        let head = doc.querySelector('head');
        for (let pen of encode(pens_codec(doc), track.pens)) {
          head.appendChild(pen);
          if (newlines) head.appendChild(doc.createTextNode('\n'));
        }
        for (let ws of encode(window_styles_codec(doc), track.wsWinStyles)) {
          head.appendChild(ws);
          if (newlines) head.appendChild(doc.createTextNode('\n'));
        }
        for (let wp of encode(window_positions_codec(doc), track.wpWinPositions)) {
          head.appendChild(wp);
          if (newlines) head.appendChild(doc.createTextNode('\n'));
        }
      }

      // Write the body:
      {
        let body = doc.querySelector('body');
        for (let event of track.events) {
          // Check for window (always has window id):
          if (event.id !== undefined) {
            // Encode window:
            body.appendChild(encode(window_codec(doc), {attrs: event}));
            if (newlines) body.appendChild(doc.createTextNode('\n'));
            continue;
          }

          // Encode cue:
          let node = encode(cue_codec(doc), {attrs: event});
          let segs = event.segs;
          for (let {utf8, pPenId, tOffsetMs} of segs) {
            // Encode span:
            if (pPenId === undefined && tOffsetMs === undefined) {
              // Text node:
              if (newlines) node.appendChild(doc.createTextNode(utf8));
              continue;
            }

            // If the cue starts with a styled span, insert an empty span.
            if (empty_leading_span && node.childNodes.length === 0) {
              node.appendChild(doc.createElement('s'));
            }

            // Element node:
            let span = doc.createElement('s');
            let t = encode(int_value, tOffsetMs);
            if (t !== null) span.setAttribute('t', t);
            let p = encode(int_value, pPenId);
            if (p !== null) span.setAttribute('p', p);
            span.textContent = utf8;
            node.appendChild(span);
          }
          body.appendChild(node);
          if (newlines) body.appendChild(doc.createTextNode('\n'));
        }
      }

      return '<?xml version="1.0" encoding="utf-8" ?>' + new XMLSerializer().serializeToString(doc);
    }
  |}]
    srv3_newlines empty_leading_span
    Codec.encode
    pens_codec window_styles_codec window_positions_codec window_codec cue_codec

exception Srv3_decode_error of Js.Exn.t
let xml_codec =
  Codec.make
    ~try_decode:(fun s ->
      match srv3_to_json_exn s with
      | x -> Ok x
      | exception Js.Exn.Error err -> Error (Srv3_decode_error err))
    ~encode:json3_to_srv3

let string_codec = Json3.json_codec
  |> Codec.stack xml_codec
let codec = string_codec
  |> Codec.stack Encoding.prefer_utf8
