let srv3_to_json_exn : string -> Json3.json =
  [%raw {|
    function srv3_to_json_exn(xmlUtf8) {
      let doc = new DOMParser().parseFromString(xmlUtf8, 'application/xml');
      let getInt = function getInt(node, attr) {
        let value = node.getAttribute(attr);
        if (value !== null) return value | 0;
      };
      let getColor = function getColor(node, attr) {
        let value = node.getAttribute(attr);
        if (value === null) return;
        let m = value.match(/^#([0-9a-f]{6})$/i);
        if (m === null) return;
        return parseInt(m[1], 16);
      };
      let collectByIds = function collectByIds(nodes, makeIdAndElement) {
        let values = [];
        let maxPens = nodes.length * 10;  // limit for safety
        for (let node of nodes) {
          let [id, value] = makeIdAndElement(node);
          values[id] = value;
        }
        for (let i = 0; i < values.length && i < maxPens; ++i) {
          if (values[i] === undefined) {
            values[i] = {};
          }
        }
        return values;
      };

      return {
        wireMagic: 'pb3',
        pens: collectByIds(doc.querySelectorAll('pen'), pen => [
          getInt(pen, 'id'),
          {
            pParentId: getInt(pen, 'p'),
            bAttr: getInt(pen, 'b'),
            iAttr: getInt(pen, 'i'),
            uAttr: getInt(pen, 'u'),
            ofOffset: getInt(pen, 'of'),
            szPenSize: getInt(pen, 'sz'),
            etEdgeType: getInt(pen, 'et'),
            ecEdgeColor: getColor(pen, 'ec'),
            fsFontStyle: getInt(pen, 'fs'),
            fcForeColor: getColor(pen, 'fc'),
            foForeAlpha: getInt(pen, 'fo'),
            bcBackColor: getColor(pen, 'bc'),
            boBackAlpha: getInt(pen, 'bo'),
            rbRuby: getInt(pen, 'rb'),
            hgHorizGroup: getInt(pen, 'hg'),
          },
        ]),
        wsWinStyles: collectByIds(doc.querySelectorAll('ws'), ws => [
          getInt(ws, 'id'),
          {
            wsParentId: getInt(ws, 'ws'),
            mhModeHint: getInt(ws, 'mh'),
            juJustifCode: getInt(ws, 'ju'),
            sdScrollDir: getInt(ws, 'sd'),
            pdPaintDir: getInt(ws, 'pd'),
            wfcWinFillColor: getColor(ws, 'wfc'),
            wfoWinFillAlpha: getInt(ws, 'wfo'),
          },
        ]),
        wpWinPositions: collectByIds(doc.querySelectorAll('wp'), wp => [
          getInt(wp, 'id'),
          {
            wpParentId: getInt(wp, 'wp'),
            apPoint: getInt(wp, 'ap'),
            ahHorPos: getInt(wp, 'ah'),
            avVerPos: getInt(wp, 'av'),
            rcRows: getInt(wp, 'rc'),
            ccCols: getInt(wp, 'cc'),
          },
        ]),
        events: Array.from(doc.querySelectorAll('p, w')).map(pw => {
          let event = {
            // timing
            tStartMs: getInt(pw, 't'),
            dDurationMs: getInt(pw, 'd'),
            // window
            wpWinPosId: getInt(pw, 'wp'),
            wsWinStyleId: getInt(pw, 'ws'),
            rcRowCount: getInt(pw, 'rc'),
            ccColCount: getInt(pw, 'cc'),
            // format
            pPenId: getInt(pw, 'p'),
          };
          if (pw.tagName.toLowerCase() === 'w') {
            event.id = getInt(pw, 'id');
          } else {  // p
            event.wWinId = getInt(pw, 'w');
            event.aAppend = getInt(pw, 'a');

            // Decode spans:
            let segs = [];
            event.segs = segs;
            for (let span of pw.childNodes) {
              switch (span.nodeType) {
                case Node.TEXT_NODE:
                  segs.push({
                    utf8: span.textContent,
                  });
                  break;
                case Node.ELEMENT_NODE:
                  segs.push({
                    utf8: span.textContent,
                    tOffsetMs: getInt(span, 't'),
                    pPenId: getInt(span, 'p'),
                  });
                  break;
              }
            }
          }
          return event;
        }),
      };
    }
  |}]

let json3_to_srv3 : Json3.json -> string =
  [%raw {|
    function json3_to_srv3(track) {
      return
`<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<head>
<pen id="1" fc="#FEFEFE" bo="0" ec="#000000" et="3"/>
<ws id="0"/>
<wp id="24" ap="0" ah="23" av="1"/>
</head>
<body>
<p t="4277" d="901" wp="1" ws="3" p="1">Grow up! Nah mean?</p>
<p t="4277" d="901" wp="1" ws="3" p="1">Grow up! <s p="1">Nah mean?</s></p>
</body>
</timedtext>
`;
    }
  |}]

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
