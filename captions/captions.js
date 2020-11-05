(function(g) {
    var window = this;
    var d3 = function(a) {
        var b = {
            languageCode: a.languageCode,
            languageName: a.languageName,
            displayName: g.yE(a),
            kind: a.kind,
            name: a.name,
            id: a.id,
            is_servable: a.u,
            is_default: a.isDefault,
            is_translateable: a.isTranslateable,
            vss_id: a.vssId
        };
        a.translationLanguage && (b.translationLanguage = a.translationLanguage);
        return b
    }
      , e3 = function(a) {
        return a.translationLanguage ? a.translationLanguage.languageCode : a.languageCode
    }
      , UDa = function(a, b) {
        var c = new g.xE;
        c.languageCode = a.languageCode;
        c.languageName = a.languageName;
        c.name = a.name;
        c.kind = a.kind;
        c.isDefault = !1;
        c.u = a.u;
        c.isTranslateable = a.isTranslateable;
        c.vssId = a.vssId;
        c.url = a.url;
        c.translationLanguage = b;
        return c
    }
      , VDa = function() {
        this.B = [];
        this.u = []
    }
      , f3 = function(a, b) {
        switch (b.kind) {
        case "asr":
            WDa(b, a.B);
            break;
        default:
            WDa(b, a.u)
        }
    }
      , WDa = function(a, b) {
        g.jb(b, function(c) {
            return c ? a.toString() === c.toString() : !1
        }) || b.push(a)
    }
      , g3 = function() {
        g.B.call(this);
        this.B = new VDa;
        this.D = []
    }
      , h3 = function(a, b, c) {
        g3.call(this, a);
        this.audioTrack = c;
        this.u = null;
        this.D = b.Fv
    }
      , i3 = function() {
        this.segments = []
    }
      , XDa = function(a, b) {
        var c = g.Ab(a.segments, b);
        0 <= c || 0 > c && 1 === (-c - 1) % 2 || (c = -c - 1,
        0 < c && 1 === b - a.segments[c - 1] && c < a.segments.length && 1 === a.segments[c] - b ? (g.qb(a.segments, c),
        g.qb(a.segments, c - 1)) : 0 < c && 1 === b - a.segments[c - 1] ? a.segments[c - 1] = b : c < a.segments.length && 1 === a.segments[c] - b ? a.segments[c] = b : (g.xb(a.segments, c, 0, b),
        g.xb(a.segments, c + 1, 0, b)))
    }
      , j3 = function(a, b, c, d, e, f) {
        g.B.call(this);
        this.policy = a;
        this.player = b;
        this.W = c;
        this.I = d;
        this.F = e;
        this.N = f;
        this.P = this.player.T();
        this.D = new i3;
        this.B = this.C = this.u = null;
        this.K = new g.H(this.NC,1E3,this);
        this.events = new g.Wr(this);
        g.C(this, this.K);
        g.C(this, this.events);
        this.events.R(b, "SEEK_COMPLETE", this.qD);
        this.qD();
        this.NC()
    }
      , YDa = function(a, b) {
        var c = g.Gv(b, a.policy, {}).nd()
          , d = {
            format: "RAW",
            withCredentials: !0
        };
        a.F && (d.responseType = "arraybuffer");
        a.B = g.zr(c, d, 3, 100).then(function(e) {
            a: {
                a.la();
                if (a.C) {
                    var f = !(a.F ? e.response : e.responseText) || 400 <= e.status
                      , h = g.Hz(e);
                    if (h) {
                        e = g.Gv(a.C, a.policy, {});
                        f = a.C;
                        g.Cv(f.B, e, h);
                        f.requestId = e.get("req_id");
                        YDa(a, a.C);
                        break a
                    }
                    f || null == a.I || (h = a.C.u[0],
                    a.F ? a.I(e.response, 1E3 * (h.startTime + a.player.lc())) : a.I(e.responseText, 1E3 * (h.startTime + a.player.lc())))
                }
                a.C = null;
                a.B = null
            }
        });
        a.C = b;
        XDa(a.D, a.C.u[0].B)
    }
      , k3 = function(a, b) {
        g3.call(this, b.T());
        this.ma = a;
        this.J = b;
        this.u = null;
        this.C = !1;
        this.F = g.mC(this.J.T()) && !this.ma.isManifestless
    }
      , ZDa = function(a, b) {
        var c = [], d;
        for (d in a.ma.u)
            if (a.ma.u.hasOwnProperty(d)) {
                var e = a.ma.u[d];
                if (g.lX(e, b || null)) {
                    var f = "en"
                      , h = "English"
                      , l = ".en"
                      , m = "";
                    if (e = e.info.captionTrack)
                        f = e.languageCode,
                        h = e.displayName,
                        l = e.vssId,
                        m = e.kind;
                    c.push(new g.xE({
                        id: d,
                        languageCode: f,
                        languageName: h,
                        is_servable: !0,
                        is_default: !0,
                        is_translateable: !1,
                        vss_id: l,
                        kind: m
                    }))
                }
            }
        return c
    }
      , $Da = function(a, b) {
        return null != b && b in a.ma.u ? a.ma.u[b] : null
    }
      , aEa = function(a, b, c) {
        var d = [], e;
        for (e in a.ma.u)
            if (a.ma.u.hasOwnProperty(e)) {
                var f = a.ma.u[e];
                if (g.lX(f, c || null)) {
                    var h = f.info.captionTrack;
                    h && h.languageCode === b && d.push(f)
                }
            }
        return d.length ? d[0] : null
    }
      , l3 = function(a, b, c, d, e) {
        g3.call(this, e || null);
        this.videoId = b;
        this.mC = d;
        this.F = {};
        this.u = null;
        b = c || g.Xp(a).hl || "";
        b = b.split("_").join("-");
        this.C = g.Zp(a, {
            hl: b
        })
    }
      , m3 = function(a, b, c, d, e, f, h) {
        var l = {};
        g.Xa(l, b);
        g.Xa(l, a.params);
        g.Xa(l, c);
        var m = {};
        g.Xa(m, b.sc);
        a.params.sc && g.Xa(m, a.params.sc);
        g.Xa(m, c.sc);
        l.sc = m;
        g.V.call(this, {
            G: "div",
            L: "caption-window",
            U: {
                id: "caption-window-" + a.id,
                dir: 1 === l.u ? "rtl" : "ltr",
                tabindex: "0",
                "aria-live": "assertive",
                lang: l.lang
            },
            S: [{
                G: "span",
                L: "captions-text",
                U: {
                    style: "word-wrap: normal; display: block;"
                }
            }]
        });
        this.F = [];
        this.Y = !1;
        this.B = a;
        this.ea = this.ba = null;
        this.playerWidth = e;
        this.playerHeight = f;
        this.experiments = h;
        this.I = null;
        this.maxWidth = .96 * e;
        this.Ja = .96 * f;
        this.u = l;
        this.Za = c;
        this.D = this.ga("captions-text");
        this.Qa = "" !== this.D.style.getPropertyValue("box-decoration-break") || "" !== this.D.style.getPropertyValue("-webkit-box-decoration-break");
        this.da = d / 360 * 16;
        this.type = 0;
        this.ra = this.da * bEa(m);
        a = new g.bs(this.element,!0);
        g.C(this, a);
        a.subscribe("dragstart", this.cL, this);
        a.subscribe("dragmove", this.bL, this);
        a.subscribe("dragend", this.aL, this);
        this.Ga = this.za = 0;
        b = "";
        this.u.windowOpacity && (a = g.T0(this.u.windowColor),
        b = "rgba(" + a[0] + "," + a[1] + "," + a[2] + "," + this.u.windowOpacity + ")");
        a = {
            "background-color": b,
            display: !1 === this.u.isVisible ? "none" : "",
            "text-align": cEa[this.u.textAlign]
        };
        this.Qa && (a["border-radius"] = b ? this.ra / 8 + "px" : "");
        if (this.C = 2 === this.B.params.u || 3 === this.B.params.u)
            b = this.element,
            c = "vertical-rl",
            1 === this.u.C && (c = "vertical-lr"),
            g.ye && (c = "vertical-lr" === c ? "tb-lr" : "tb-rl"),
            g.E(b, "-o-writing-mode", c),
            g.E(b, "-webkit-writing-mode", c),
            g.E(b, "writing-mode", c),
            g.E(b, "text-orientation", "upright"),
            g.I(b, "ytp-vertical-caption"),
            3 === this.B.params.u && (g.E(b, "text-orientation", ""),
            g.E(b, "transform", "rotate(180deg)"));
        g.E(this.element, a);
        switch (this.u.Rg) {
        case 0:
        case 1:
        case 2:
            g.I(this.element, "ytp-caption-window-top");
            break;
        case 6:
        case 7:
        case 8:
            g.I(this.element, "ytp-caption-window-bottom")
        }
    }
      , bEa = function(a) {
        var b = 1 + .25 * (a.fontSizeIncrement || 0);
        if (0 === a.offset || 2 === a.offset)
            b *= .8;
        return b
    }
      , dEa = function(a, b) {
        var c = {}
          , d = b.background ? b.background : a.u.sc.background;
        if (null != b.backgroundOpacity || b.background) {
            var e = null != b.backgroundOpacity ? b.backgroundOpacity : a.u.sc.backgroundOpacity;
            d = g.T0(d);
            c.background = "rgba(" + d[0] + "," + d[1] + "," + d[2] + "," + e + ")";
            a.Qa && (c["box-decoration-break"] = "clone",
            c["border-radius"] = a.ra / 8 + "px")
        }
        if (null != b.fontSizeIncrement || null != b.offset)
            c["font-size"] = a.da * bEa(b) + "px";
        d = 1;
        e = b.color || a.u.sc.color;
        if (b.color || null != b.textOpacity)
            e = g.T0(e),
            d = null == b.textOpacity ? a.u.sc.textOpacity : b.textOpacity,
            e = "rgba(" + e[0] + "," + e[1] + "," + e[2] + "," + d + ")",
            c.color = e,
            c.fill = e;
        var f = b.charEdgeStyle;
        0 === f && (f = void 0);
        if (f) {
            e = "rgba(34, 34, 34, " + d + ")";
            var h = "rgba(204, 204, 204, " + d + ")";
            b.Kv && (h = e = b.Kv);
            var l = a.da / 16 / 2
              , m = Math.max(l, 1)
              , n = Math.max(2 * l, 1)
              , p = Math.max(3 * l, 1)
              , r = Math.max(5 * l, 1);
            d = [];
            switch (f) {
            case 4:
                for (; p <= r; p += l)
                    d.push(n + "px " + n + "px " + p + "px " + e);
                break;
            case 1:
                n = 2 <= window.devicePixelRatio ? .5 : 1;
                for (f = m; f <= p; f += n)
                    d.push(f + "px " + f + "px " + e);
                break;
            case 2:
                d.push(m + "px " + m + "px " + h);
                d.push("-" + m + "px -" + m + "px " + e);
                break;
            case 3:
                for (p = 0; 5 > p; p++)
                    d.push("0 0 " + n + "px " + e)
            }
            c["text-shadow"] = d.join(", ")
        }
        e = "";
        switch (b.fontFamily) {
        case 1:
            e = '"Courier New", Courier, "Nimbus Mono L", "Cutive Mono", monospace';
            break;
        case 2:
            e = '"Times New Roman", Times, Georgia, Cambria, "PT Serif Caption", serif';
            break;
        case 3:
            e = '"Deja Vu Sans Mono", "Lucida Console", Monaco, Consolas, "PT Mono", monospace';
            break;
        case 5:
            e = '"Comic Sans MS", Impact, Handlee, fantasy';
            break;
        case 6:
            e = '"Monotype Corsiva", "URW Chancery L", "Apple Chancery", "Dancing Script", cursive';
            break;
        case 7:
            e = g.bk() ? '"Carrois Gothic SC", sans-serif-smallcaps' : '"Arial Unicode Ms", Arial, Helvetica, Verdana, "Marcellus SC", sans-serif';
            break;
        case 0:
        case 4:
            e = '"YouTube Noto", Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif'
        }
        e && (c["font-family"] = e);
        e = b.offset;
        null == e && (e = a.u.sc.offset);
        switch (e) {
        case 0:
            c["vertical-align"] = "sub";
            break;
        case 2:
            c["vertical-align"] = "super"
        }
        7 === b.fontFamily && (c["font-variant"] = "small-caps");
        b.bold && (c["font-weight"] = "bold");
        b.kh && (c["font-style"] = "italic");
        b.underline && (c["text-decoration"] = "underline");
        b.EJ && (c.visibility = "hidden");
        1 === b.iC && a.C && (c["text-combine-upright"] = "all",
        c["text-orientation"] = "mixed",
        e = g.rC || g.sC,
        3 === a.B.params.u ? c.transform = e ? "rotate(90deg)" : "rotate(180deg)" : e && (c.transform = "rotate(-90deg)"));
        if (1 === b.Fh || 2 === b.Fh || 3 === b.Fh || 4 === b.Fh || 5 === b.Fh)
            if (g.rC)
                c["font-weight"] = "bold";
            else
                switch (c["text-emphasis-style"] = "filled circle",
                c["text-emphasis-color"] = "currentcolor",
                c["webkit-text-emphasis"] = "filled circle",
                b.Fh) {
                case 4:
                case 3:
                    c["text-emphasis-position"] = "under left";
                    c["webkit-text-emphasis-position"] = "under left";
                    break;
                case 5:
                case 2:
                    c["text-emphasis-position"] = "over right",
                    c["webkit-text-emphasis-position"] = "over right"
                }
        return c
    }
      , eEa = function(a) {
        a.I = g.Fe("SPAN");
        g.E(a.I, {
            display: "block"
        });
        g.I(a.I, "caption-visual-line");
        a.D.appendChild(a.I)
    }
      , fEa = function(a, b) {
        var c = g.Fe("SPAN");
        g.E(c, {
            display: "inline-block",
            "white-space": "pre-wrap"
        });
        g.E(c, dEa(a, b));
        c.classList.add("ytp-caption-segment");
        a.I.appendChild(c);
        c.previousElementSibling && (g.E(c.previousElementSibling, {
            "border-top-right-radius": "0",
            "border-bottom-right-radius": "0"
        }),
        g.E(c, {
            "border-top-left-radius": "0",
            "border-bottom-left-radius": "0"
        }));
        return c
    }
      , gEa = function(a, b, c) {
        a.Y = a.Y || !!c;
        var d = {};
        g.Xa(d, a.u.sc);
        g.Xa(d, c || b.u);
        g.Xa(d, a.Za.sc);
        (c = !a.I) && eEa(a);
        for (var e = a.ba && a.ea && g.Yb(d, a.ea) ? a.ba : fEa(a, d), f = "string" === typeof b.text, h = f ? b.text.split("\n") : [b.text], l = 0; l < h.length; l++) {
            var m = 0 < l || !b.append
              , n = h[l];
            m && !c ? (eEa(a),
            e = fEa(a, d)) : m && c && (c = !1);
            n && (e.appendChild(f ? g.Ge(n) : n),
            f || "RUBY" !== n.tagName || 4 !== n.childElementCount || g.rC || !g.sg(n.children[2], "text-emphasis") || (m = a.C ? "padding-right" : "padding-top",
            g.sg(n.children[2], "text-emphasis-position") && (m = a.C ? "padding-left" : "padding-bottom"),
            g.Ae ? g.E(e, m, "1em") : g.E(e, m, "0.5em")))
        }
        a.ea = d;
        a.ba = e;
        a.F.push(b)
    }
      , n3 = function(a, b, c, d, e, f, h) {
        m3.call(this, a, b, c, d, e, f, h);
        this.type = 1
    }
      , o3 = function(a, b, c, d, e, f, h) {
        m3.call(this, a, b, c, d, e, f, h);
        this.type = 2;
        this.K = [];
        this.W = this.P = this.ha = 0;
        this.X = NaN;
        this.Na = 0;
        this.nb = null;
        this.ka = new g.H(this.fP,433,this);
        g.I(this.element, "ytp-caption-window-rollup");
        g.C(this, this.ka);
        g.E(this.element, "overflow", "hidden")
    }
      , hEa = function(a, b) {
        return (a.C ? b.offsetHeight : b.offsetWidth) + 1
    }
      , iEa = function(a) {
        if (isNaN(a.X)) {
            var b = a.u.Tj;
            if (b) {
                var c = g.Fe("SPAN");
                g.Ne(c, "\u2013".repeat(b));
                g.E(c, dEa(a, a.u.sc));
                a.D.appendChild(c);
                a.X = c.offsetWidth;
                a.D.removeChild(c)
            } else
                a.X = 0
        }
        return a.X
    }
      , jEa = function(a, b) {
        if (!b)
            return "";
        a.C && 1 !== a.B.params.C && (b *= -1);
        return "translate" + (a.C ? "X" : "Y") + "(" + b + "px)"
    }
      , kEa = function(a) {
        a.K = Array.from(document.getElementsByClassName("caption-visual-line"));
        for (var b = a.B.params.B, c = 0, d = 0, e = a.K.length - 1; c < b && -1 < e; ) {
            var f = a.K[e];
            d += a.C ? f.offsetWidth : f.offsetHeight;
            c++;
            e--
        }
        a.K.length < b && (d *= b / a.K.length);
        a.P = d;
        a.W = Math.max(iEa(a), a.Na, hEa(a, a.D))
    }
      , lEa = function(a, b) {
        kEa(a);
        var c = a.K.reduce(function(e, f) {
            return (a.C ? f.offsetWidth : f.offsetHeight) + e
        }, 0);
        c = a.P - c;
        if (c !== a.ha) {
            var d = 0 < c && 0 === a.ha;
            b || isNaN(c) || d || (g.I(a.element, "ytp-rollup-mode"),
            a.ka.xb());
            g.E(a.D, "transform", jEa(a, c));
            a.ha = c
        }
        kEa(a)
    }
      , p3 = function(a, b, c, d, e, f, h) {
        f = void 0 === f ? !1 : f;
        h = void 0 === h ? null : h;
        g.tD.call(this, a, a + b, {
            priority: c,
            namespace: "captions"
        });
        this.windowId = d;
        this.text = e;
        this.append = f;
        this.u = h
    }
      , q3 = function(a, b, c, d, e) {
        g.tD.call(this, a, a + b, {
            priority: c,
            namespace: "captions"
        });
        this.id = d;
        this.params = e;
        this.u = []
    }
      , mEa = function(a) {
        var b = "_" + r3++;
        return new q3(0,0x8000000000000,0,b,a)
    }
      , oEa = function(a, b, c, d, e, f, h) {
        var l = f[0]
          , m = h[l.getAttribute("p")];
        if (1 === m.Xc) {
            var n = f[1]
              , p = f[2];
            f = f[3];
            l.getAttribute("t");
            n.getAttribute("t");
            p.getAttribute("t");
            f.getAttribute("t");
            l.getAttribute("p");
            n.getAttribute("p");
            f.getAttribute("p");
            h = h[p.getAttribute("p")];
            l = nEa(l.textContent, n.textContent, p.textContent, f.textContent, h);
            return new p3(a,b,e,c,l,d,m)
        }
        switch (m.Xc) {
        case 9:
        case 10:
            m.Fh = 1;
            break;
        case 11:
            m.Fh = 2;
            break;
        case 12:
            m.Fh = 3;
            break;
        case 13:
            m.Fh = 4;
            break;
        case 14:
            m.Fh = 5
        }
        return new p3(a,b,e,c,l.textContent || "",d,m)
    }
      , nEa = function(a, b, c, d, e) {
        var f = g.bk()
          , h = f ? g.Fe("DIV") : g.Fe("RUBY")
          , l = g.Fe("SPAN");
        l.textContent = a;
        h.appendChild(l);
        a = f ? g.Fe("DIV") : g.Fe("RP");
        a.textContent = b;
        h.appendChild(a);
        b = f ? g.Fe("DIV") : g.Fe("RT");
        b.textContent = c;
        h.appendChild(b);
        c = e.Xc;
        if (10 === c || 11 === c || 12 === c || 13 === c || 14 === c)
            if (g.E(b, "text-emphasis-style", "filled circle"),
            g.E(b, "text-emphasis-color", "currentcolor"),
            g.E(b, "webkit-text-emphasis", "filled circle"),
            11 === e.Xc || 13 === e.Xc)
                g.E(b, "webkit-text-emphasis-position", "under left"),
                g.E(b, "text-emphasis-position", "under left");
        c = !0;
        if (4 === e.Xc || 7 === e.Xc || 12 === e.Xc || 14 === e.Xc)
            g.E(h, "ruby-position", "over"),
            g.E(h, "-webkit-ruby-position", "before");
        else if (5 === e.Xc || 6 === e.Xc || 11 === e.Xc || 13 === e.Xc)
            g.E(h, "ruby-position", "under"),
            g.E(h, "-webkit-ruby-position", "after"),
            c = !1;
        e = f ? g.Fe("DIV") : g.Fe("RP");
        e.textContent = d;
        h.appendChild(e);
        f && (d = c,
        g.E(h, {
            display: "inline-block",
            position: "relative"
        }),
        f = h.firstElementChild.nextElementSibling,
        g.E(f, "display", "none"),
        f = f.nextElementSibling,
        g.E(f, {
            "font-size": "0.5em",
            "line-height": "1.2em",
            "text-align": "center",
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            width: "400%"
        }),
        g.E(h.lastElementChild, "display", "none"),
        d ? (g.E(h, "padding-top", "0.6em"),
        g.E(f, "top", "0")) : (g.E(h, "padding-bottom", "0.6em"),
        g.E(f, "bottom", "0")));
        return h
    }
      , s3 = function() {
        g.B.apply(this, arguments)
    }
      , t3 = function(a) {
        s3.call(this);
        this.I = a;
        this.D = {};
        this.P = {};
        this.W = {};
        this.F = "_" + r3++;
        this.N = {};
        this.B = this.u = null;
        this.K = !0
    }
      , u3 = function(a, b) {
        var c = a.getAttribute(b);
        if (null != c)
            return Number(c)
    }
      , v3 = function(a, b) {
        var c = a.getAttribute(b);
        if (null != c)
            return "1" === c
    }
      , w3 = function(a, b) {
        var c = u3(a, b);
        return void 0 !== c ? c : null
    }
      , y3 = function(a, b) {
        var c = a.getAttribute(b);
        if (null != c)
            return x3.test(c),
            c
    }
      , pEa = function(a, b) {
        var c = {}
          , d = b.getAttribute("ws");
        g.Xa(c, d ? a.W[d] : a.I);
        d = w3(b, "mh");
        null != d && (c.gn = d);
        d = w3(b, "ju");
        null != d && (c.textAlign = d);
        d = w3(b, "pd");
        null != d && (c.u = d);
        d = w3(b, "sd");
        null != d && (c.C = d);
        d = y3(b, "wfc");
        null != d && (c.windowColor = d);
        d = u3(b, "wfo");
        void 0 !== d && (c.windowOpacity = d / 255);
        return c
    }
      , qEa = function(a, b) {
        var c = {}
          , d = b.getAttribute("wp");
        d && g.Xa(c, a.P[d]);
        d = w3(b, "ap");
        null != d && (c.Rg = d);
        d = u3(b, "cc");
        null != d && (c.Tj = d);
        d = u3(b, "ah");
        null != d && (c.fg = d);
        d = u3(b, "rc");
        null != d && (c.B = d);
        d = u3(b, "av");
        null != d && (c.Ih = d);
        return c
    }
      , rEa = function(a, b, c, d) {
        var e = {};
        g.Xa(e, qEa(a, b));
        g.Xa(e, pEa(a, b));
        d ? g.Yb(e, a.I) ? (d = a.F,
        e = a.I) : d = "_" + r3++ : d = b.getAttribute("id") || "_" + r3++;
        a = u3(b, "t") + c;
        b = u3(b, "d") || 0x8000000000000;
        if (2 === e.u || 3 === e.u)
            c = e.B,
            e.B = e.Tj,
            e.Tj = c;
        return new q3(a,b,0,d,e)
    }
      , z3 = function(a) {
        s3.call(this);
        this.I = a;
        this.u = new Map;
        this.D = new Map;
        this.F = new Map;
        this.B = new Map
    }
      , A3 = function(a) {
        a = g.be(Math.round(a), 0, 16777215).toString(16).toUpperCase();
        return "#000000".substr(0, 7 - a.length) + a
    }
      , sEa = function(a, b, c, d, e) {
        0 === d && (d = 0x8000000000000);
        var f = {};
        b.wpWinPosId && Object.assign(f, a.D.get(b.wpWinPosId));
        b.wsWinStyleId && Object.assign(f, a.F.get(b.wsWinStyleId));
        a = b.rcRowCount;
        void 0 !== a && (f.B = a);
        b = b.ccColCount;
        void 0 !== b && (f.Tj = b);
        if (2 === f.u || 3 === f.u)
            b = f.B,
            f.B = f.Tj,
            f.Tj = b;
        return new q3(c,d,0,e,f)
    }
      , C3 = function() {
        this.C = this.time = this.mode = this.B = 0;
        this.D = new B3(this);
        this.F = new B3(this);
        this.u = [];
        this.clear()
    }
      , uEa = function(a, b, c) {
        if (255 === a && 255 === b || !a && !b)
            return {
                Wk: a,
                Pj: b,
                result: 0
            };
        a = tEa[a];
        b = tEa[b];
        if (a & 128) {
            var d;
            if (d = !(b & 128))
                d = b,
                d = c.isValid() && c.Pj === d;
            if (d)
                return {
                    Wk: a,
                    Pj: b,
                    result: 1
                }
        } else if (b & 128 && 1 <= a && 31 >= a)
            return {
                Wk: a,
                Pj: b,
                result: 2
            };
        return {
            Wk: a,
            Pj: b,
            result: 3
        }
    }
      , wEa = function(a, b, c, d) {
        255 === b && 255 === c || !b && !c ? (45 === ++a.C && a.reset(),
        a.D.u.clear(),
        a.F.u.clear()) : (a.C = 0,
        vEa(a.D, b, c, d))
    }
      , xEa = function(a, b) {
        a.u.sort(function(e, f) {
            var h = e.time - f.time;
            return 0 === h ? e.order - f.order : h
        });
        for (var c = g.q(a.u), d = c.next(); !d.done; d = c.next())
            d = d.value,
            a.time = d.time,
            0 === d.type ? wEa(a, d.IA, d.JA, b) : 1 === d.type && a.B & 496 && vEa(a.F, d.IA, d.JA, b);
        a.u.length = 0
    }
      , D3 = function() {
        this.type = 0
    }
      , E3 = function() {
        this.state = this.Pj = this.Wk = 0
    }
      , yEa = function() {
        this.timestamp = this.u = 0
    }
      , F3 = function(a) {
        this.F = a;
        this.C = [];
        this.u = this.B = this.row = 0;
        this.style = new D3;
        for (a = this.D = 0; 15 >= a; a++) {
            this.C[a] = [];
            for (var b = 0; 32 >= b; b++)
                this.C[a][b] = new yEa
        }
    }
      , G3 = function(a, b) {
        if (3 === a.style.type) {
            for (var c = 0, d = 0, e = a.F.time + 0, f = "", h = "", l = e, m = 1; 15 >= m; ++m) {
                for (var n = !1, p = d ? d : 1; 32 >= p; ++p) {
                    var r = a.C[m][p];
                    if (0 !== r.u) {
                        0 === c && (c = m,
                        d = p);
                        n = String.fromCharCode(r.u);
                        var t = r.timestamp;
                        t < e && (e = t);
                        r.timestamp = l;
                        h && (f += h,
                        h = "");
                        f += n;
                        n = !0
                    }
                    if ((0 === r.u || 32 === p) && n) {
                        h = "\n";
                        break
                    } else if (d && !n)
                        break
                }
                if (c && !n)
                    break
            }
            f && b.F(c, d, e, l, f)
        } else
            for (d = c = 0,
            f = e = a.F.time + 0,
            h = 1; 15 >= h; ++h)
                for (l = "",
                m = 1; 32 >= m; ++m)
                    if (p = a.C[h][m],
                    r = p.u,
                    0 !== r && (0 === c && (c = h,
                    d = m),
                    n = String.fromCharCode(r),
                    t = p.timestamp,
                    t <= e && (e = t),
                    l += n,
                    p.reset()),
                    32 === m || 0 === r)
                        l && b.F(c, d, e, f, l),
                        e = f,
                        l = "",
                        d = c = 0
    }
      , DEa = function(a, b) {
        switch (a) {
        case 0:
            return zEa[(b & 127) - 32];
        case 1:
            return AEa[b & 15];
        case 2:
            return BEa[b & 31];
        case 3:
            return CEa[b & 31]
        }
        return 0
    }
      , H3 = function(a) {
        return a.C[a.row][a.B]
    }
      , I3 = function(a, b, c) {
        2 <= b && 1 < a.B && (--a.B,
        H3(a).u = 0);
        var d = H3(a);
        d.timestamp = a.F.time + 0;
        d.u = DEa(b, c);
        32 > a.B && a.B++
    }
      , EEa = function(a, b, c, d) {
        for (var e = 0; e < d; e++)
            for (var f = 0; 32 >= f; f++) {
                var h = a.C[b + e][f]
                  , l = a.C[c + e][f];
                h.u = l.u;
                h.timestamp = l.timestamp
            }
    }
      , J3 = function(a, b, c) {
        for (var d = 0; d < c; d++)
            for (var e = 0; 32 >= e; e++)
                a.C[b + d][e].reset()
    }
      , K3 = function(a) {
        a.row = 0 < a.u ? a.u : 1;
        a.B = 1;
        J3(a, 0, 15)
    }
      , L3 = function(a) {
        this.C = a;
        this.F = 0;
        this.style = new D3;
        this.I = new F3(this.C);
        this.K = new F3(this.C);
        this.text = new F3(this.C);
        this.B = this.I;
        this.D = this.K;
        this.u = this.B
    }
      , M3 = function(a, b, c) {
        var d = a.B
          , e = !1;
        switch (a.style.get()) {
        case 4:
        case 1:
        case 2:
            4 === a.style.get() && 0 < d.u || (G3(d, c),
            K3(a.B),
            K3(a.D),
            d.row = 15,
            d.u = b,
            e = !0)
        }
        a.style.set(3);
        a.u = d;
        a.u.style = a.style;
        a.C.mode = 1 << d.D;
        e ? d.B = 1 : d.u !== b && (d.u > b ? (G3(d, c),
        J3(d, d.row - d.u, b)) : d.row < b && (b = d.u),
        d.u = b)
    }
      , FEa = function(a) {
        a.style.set(1);
        a.u = a.D;
        a.u.u = 0;
        a.u.style = a.style;
        a.C.mode = 1 << a.u.D
    }
      , GEa = function(a) {
        a.style.set(4);
        a.u = a.text;
        a.u.style = a.style;
        a.C.mode = 1 << a.u.D
    }
      , B3 = function(a) {
        this.B = a;
        this.F = 0;
        this.C = new L3(this.B);
        this.I = new L3(this.B);
        this.u = new E3;
        this.D = this.C
    }
      , vEa = function(a, b, c, d) {
        a.u.update();
        b = uEa(b, c, a.u);
        switch (b.result) {
        case 0:
            return;
        case 1:
        case 2:
            return
        }
        var e = b.Wk;
        c = b.Pj;
        if (32 <= e || !e)
            a.B.mode & a.B.B && (b = e,
            b & 128 && (b = 127),
            c & 128 && (c = 127),
            a = a.D.u,
            b & 96 && I3(a, 0, b),
            c & 96 && I3(a, 0, c),
            0 !== b && 0 !== c && 3 === a.style.type && G3(a, d));
        else if (e & 16)
            a: if (!a.u.matches(e, c) && (b = a.u,
            b.Wk = e,
            b.Pj = c,
            b.state = 2,
            b = e & 8 ? a.I : a.C,
            a.D = b,
            a.B.mode = 1 << (a.F << 2) + (b.F << 1) + (4 === b.style.type ? 1 : 0),
            (a.B.mode | 1 << (a.F << 2) + (b.F << 1) + (4 !== b.style.type ? 1 : 0)) & a.B.B))
                if (c & 64) {
                    d = [11, 11, 1, 2, 3, 4, 12, 13, 14, 15, 5, 6, 7, 8, 9, 10][(e & 7) << 1 | c >> 5 & 1];
                    a = c & 16 ? 4 * ((c & 14) >> 1) : 0;
                    c = b.u;
                    switch (b.style.get()) {
                    case 4:
                        d = c.row;
                        break;
                    case 3:
                        if (d !== c.row) {
                            if (d < c.u && (d = c.u,
                            d === c.row))
                                break;
                            var f = 1 + c.row - c.u
                              , h = 1 + d - c.u;
                            EEa(c, h, f, c.u);
                            b = f;
                            e = c.u;
                            h < f ? (f = h + e - f,
                            0 < f && (b += f,
                            e -= f)) : (f = f + e - h,
                            0 < f && (e -= f));
                            J3(c, b, e)
                        }
                    }
                    c.row = d;
                    c.B = a + 1
                } else
                    switch (e & 7) {
                    case 1:
                        switch (c & 112) {
                        case 32:
                            I3(b.u, 0, 32);
                            break a;
                        case 48:
                            57 === c ? (d = b.u,
                            H3(d).u = 0,
                            32 > d.B && d.B++) : I3(b.u, 1, c & 15)
                        }
                        break;
                    case 2:
                        c & 32 && I3(b.u, 2, c & 31);
                        break;
                    case 3:
                        c & 32 && I3(b.u, 3, c & 31);
                        break;
                    case 4:
                    case 5:
                        if (32 <= c && 47 >= c)
                            switch (c) {
                            case 32:
                                FEa(b);
                                break;
                            case 33:
                                d = b.u;
                                1 < d.B && (--d.B,
                                H3(d).u = 0);
                                break;
                            case 36:
                                d = b.u;
                                b = H3(d);
                                for (a = 0; 15 >= a; a++)
                                    for (c = 0; 32 >= c; c++)
                                        if (d.C[a][c] === b) {
                                            for (; 32 >= c; c++)
                                                d.C[a][c].reset();
                                            break
                                        }
                                break;
                            case 37:
                                M3(b, 2, d);
                                break;
                            case 38:
                                M3(b, 3, d);
                                break;
                            case 39:
                                M3(b, 4, d);
                                break;
                            case 40:
                                I3(b.u, 0, 32);
                                break;
                            case 41:
                                b.style.set(2);
                                b.u = b.B;
                                b.u.u = 0;
                                b.u.style = b.style;
                                b.C.mode = 1 << b.u.D;
                                break;
                            case 42:
                                d = b.text;
                                d.u = 15;
                                d.style.set(4);
                                K3(d);
                                GEa(b);
                                break;
                            case 43:
                                GEa(b);
                                break;
                            case 44:
                                a = b.B;
                                switch (b.style.get()) {
                                case 1:
                                case 2:
                                case 3:
                                    G3(a, d)
                                }
                                J3(a, 0, 15);
                                break;
                            case 45:
                                b: {
                                    a = b.u;
                                    switch (b.style.get()) {
                                    default:
                                    case 2:
                                    case 1:
                                        break b;
                                    case 4:
                                        if (15 > a.row) {
                                            ++a.row;
                                            a.B = 1;
                                            break b
                                        }
                                    case 3:
                                    }
                                    2 > a.u && (a.u = 2,
                                    a.row < a.u && (a.row = a.u));
                                    b = a.row - a.u + 1;
                                    G3(a, d);
                                    EEa(a, b, b + 1, a.u - 1);
                                    J3(a, a.row, 1)
                                }
                                break;
                            case 46:
                                J3(b.D, 0, 15);
                                break;
                            case 47:
                                G3(b.B, d),
                                b.D.updateTime(b.C.time + 0),
                                d = b.D,
                                b.D = b.B,
                                b.B = d,
                                FEa(b)
                            }
                        break;
                    case 7:
                        switch (c) {
                        case 33:
                        case 34:
                        case 35:
                            d = b.u,
                            32 < (d.B += c & 3) && (d.B = 32)
                        }
                    }
    }
      , HEa = function() {}
      , N3 = function(a, b, c) {
        this.N = a;
        this.K = c;
        this.version = this.I = this.D = this.u = 0;
        this.B = new DataView(this.N);
        this.C = []
    }
      , O3 = function(a) {
        var b = a.u;
        a.u += 1;
        return a.B.getUint8(b)
    }
      , P3 = function(a) {
        var b = a.u;
        a.u += 4;
        return a.B.getUint32(b)
    }
      , Q3 = function(a, b) {
        s3.call(this);
        this.B = a;
        this.D = b;
        this.track = "CC3" === this.D.languageName ? 4 : 0;
        this.u = new C3;
        this.u.B = 1 << this.track
    }
      , R3 = function(a) {
        if ("string" === typeof a)
            return !1;
        a = new N3(a,8,0);
        return IEa(a)
    }
      , IEa = function(a) {
        if (!(a.u < a.B.byteLength) || 1380139777 !== P3(a))
            return !1;
        a.version = O3(a);
        if (1 < a.version)
            return !1;
        O3(a);
        O3(a);
        O3(a);
        return !0
    }
      , S3 = function() {
        s3.call(this)
    }
      , JEa = function(a, b, c, d, e, f, h, l, m) {
        switch (h.tagName) {
        case "b":
            l.bold = !0;
            break;
        case "i":
            l.kh = !0;
            break;
        case "u":
            l.underline = !0
        }
        for (var n = 0; n < h.childNodes.length; n++) {
            var p = h.childNodes[n];
            if (3 === p.nodeType)
                p = new p3(b,c,d,e.id,p.nodeValue,f || 0 < n,g.Wb(l) ? void 0 : l),
                m.push(p),
                e.u.push(p);
            else {
                var r = {};
                g.Xa(r, l);
                JEa(a, b, c, d, e, !0, p, r, m)
            }
        }
    }
      , T3 = function(a) {
        var b = a.split(":");
        a = 0;
        b = g.q(b);
        for (var c = b.next(); !c.done; c = b.next())
            a = 60 * a + Number(c.value);
        return 1E3 * a
    }
      , KEa = function(a, b, c, d) {
        d = Object.assign({
            gn: 0
        }, d);
        return new q3(a,b,c,"_" + r3++,d)
    }
      , U3 = function(a) {
        g.B.call(this);
        this.B = a;
        this.u = null
    }
      , MEa = function(a) {
        var b = {};
        if (a = e3(a))
            b.lang = a,
            LEa.test(a) && (b.u = 1);
        return b
    }
      , X3 = function(a) {
        g.pS.call(this, a);
        this.J = a;
        this.C = this.J.T();
        this.videoData = this.J.getVideoData();
        this.Na = g.pG(this.J);
        this.D = {
            sc: {}
        };
        this.F = {
            sc: {}
        };
        this.W = [];
        this.P = {};
        this.ka = {};
        this.ba = !1;
        this.Ga = g.Twa(this.videoData, this.J);
        this.Qa = !!this.videoData.captionTracks.length;
        this.Za = !!this.videoData.vo;
        this.za = "3" === this.C.controlsType;
        this.B = this.K = this.N = this.ha = this.Aa = null;
        this.ra = new U3(this.C);
        this.u = null;
        this.ea = new g.Wr(this);
        var b = null
          , c = g.io("yt-html5-player-modules::subtitlesModuleData");
        c && (b = new g.Sn(c));
        this.storage = b;
        b = a.app.F;
        c = !(!b || !b.xq());
        this.Ja = !(!b || !b.fm());
        this.I = this.za && c && !this.Ga;
        this.Y = !this.I && this.za && this.Ja && this.Ga;
        g.C(this, this.ra);
        this.I ? this.da = this.X = null : (this.X = new g.qn(this.BG,void 0,this),
        g.C(this, this.X),
        this.da = new g.H(this.CQ,2E3,this),
        g.C(this, this.da));
        g.C(this, this.ea);
        this.I || this.ea.R(a, "resize", this.mz);
        this.ea.R(a, "onPlaybackAudioChange", this.UM);
        this.ea.R(a, g.wD("captions"), this.dL, this);
        this.ea.R(a, g.xD("captions"), this.eL, this);
        V3(this, W3(this, "display-settings") || {})
    }
      , NEa = function(a) {
        if (1 === a.C.Ri || 1 === a.videoData.Ri || "alwayson" === g.BF(a.videoData, "yt:cc"))
            return !0;
        if (2 === a.C.Ri) {
            var b = W3(a, "module-enabled");
            if (null != b)
                return !!b
        }
        if (a.videoData.captionTracks.length)
            var c = a.player.getAudioTrack().C;
        return "ON" === c || "on" === g.BF(a.videoData, "yt:cc")
    }
      , Y3 = function(a, b) {
        if (a.u && (void 0 === b || !b) || !a.videoData.captionTracks.length)
            return !1;
        var c = a.player.getAudioTrack();
        return !!c.B || "FORCED_ON" === c.C
    }
      , OEa = function(a) {
        var b = !1
          , c = g.Or(g.Mr.getInstance(), 65);
        g.qC(a.C) && null != c && (b = !c);
        return b
    }
      , PEa = function(a) {
        return a.za ? a.I || a.Y : OEa(a) || Y3(a) ? !0 : NEa(a)
    }
      , $3 = function(a, b) {
        if (a.B) {
            if (a.K && a.K.F)
                return a.K.F;
            var c = b;
            c || (c = a.Za ? !1 : a.Qa ? !1 : !0);
            c = a.B.wl(c);
            for (var d = [a.videoData.captionsLanguagePreference, a.C.captionsLanguagePreference, g.BF(a.videoData, "yt:cc_default_lang")], e = 0; e < d.length; e++)
                for (var f = 0; f < c.length; f++)
                    if (e3(c[f]) === d[e])
                        return c[f];
            return a.K && a.K.D ? a.K.D : (d = c.find(function(h) {
                return h.isDefault
            })) ? d : c[0] || Z3(a)
        }
        return null
    }
      , Z3 = function(a) {
        return a.K && a.K.B
    }
      , a4 = function(a) {
        var b = Z3(a);
        return !!b && a.u === b
    }
      , QEa = function(a, b) {
        for (var c = a.J.app.F.Ma().textTracks, d = a.u.toString(), e = 0; e < c.length; e++) {
            var f = c[e];
            f.id === d && (b ? "showing" !== f.mode && (f.mode = "showing") : "showing" === f.mode && (f.mode = "disabled"))
        }
    }
      , c4 = function(a, b, c) {
        a.loaded && a.unload();
        null != c && (a.ba = c,
        a.ba && b4(a, "module-enabled", !!b));
        a.u = b;
        Y3(a) && (a.u = Z3(a));
        a.load()
    }
      , REa = function(a, b) {
        var c = a.Na.getVideoContentRect(!0).height;
        if (!c)
            return null;
        var d = a.u ? a.u.languageCode : null;
        !b.params.u && d && LEa.test(d) && (b.params.u = 1);
        d = a.Na.getPlayerSize();
        switch (null != b.params.gn ? b.params.gn : 1 < b.u.length ? 1 : 0) {
        case 1:
            return new n3(b,a.D,a.F,c,d.width,d.height,a.C.experiments);
        case 2:
            return new o3(b,a.D,a.F,c,d.width,d.height,a.C.experiments);
        default:
            return new m3(b,a.D,a.F,c,d.width,d.height,a.C.experiments)
        }
    }
      , V3 = function(a, b, c) {
        c = void 0 === c ? !1 : c;
        var d = d4.sc;
        a.D = {};
        g.Xa(a.D, d4);
        a.D.sc = {};
        g.Xa(a.D.sc, d);
        a.F = {
            sc: {}
        };
        var e = b.backgroundOverride ? a.F : a.D
          , f = b.background || d.background;
        x3.test(f);
        e.sc.background = f;
        e = b.colorOverride ? a.F : a.D;
        f = b.color || d.color;
        x3.test(f);
        e.sc.color = f;
        e = b.windowColorOverride ? a.F : a.D;
        f = b.windowColor || d4.windowColor;
        x3.test(f);
        e.windowColor = f;
        e = b.backgroundOpacityOverride ? a.F : a.D;
        f = b.backgroundOpacity;
        null == f && (f = d.backgroundOpacity);
        e.sc.backgroundOpacity = f;
        e = b.fontSizeIncrementOverride ? a.F : a.D;
        f = b.fontSizeIncrement;
        null == f && (f = d.fontSizeIncrement);
        e.sc.fontSizeIncrement = f;
        f = b.fontStyleOverride ? a.F : a.D;
        e = b.fontStyle;
        null == e && (e = d.bold && d.kh ? 3 : d.bold ? 1 : d.kh ? 2 : 0);
        f = f.sc;
        switch (e) {
        case 1:
            f.bold = !0;
            delete f.kh;
            break;
        case 2:
            delete f.bold;
            f.kh = !0;
            break;
        case 3:
            f.bold = !0;
            f.kh = !0;
            break;
        default:
            delete f.bold,
            delete f.kh
        }
        e = b.textOpacityOverride ? a.F : a.D;
        f = b.textOpacity;
        null == f && (f = d.textOpacity);
        e.sc.textOpacity = f;
        e = b.windowOpacityOverride ? a.F : a.D;
        f = b.windowOpacity;
        null == f && (f = d4.windowOpacity);
        e.windowOpacity = f;
        e = b.charEdgeStyleOverride ? a.F : a.D;
        f = b.charEdgeStyle;
        null == f && (f = d.charEdgeStyle);
        e.sc.charEdgeStyle = f;
        e = b.fontFamilyOverride ? a.F : a.D;
        f = b.fontFamily;
        null == f && (f = d.fontFamily);
        e.sc.fontFamily = f;
        a.loaded && a.mz();
        c && b4(a, "display-settings", b)
    }
      , TEa = function(a, b) {
        if (b && !a.N) {
            var c = mEa({
                u: 0,
                lang: "en-GB"
            });
            a.N = [c, new p3(c.start,c.end - c.start,0,c.id,"Captions look like this")];
            g.GM(a.player, a.N)
        } else
            !b && a.N && (SEa(a, a.N),
            a.N = null)
    }
      , SEa = function(a, b) {
        g.HM(a.player.app, b, void 0);
        g.Gb(b, function(c) {
            g.rb(this.W, c)
        }, a);
        a.X.xb()
    }
      , W3 = function(a, b) {
        if (!a.storage)
            return null;
        try {
            var c = a.storage.get(b)
        } catch (d) {
            a.storage.remove(b)
        }
        return c
    }
      , b4 = function(a, b, c) {
        if (a.storage)
            try {
                a.storage.set(b, c)
            } catch (d) {}
    };
    g.DS.prototype.yo = g.ca(11, function() {
        for (var a = g.pe(document, "track", void 0, this.u), b = 0; b < a.length; b++)
            g.Je(a[b])
    });
    g.ES.prototype.yo = g.ca(10, function() {
        this.u.yo()
    });
    g.DS.prototype.xq = g.ca(9, function() {
        return !!this.u.textTracks
    });
    g.ES.prototype.xq = g.ca(8, function() {
        return this.u.xq()
    });
    g.DS.prototype.mo = g.ca(7, function(a) {
        for (var b = 0; b < a.length; b++)
            this.u.appendChild(a[b])
    });
    g.ES.prototype.mo = g.ca(6, function(a) {
        this.u.mo(a)
    });
    g.xS.prototype.fm = g.ca(5, function() {});
    g.DS.prototype.fm = g.ca(4, function() {
        return !(!this.u.textTracks || !this.u.textTracks.addEventListener)
    });
    g.ES.prototype.fm = g.ca(3, function() {
        return this.u.fm()
    });
    g.$v.prototype.Zr = g.ca(1, function() {
        return 0
    });
    g.oz.prototype.Zr = g.ca(0, function(a) {
        return (a = this.Yh(a)) ? a.B : 0
    });
    var LEa = /^(ar|ckb|dv|he|iw|fa|nqo|ps|sd|ug|ur|yi|.*[-_](Adlm|Arab|Hebr|Nkoo|Rohg|Thaa))(?!.*[-_](Latn|Cyrl)($|-|_))($|-|_)/i;
    VDa.prototype.wl = function(a) {
        return a ? this.u.concat(this.B) : this.u
    }
    ;
    g.u(g3, g.B);
    g.k = g3.prototype;
    g.k.wl = function(a) {
        return this.B.wl(a)
    }
    ;
    g.k.Rs = function() {}
    ;
    g.k.Ss = function() {}
    ;
    g.k.Fj = function() {}
    ;
    g.k.Qm = function() {
        return ""
    }
    ;
    g.k.mF = function() {
        return !1
    }
    ;
    g.k.aa = function() {
        this.Fj();
        g.B.prototype.aa.call(this)
    }
    ;
    g.u(h3, g3);
    h3.prototype.Rs = function(a, b, c) {
        var d = this;
        this.la();
        b = this.Qm(a, b);
        this.Fj();
        this.u = g.oq(b, {
            format: "RAW",
            onSuccess: function(e) {
                d.u = null;
                c(e.responseText, a)
            },
            withCredentials: !0
        })
    }
    ;
    h3.prototype.Ss = function(a) {
        if (this.audioTrack)
            for (var b = g.q(this.audioTrack.captionTracks), c = b.next(); !c.done; c = b.next())
                f3(this.B, c.value);
        a()
    }
    ;
    h3.prototype.Qm = function(a, b) {
        var c = a.nd()
          , d = {
            fmt: b
        };
        if ("srv3" === b || "3" === b || "json3" === b)
            g.bk() ? Object.assign(d, {
                xorb: 2,
                xobt: 1,
                xovt: 1
            }) : Object.assign(d, {
                xorb: 2,
                xobt: 3,
                xovt: 3
            });
        a.translationLanguage && (d.tlang = e3(a));
        return g.Zp(c, d)
    }
    ;
    h3.prototype.Fj = function() {
        this.u && this.u.abort()
    }
    ;
    i3.prototype.contains = function(a) {
        a = g.Ab(this.segments, a);
        return 0 <= a || 0 > a && 1 === (-a - 1) % 2
    }
    ;
    i3.prototype.length = function() {
        return this.segments.length / 2
    }
    ;
    g.u(j3, g.B);
    g.k = j3.prototype;
    g.k.aa = function() {
        g.B.prototype.aa.call(this);
        this.B && this.B.cancel()
    }
    ;
    g.k.qD = function() {
        this.seekTo(this.player.getCurrentTime())
    }
    ;
    g.k.seekTo = function(a) {
        a -= this.player.lc();
        var b = this.u;
        this.u = g.gb(this.W.dj(a).u);
        b !== this.u && this.N && this.N()
    }
    ;
    g.k.reset = function() {
        this.D = new i3;
        this.B && (this.B.cancel(),
        this.B = null)
    }
    ;
    g.k.NC = function() {
        this.la();
        var a;
        if (a = null != this.u)
            a = this.u,
            a = a.u.uj(a);
        !a || this.B || this.u && 30 < this.u.startTime - this.player.getCurrentTime() || (a = this.u.bk(),
        a.u[0].duration ? (this.D.contains(a.u[0].B) || YDa(this, a),
        this.u = g.gb(a.u)) : !g.R(this.P.experiments, "force_caption_seek_for_live_killswitch") && this.u && this.u.I && this.u.I + this.player.lc() < this.player.getCurrentTime() && this.seekTo(this.player.getCurrentTime()));
        this.K.start()
    }
    ;
    g.u(k3, g3);
    g.k = k3.prototype;
    g.k.Rs = function(a, b, c) {
        var d = this;
        this.Fj();
        b = $Da(this, a.getId());
        b || (b = a.languageCode,
        b = this.ma.isManifestless ? aEa(this, b, "386") : aEa(this, b));
        if (b) {
            var e = 1E3 * (b.index.Zr(b.index.bh()) - b.index.Ae(b.index.bh()));
            this.u = new j3(new g.Yu,this.J,b,function(f, h) {
                c(f, a, h, e)
            }
            ,this.F || g.Ou(b.info),function() {
                d.u && d.u.reset();
                d.C = !0
            }
            )
        }
    }
    ;
    g.k.mF = function() {
        var a = this.C;
        this.C = !1;
        return a
    }
    ;
    g.k.Ss = function(a) {
        var b;
        this.F ? b = [new g.xE({
            id: "rawcc",
            languageCode: "rawcc",
            languageName: "CC1",
            is_servable: !0,
            is_default: !0,
            is_translateable: !1,
            vss_id: ".en"
        }), new g.xE({
            id: "rawcc",
            languageCode: "rawcc",
            languageName: "CC3",
            is_servable: !0,
            is_default: !0,
            is_translateable: !1,
            vss_id: ".en"
        })] : b = this.ma.isManifestless ? ZDa(this, "386") : ZDa(this);
        b = g.q(b);
        for (var c = b.next(); !c.done; c = b.next())
            f3(this.B, c.value);
        a()
    }
    ;
    g.k.Fj = function() {
        this.u && (this.u.dispose(),
        this.u = null)
    }
    ;
    g.k.Qm = function() {
        return ""
    }
    ;
    g.u(l3, g3);
    l3.prototype.Rs = function(a, b, c) {
        var d = this;
        this.la();
        b = this.Qm(a, b);
        this.Fj();
        this.u = g.oq(b, {
            format: "RAW",
            onSuccess: function(e) {
                d.u = null;
                c(e.responseText, a)
            },
            withCredentials: !0
        })
    }
    ;
    l3.prototype.Ss = function(a) {
        var b = this
          , c = this.C
          , d = {
            type: "list",
            tlangs: 1,
            v: this.videoId,
            vssids: 1
        };
        this.mC && (d.asrs = 1);
        c = g.Zp(c, d);
        this.Fj();
        this.u = g.oq(c, {
            format: "RAW",
            onSuccess: function(e) {
                b.u = null;
                if ((e = e.responseXML) && e.firstChild) {
                    for (var f = e.getElementsByTagName("track"), h = 0; h < f.length; h++) {
                        var l = f[h]
                          , m = l.getAttribute("lang_code")
                          , n = l.getAttribute("lang_translated")
                          , p = l.getAttribute("name")
                          , r = l.getAttribute("kind")
                          , t = l.getAttribute("id")
                          , w = "true" === l.getAttribute("lang_default")
                          , x = "true" === l.getAttribute("cantran");
                        l = l.getAttribute("vss_id");
                        f3(b.B, new g.xE({
                            languageCode: m,
                            languageName: n,
                            name: p,
                            kind: r,
                            id: t,
                            is_servable: !0,
                            is_translateable: x,
                            vss_id: l,
                            is_default: w
                        }))
                    }
                    e = e.getElementsByTagName("target");
                    f = e.length;
                    for (h = 0; h < f; h++)
                        m = {
                            languageCode: e[h].getAttribute("lang_code"),
                            languageName: e[h].getAttribute("lang_translated"),
                            languageOriginal: e[h].getAttribute("lang_original"),
                            id: e[h].getAttribute("id"),
                            isDefault: "true" === e[h].getAttribute("lang_default")
                        },
                        b.F[m.languageCode] = m.languageName,
                        b.D.push(m)
                }
                a()
            },
            withCredentials: !0
        })
    }
    ;
    l3.prototype.Qm = function(a, b) {
        var c = this.C
          , d = {
            v: this.videoId,
            type: "track",
            lang: a.languageCode,
            name: a.getName(),
            kind: a.kind,
            fmt: b
        };
        a.translationLanguage && (d.tlang = e3(a));
        return c = g.Zp(c, d)
    }
    ;
    l3.prototype.Fj = function() {
        this.u && this.u.abort()
    }
    ;
    var x3 = /^#(?:[0-9a-f]{3}){1,2}$/i;
    var cEa = ["left", "right", "center", "justify"];
    g.u(m3, g.V);
    g.k = m3.prototype;
    g.k.cL = function(a, b) {
        var c = g.Cg(this.element, this.element.parentElement);
        this.za = a - c.x;
        this.Ga = b - c.y;
        g.I(this.element, "ytp-dragging")
    }
    ;
    g.k.bL = function(a, b) {
        var c = g.Eg(this.element)
          , d = a - this.za - .02 * this.playerWidth
          , e = b - this.Ga - .02 * this.playerHeight
          , f = (d + c.width / 2) / this.maxWidth * 3;
        f = Math.floor(g.be(f, 0, 2));
        var h = (e + c.height / 2) / this.Ja * 3;
        h = Math.floor(g.be(h, 0, 2));
        var l = f + 3 * h;
        d = (d + f / 2 * c.width) / this.maxWidth;
        d = 100 * g.be(d, 0, 1);
        c = (e + h / 2 * c.height) / this.Ja;
        c = 100 * g.be(c, 0, 1);
        this.B.params.Rg = l;
        this.B.params.Ih = c;
        this.B.params.fg = d;
        this.u.Rg = l;
        this.u.Ih = c;
        this.u.fg = d;
        this.SF()
    }
    ;
    g.k.aL = function() {
        g.Bn(this.element, "ytp-dragging")
    }
    ;
    g.k.SF = function() {
        this.dm(this.F)
    }
    ;
    g.k.dm = function(a) {
        var b = Math.min(this.FB(), this.maxWidth)
          , c = this.EB()
          , d = "";
        3 === this.B.params.u && (d = "rotate(180deg)");
        g.E(this.element, {
            top: 0,
            left: 0,
            right: "",
            bottom: "",
            width: b ? b + "px" : "",
            height: c ? c + "px" : "",
            "max-width": "96%",
            "max-height": "96%",
            margin: "",
            transform: ""
        });
        this.xv(a);
        a = {
            transform: d,
            top: "",
            left: "",
            width: b ? b + "px" : "",
            height: c ? c + "px" : "",
            "max-width": "",
            "max-height": ""
        };
        var e = .96 * this.u.fg + 2;
        d = this.u.Rg;
        switch (d) {
        case 0:
        case 3:
        case 6:
            b = this.u.sc.fontSizeIncrement;
            !g.R(this.experiments, "web_player_ignore_left_percentage_for_large_font_killswitch") && b && 2 < b && 2 !== this.u.u && 3 !== this.u.u && (e = 2);
            a.left = e + "%";
            break;
        case 1:
        case 4:
        case 7:
            a.left = e + "%";
            e = this.D.offsetWidth;
            b || e ? (b = b || e + 1,
            a.width = b + "px",
            a["margin-left"] = b / -2 + "px") : a.transform += " translateX(-50%)";
            break;
        case 2:
        case 5:
        case 8:
            a.right = 100 - e + "%"
        }
        b = .96 * this.u.Ih + 2;
        switch (d) {
        case 0:
        case 1:
        case 2:
            a.top = b + "%";
            break;
        case 3:
        case 4:
        case 5:
            a.top = b + "%";
            (c = c || this.element.clientHeight) ? (a.height = c + "px",
            a["margin-top"] = c / -2 + "px") : a.transform += " translateY(-50%)";
            break;
        case 6:
        case 7:
        case 8:
            a.bottom = 100 - b + "%"
        }
        g.E(this.element, a)
    }
    ;
    g.k.xv = function(a) {
        var b;
        for (b = 0; b < a.length && a[b] === this.F[b]; b++)
            ;
        if (this.Y || this.F.length > b)
            b = 0,
            this.Y = !1,
            this.F = [],
            this.I = this.ea = this.ba = null,
            g.He(this.D);
        for (; b < a.length; b++)
            gEa(this, a[b])
    }
    ;
    g.k.FB = function() {
        return 0
    }
    ;
    g.k.EB = function() {
        return 0
    }
    ;
    g.k.toString = function() {
        return g.V.prototype.toString.call(this)
    }
    ;
    g.u(n3, m3);
    n3.prototype.xv = function(a) {
        var b = this.B.u;
        m3.prototype.xv.call(this, a);
        for (a = a.length; a < b.length; a++) {
            var c = b[a];
            if (f && c.u === e)
                var d = f;
            else {
                d = {};
                g.Xa(d, c.u);
                g.Xa(d, UEa);
                var e = c.u;
                var f = d
            }
            gEa(this, c, d)
        }
    }
    ;
    var UEa = {
        EJ: !0
    };
    g.u(o3, m3);
    g.k = o3.prototype;
    g.k.SF = function() {
        g.tn(this.ka)
    }
    ;
    g.k.fP = function() {
        g.Bn(this.element, "ytp-rollup-mode");
        this.dm(this.nb, !0)
    }
    ;
    g.k.EB = function() {
        return this.C ? this.W : this.P
    }
    ;
    g.k.FB = function() {
        return this.C ? this.P : this.W
    }
    ;
    g.k.dm = function(a, b) {
        this.nb = a;
        if (this.B.params.B) {
            for (var c = 0, d = 0; d < this.F.length && c < a.length; d++)
                this.F[d] === a[c] && c++;
            0 < c && c < a.length && (a = this.F.concat(a.slice(c)));
            this.Na = this.W;
            this.P = this.W = 0;
            m3.prototype.dm.call(this, a);
            lEa(this, b);
            m3.prototype.dm.call(this, a)
        } else
            m3.prototype.dm.call(this, a)
    }
    ;
    g.u(p3, g.tD);
    p3.prototype.toString = function() {
        return g.tD.prototype.toString.call(this)
    }
    ;
    g.u(q3, g.tD);
    q3.prototype.toString = function() {
        return g.tD.prototype.toString.call(this)
    }
    ;
    var r3 = 0;
    g.u(s3, g.B);
    s3.prototype.C = function() {
        return []
    }
    ;
    s3.prototype.reset = function() {}
    ;
    g.u(t3, s3);
    t3.prototype.reset = function() {
        this.N = {};
        this.B = this.u = null;
        this.K = !0
    }
    ;
    t3.prototype.C = function(a, b) {
        var c = a.firstChild;
        c.getAttribute("format");
        b = b || 0;
        Number.isFinite(b);
        c = Array.from(c.childNodes);
        c = g.q(c);
        for (var d = c.next(); !d.done; d = c.next())
            if (d = d.value,
            1 === d.nodeType)
                switch (d.tagName) {
                case "head":
                    var e = d;
                    break;
                case "body":
                    var f = d
                }
        if (e)
            for (e = Array.from(e.childNodes),
            e = g.q(e),
            c = e.next(); !c.done; c = e.next())
                if (c = c.value,
                1 === c.nodeType)
                    switch (c.tagName) {
                    case "pen":
                        d = c.getAttribute("id");
                        var h = this.D
                          , l = {}
                          , m = c.getAttribute("p");
                        m && g.Xa(l, this.D[m]);
                        m = v3(c, "b");
                        null != m && (l.bold = m);
                        m = v3(c, "i");
                        null != m && (l.kh = m);
                        m = v3(c, "u");
                        null != m && (l.underline = m);
                        m = w3(c, "et");
                        null != m && (l.charEdgeStyle = m);
                        m = w3(c, "of");
                        null != m && (l.offset = m);
                        m = y3(c, "bc");
                        null != m && (l.background = m);
                        m = y3(c, "ec");
                        null != m && (l.Kv = m);
                        m = y3(c, "fc");
                        null != m && (l.color = m);
                        m = w3(c, "fs");
                        null != m && 0 !== m && (l.fontFamily = m);
                        m = u3(c, "sz");
                        void 0 !== m && (l.fontSizeIncrement = m / 100 - 1);
                        m = u3(c, "bo");
                        void 0 !== m && (l.backgroundOpacity = m / 255);
                        m = u3(c, "fo");
                        void 0 !== m && (l.textOpacity = m / 255);
                        m = w3(c, "rb");
                        null != m && 10 !== m && 0 !== m && (l.Xc = 10 < m ? m - 1 : m);
                        c = w3(c, "hg");
                        null != c && (l.iC = c);
                        h[d] = l;
                        break;
                    case "ws":
                        d = c.getAttribute("id");
                        this.W[d] = pEa(this, c);
                        break;
                    case "wp":
                        d = c.getAttribute("id"),
                        this.P[d] = qEa(this, c)
                    }
        if (f) {
            e = b;
            c = [];
            f = Array.from(f.childNodes);
            f = g.q(f);
            for (d = f.next(); !d.done; d = f.next())
                if (d = d.value,
                1 === d.nodeType)
                    switch (d.tagName) {
                    case "w":
                        this.u = rEa(this, d, e, !1);
                        (d = this.N[this.u.id]) && d.end > this.u.start && (d.end = this.u.start);
                        this.N[this.u.id] = this.u;
                        c.push(this.u);
                        break;
                    case "p":
                        var n = e;
                        h = [];
                        l = d.getAttribute("w") || this.F;
                        m = !!v3(d, "a");
                        n = (u3(d, "t") || 0) + n;
                        var p = u3(d, "d") || 5E3;
                        m || (!this.K && this.B && this.B.windowId === l && this.B.end > n && (this.B.end = n),
                        this.B && "\n" === this.B.text && (this.B.text = ""));
                        var r = m ? 6 : 5
                          , t = d.getAttribute("p");
                        t = t ? this.D[t] : null;
                        var w = Array.from(d.childNodes);
                        w.length && (this.K = null != d.getAttribute("d"));
                        for (var x = 0; x < w.length; x++) {
                            var y = w[x]
                              , D = void 0;
                            0 < x && (m = !0);
                            var F = void 0;
                            1 === y.nodeType && (F = y);
                            if (F && "s" === F.tagName) {
                                if ((y = (y = F.getAttribute("p")) ? this.D[y] : null) && y.Xc && (1 === y.Xc ? (y = w.slice(x, x + 4),
                                4 === y.length && (D = oEa(n, p, l, m, r, y, this.D),
                                x += 3)) : D = oEa(n, p, l, m, r, [F], this.D)),
                                !D) {
                                    var G = F;
                                    D = n;
                                    F = p;
                                    y = l;
                                    var O = m
                                      , K = r
                                      , Ja = G.textContent ? G.textContent : ""
                                      , va = G.getAttribute("p");
                                    va = va ? this.D[va] : null;
                                    G = u3(G, "t") || 0;
                                    D = new p3(D + G,F - G,K,y,Ja,O,va)
                                }
                            } else
                                D = new p3(n,p,r,l,y.textContent || "",m,t);
                            h.push(D);
                            this.B = D
                        }
                        if (0 < h.length)
                            for (h[0].windowId === this.F && (this.u = rEa(this, d, e, !0),
                            c.push(this.u)),
                            d = g.q(h),
                            h = d.next(); !h.done; h = d.next())
                                h = h.value,
                                h.windowId = this.u.id,
                                this.u.u.push(h),
                                c.push(h)
                    }
            e = c
        } else
            e = [];
        return e
    }
    ;
    var VEa = new Map([[9, 1], [10, 1], [11, 2], [12, 3], [13, 4], [14, 5]]);
    g.u(z3, s3);
    z3.prototype.reset = function() {
        this.B.clear()
    }
    ;
    z3.prototype.C = function(a, b) {
        var c = JSON.parse(a);
        if (!c)
            return [];
        if (c.pens)
            for (var d = 0, e = g.q(c.pens), f = e.next(); !f.done; f = e.next()) {
                f = f.value;
                var h = {}
                  , l = f.pParentId;
                l && Object.assign(h, this.u.get(l));
                f.bAttr && (h.bold = !0);
                f.iAttr && (h.kh = !0);
                f.uAttr && (h.underline = !0);
                l = f.ofOffset;
                null != l && (h.offset = l);
                void 0 !== f.szPenSize && (h.fontSizeIncrement = f.szPenSize / 100 - 1);
                l = f.etEdgeType;
                null != l && (h.charEdgeStyle = l);
                void 0 !== f.ecEdgeColor && (h.Kv = A3(f.ecEdgeColor));
                l = f.fsFontStyle;
                null != l && 0 !== l && (h.fontFamily = l);
                void 0 !== f.fcForeColor && (h.color = A3(f.fcForeColor));
                void 0 !== f.foForeAlpha && (h.textOpacity = f.foForeAlpha / 255);
                void 0 !== f.bcBackColor && (h.background = A3(f.bcBackColor));
                void 0 !== f.boBackAlpha && (h.backgroundOpacity = f.boBackAlpha / 255);
                (l = f.rbRuby) && 10 !== l && (h.Xc = 10 < l ? l - 1 : l,
                h.Fh = VEa.get(h.Xc));
                f.hgHorizGroup && (h.iC = f.hgHorizGroup);
                this.u.set(d++, h)
            }
        if (c.wsWinStyles)
            for (d = 0,
            e = g.q(c.wsWinStyles),
            f = e.next(); !f.done; f = e.next())
                f = f.value,
                h = {},
                (l = f.wsParentId) ? Object.assign(h, this.F.get(l)) : Object.assign(h, this.I),
                void 0 !== f.mhModeHint && (h.gn = f.mhModeHint),
                void 0 !== f.juJustifCode && (h.textAlign = f.juJustifCode),
                void 0 !== f.pdPrintDir && (h.u = f.pdPrintDir),
                void 0 !== f.sdScrollDir && (h.C = f.sdScrollDir),
                void 0 !== f.wfcWinFillColor && (h.windowColor = A3(f.wfcWinFillColor)),
                void 0 !== f.wfoWinFillAlpha && (h.windowOpacity = f.wfoWinFillAlpha / 255),
                this.F.set(d++, h);
        if (c.wpWinPositions)
            for (d = 0,
            e = g.q(c.wpWinPositions),
            f = e.next(); !f.done; f = e.next())
                f = f.value,
                h = {},
                (l = f.wpParentId) && Object.assign(h, this.D.get(l)),
                void 0 !== f.ahHorPos && (h.fg = f.ahHorPos),
                void 0 !== f.apPoint && (h.Rg = f.apPoint),
                void 0 !== f.avVerPos && (h.Ih = f.avVerPos),
                void 0 !== f.ccCols && (h.Tj = f.ccCols),
                void 0 !== f.rcRows && (h.B = f.rcRows),
                this.D.set(d++, h);
        if (c.events)
            for (d = [],
            c = g.q(c.events),
            e = c.next(); !e.done; e = c.next()) {
                var m = e.value;
                e = (m.tStartMs || 0) + b;
                f = m.dDurationMs || 0;
                if (m.id)
                    h = String(m.id),
                    e = sEa(this, m, e, f, h),
                    d.push(e),
                    this.B.set(h, e);
                else {
                    m.wWinId ? h = m.wWinId.toString() : (h = "_" + r3++,
                    l = sEa(this, m, e, f, h),
                    d.push(l),
                    this.B.set(h, l));
                    0 === f && (f = 5E3);
                    l = this.B.get(h);
                    var n = !!m.aAppend
                      , p = n ? 6 : 5
                      , r = m.segs
                      , t = null;
                    m.pPenId && (t = this.u.get(m.pPenId));
                    for (m = 0; m < r.length; m++) {
                        var w = r[m]
                          , x = w.utf8;
                        if (x) {
                            var y = w.tOffsetMs || 0
                              , D = null;
                            w.pPenId && (D = this.u.get(w.pPenId));
                            if (2 === (null != l.params.gn ? l.params.gn : 1 < l.u.length ? 1 : 0) && n && "\n" === x)
                                continue;
                            if (w = D && 1 === D.Xc)
                                if (w = m,
                                w + 3 >= r.length || !r[w + 1].pPenId || !r[w + 2].pPenId || !r[w + 3].pPenId)
                                    w = !1;
                                else {
                                    var F = r[w + 1].pPenId;
                                    (F = this.u.get(F)) && F.Xc && 2 === F.Xc ? (F = r[w + 2].pPenId,
                                    F = this.u.get(F),
                                    !F || !F.Xc || 3 > F.Xc ? w = !1 : (F = r[w + 3].pPenId,
                                    w = (F = this.u.get(F)) && F.Xc && 2 === F.Xc ? !0 : !1)) : w = !1
                                }
                            if (w) {
                                y = r[m + 1].utf8;
                                w = r[m + 3].utf8;
                                F = r[m + 2].utf8;
                                var G = this.u.get(r[m + 2].pPenId);
                                x = nEa(x, y, F, w, G);
                                n = new p3(e,f,p,h,x,n,D);
                                m += 3
                            } else
                                n = new p3(e + y,f - y,p,l.id,x,n,D || t);
                            n && (d.push(n),
                            l.u.push(n))
                        }
                        n = !0
                    }
                }
            }
        else
            d = [];
        return d
    }
    ;
    C3.prototype.clear = function() {
        this.C = this.time = this.mode = 0;
        this.u = [];
        this.reset()
    }
    ;
    C3.prototype.reset = function() {
        this.mode = 0;
        this.D.reset(0);
        this.F.reset(1)
    }
    ;
    var tEa = [128, 1, 2, 131, 4, 133, 134, 7, 8, 137, 138, 11, 140, 13, 14, 143, 16, 145, 146, 19, 148, 21, 22, 151, 152, 25, 26, 155, 28, 157, 158, 31, 32, 161, 162, 35, 164, 37, 38, 167, 168, 41, 42, 171, 44, 173, 174, 47, 176, 49, 50, 179, 52, 181, 182, 55, 56, 185, 186, 59, 188, 61, 62, 191, 64, 193, 194, 67, 196, 69, 70, 199, 200, 73, 74, 203, 76, 205, 206, 79, 208, 81, 82, 211, 84, 213, 214, 87, 88, 217, 218, 91, 220, 93, 94, 223, 224, 97, 98, 227, 100, 229, 230, 103, 104, 233, 234, 107, 236, 109, 110, 239, 112, 241, 242, 115, 244, 117, 118, 247, 248, 121, 122, 251, 124, 253, 254, 127, 0, 129, 130, 3, 132, 5, 6, 135, 136, 9, 10, 139, 12, 141, 142, 15, 144, 17, 18, 147, 20, 149, 150, 23, 24, 153, 154, 27, 156, 29, 30, 159, 160, 33, 34, 163, 36, 165, 166, 39, 40, 169, 170, 43, 172, 45, 46, 175, 48, 177, 178, 51, 180, 53, 54, 183, 184, 57, 58, 187, 60, 189, 190, 63, 192, 65, 66, 195, 68, 197, 198, 71, 72, 201, 202, 75, 204, 77, 78, 207, 80, 209, 210, 83, 212, 85, 86, 215, 216, 89, 90, 219, 92, 221, 222, 95, 96, 225, 226, 99, 228, 101, 102, 231, 232, 105, 106, 235, 108, 237, 238, 111, 240, 113, 114, 243, 116, 245, 246, 119, 120, 249, 250, 123, 252, 125, 126, 255];
    D3.prototype.set = function(a) {
        this.type = a
    }
    ;
    D3.prototype.get = function() {
        return this.type
    }
    ;
    E3.prototype.clear = function() {
        this.state = 0
    }
    ;
    E3.prototype.update = function() {
        this.state = 2 === this.state ? 1 : 0
    }
    ;
    E3.prototype.isValid = function() {
        return 0 !== this.state
    }
    ;
    E3.prototype.matches = function(a, b) {
        return this.isValid() && a === this.Wk && b === this.Pj
    }
    ;
    yEa.prototype.reset = function() {
        this.timestamp = this.u = 0
    }
    ;
    F3.prototype.updateTime = function(a) {
        for (var b = 1; 15 >= b; ++b)
            for (var c = 1; 32 >= c; ++c)
                this.C[b][c].timestamp = a
    }
    ;
    F3.prototype.debugString = function() {
        for (var a = "\n", b = 1; 15 >= b; ++b) {
            for (var c = 1; 32 >= c; ++c) {
                var d = this.C[b][c];
                a = 0 === d.u ? a + "_" : a + String.fromCharCode(d.u)
            }
            a += "\n"
        }
        return a
    }
    ;
    F3.prototype.reset = function(a) {
        for (var b = 0; 15 >= b; b++)
            for (var c = 0; 32 >= c; c++)
                this.C[b][c].reset();
        this.D = a;
        this.u = 0;
        this.B = this.row = 1
    }
    ;
    var zEa = [32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 225, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 233, 93, 237, 243, 250, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 231, 247, 209, 241, 9632]
      , AEa = [174, 176, 189, 191, 8482, 162, 163, 9834, 224, 32, 232, 226, 234, 238, 244, 251]
      , BEa = [193, 201, 211, 218, 220, 252, 8216, 161, 42, 39, 9473, 169, 8480, 183, 8220, 8221, 192, 194, 199, 200, 202, 203, 235, 206, 207, 239, 212, 217, 249, 219, 171, 187]
      , CEa = [195, 227, 205, 204, 236, 210, 242, 213, 245, 123, 125, 92, 94, 95, 124, 126, 196, 228, 214, 246, 223, 165, 164, 9475, 197, 229, 216, 248, 9487, 9491, 9495, 9499];
    L3.prototype.reset = function(a, b) {
        this.F = b;
        this.style.set(2);
        this.B = this.I;
        this.D = this.K;
        this.u = this.B;
        var c = (a << 2) + (b << 1);
        this.I.reset(c);
        this.K.reset(c);
        this.text.reset((a << 2) + (b << 1) + 1)
    }
    ;
    B3.prototype.reset = function(a) {
        this.F = a;
        this.u.clear();
        this.D = this.C;
        this.C.reset(a, 0);
        this.I.reset(a, 1)
    }
    ;
    HEa.prototype.F = function() {}
    ;
    g.u(N3, HEa);
    N3.prototype.F = function(a, b, c, d, e) {
        if (c < d) {
            var f = "_" + r3++;
            c = c / 1E3 - this.K;
            d = d / 1E3 - this.K;
            a = new q3(c,d - c,5,f,{
                textAlign: 0,
                Rg: 0,
                fg: 2.5 * b,
                Ih: 5.33 * a
            });
            e = new p3(c,d - c,5,f,e);
            this.C.push(a);
            this.C.push(e)
        }
    }
    ;
    g.u(Q3, s3);
    Q3.prototype.C = function(a) {
        a = new N3(a,a.byteLength,this.B);
        if (IEa(a)) {
            for (; a.u < a.B.byteLength; )
                for (0 === a.version ? a.D = P3(a) * (1E3 / 45) : 1 === a.version && (a.D = 4294967296 * P3(a) + P3(a)),
                a.I = O3(a); 0 < a.I; a.I--) {
                    var b = O3(a)
                      , c = O3(a)
                      , d = O3(a);
                    b & 4 && (b & 3) === this.track && (0 === this.track || 1 === this.track) && (b = this.u,
                    b.u.push({
                        time: a.D,
                        type: this.track,
                        IA: c,
                        JA: d,
                        order: b.u.length
                    }))
                }
            xEa(this.u, a);
            return a.C
        }
        return []
    }
    ;
    Q3.prototype.reset = function() {
        this.u.clear()
    }
    ;
    g.u(S3, s3);
    S3.prototype.C = function(a, b) {
        for (var c = [], d = a.split(WEa), e = 1; e < d.length; e++) {
            var f = d[e]
              , h = b;
            if ("" !== f && !XEa.test(f)) {
                var l = e4.exec(f);
                if (l && 4 <= l.length) {
                    var m = T3(l[1])
                      , n = T3(l[2]) - m;
                    m += h;
                    var p = (l = l[3]) ? l.split(" ") : [];
                    l = {};
                    var r = null
                      , t = ""
                      , w = null
                      , x = "";
                    l.textAlign = 2;
                    p = g.q(p);
                    for (var y = p.next(); !y.done; y = p.next())
                        if (y = y.value.split(":"),
                        2 === y.length) {
                            var D = y[1];
                            switch (y[0]) {
                            case "line":
                                y = D.split(",");
                                y[0].endsWith("%") && (r = y[0],
                                l.Ih = Number.parseInt(r, 10),
                                2 === y.length && (t = y[1].trim()));
                                break;
                            case "position":
                                y = D.split(",");
                                w = y[0];
                                l.fg = Number.parseInt(w, 10);
                                2 === y.length && (x = y[1].trim());
                                break;
                            case "align":
                                switch (D) {
                                case "start":
                                    l.textAlign = 0;
                                    break;
                                case "middle":
                                    l.textAlign = 2;
                                    break;
                                case "end":
                                    l.textAlign = 1
                                }
                            }
                        }
                    r || (l.Ih = 100,
                    t || (t = "end"));
                    if (!w)
                        switch (l.textAlign) {
                        case 0:
                            l.fg = 0;
                            break;
                        case 1:
                            l.fg = 100;
                            break;
                        default:
                            l.fg = 50
                        }
                    r = 0;
                    switch (t) {
                    case "center":
                        r += 3;
                        break;
                    case "end":
                        r += 6;
                        break;
                    default:
                        r += 0
                    }
                    switch (x) {
                    case "line-left":
                        r += 0;
                        break;
                    case "center":
                        r += 1;
                        break;
                    case "line-right":
                        r += 2;
                        break;
                    default:
                        switch (l.textAlign) {
                        case 0:
                            r += 0;
                            break;
                        case 2:
                            r += 1;
                            break;
                        case 1:
                            r += 2
                        }
                    }
                    l.Rg = 0 > r || 8 < r ? 7 : r;
                    f = f.substring(e4.lastIndex).replace(/[\x01-\x09\x0b-\x1f]/g, "");
                    x = l;
                    l = f;
                    f = {};
                    if (0 > l.indexOf("<") && 0 > l.indexOf("&"))
                        h = KEa(m, n, 5, x),
                        n = new p3(m,n,5,h.id,l,!1,g.Wb(f) ? void 0 : f),
                        c.push(h),
                        c.push(n),
                        h.u.push(n);
                    else
                        for (t = l.split(YEa),
                        1 === t.length ? (l = 5,
                        x = KEa(m, n, l, x)) : (r = l = 6,
                        x = Object.assign({
                            Tj: 32
                        }, x),
                        x = new q3(m,n,r,"_" + r3++,x)),
                        c.push(x),
                        r = m,
                        w = 0; w < t.length; w++)
                            p = t[w],
                            0 === w % 2 ? (y = g.U0("<html>" + p + "</html>"),
                            y.getElementsByTagName("parsererror").length ? (D = y.createElement("span"),
                            D.appendChild(y.createTextNode(p))) : D = y.firstChild,
                            JEa(this, r, n - (r - m), l, x, 0 < w, D, f, c)) : r = T3(p) + h
                }
                e4.lastIndex = 0
            }
        }
        return c
    }
    ;
    var XEa = /^NOTE/
      , WEa = /(?:\r\n|\r|\n){2,}/
      , e4 = RegExp("^((?:[\\d]{2}:)?[\\d]{2}:[\\d]{2}\\.[\\d]{3})[\\t ]+--\x3e[\\t ]+((?:[\\d]{2}:)?[\\d]{2}:[\\d]{2}\\.[\\d]{3})(?:[\\t ]*)(.*)(?:\\r\\n|\\r|\\n)", "gm")
      , YEa = /<((?:[\d]{2}:)?[\d]{2}:[\d]{2}\.[\d]{3})>/;
    g.u(U3, g.B);
    U3.prototype.clear = function() {
        this.u && this.u.dispose();
        this.u = null
    }
    ;
    U3.prototype.reset = function() {
        this.u && this.u.reset()
    }
    ;
    U3.prototype.aa = function() {
        g.B.prototype.aa.call(this);
        this.clear()
    }
    ;
    var d4 = {
        windowColor: "#080808",
        windowOpacity: 0,
        textAlign: 2,
        Rg: 7,
        fg: 50,
        Ih: 100,
        sc: {
            background: "#080808",
            backgroundOpacity: .75,
            charEdgeStyle: 0,
            color: "#fff",
            fontFamily: 4,
            fontSizeIncrement: 0,
            textOpacity: 1,
            offset: 1
        }
    };
    g.u(X3, g.pS);
    g.k = X3.prototype;
    g.k.aa = function() {
        if (this.I || this.Y) {
            var a = this.J.app.F;
            a && !a.la() && a.yo()
        } else
            TEa(this, !1);
        g.pS.prototype.aa.call(this)
    }
    ;
    g.k.load = function() {
        var a = this;
        g.pS.prototype.load.call(this);
        var b = !g.R(this.C.experiments, "web_player_captions_track_list_changed_killswitch");
        this.K = this.player.getAudioTrack();
        if (this.B)
            this.u && (this.ra.clear(),
            this.I ? QEa(this, !0) : 3 !== this.player.getPresentingPlayerType() && this.B.Rs(this.u, "json3", function(d, e, f, h) {
                if (d) {
                    a.B.mF() && (a.W = [],
                    g.cX(a.J, "captions"),
                    a.X.xb(),
                    a.ra.reset());
                    var l = a.ra;
                    f = f || 0;
                    h = h || 0;
                    if (l.B.ca("html5_disable_rawcc_killswitch")) {
                        if ("string" !== typeof d) {
                            var m = new DataView(d);
                            8 <= m.byteLength && 1718909296 === m.getUint32(4) && (m = g.xt(m, 0, 1835295092),
                            d = d.slice(m.dataOffset, m.dataOffset + m.size),
                            R3(d) || (d = g.We(new Uint8Array(d))))
                        }
                    } else
                        "string" === typeof d || R3(d) || (m = new DataView(d),
                        d = 8 >= m.byteLength || 1718909296 !== m.getUint32(4) ? "" : (m = g.xt(m, 0, 1835295092)) && m.size ? g.We(new Uint8Array(d.slice(m.dataOffset, m.dataOffset + m.size))) : "");
                    if (d)
                        try {
                            if ("string" !== typeof d) {
                                var n = d
                                  , p = f
                                  , r = h;
                                if (!R3(n))
                                    throw Error("Invalid binary caption track data");
                                l.u || (l.u = new Q3(r,e));
                                var t = l.u.C(n, p)
                            } else {
                                if ("WEBVTT" === d.substring(0, 6))
                                    e = d,
                                    r = f,
                                    l.u || (l.u = new S3),
                                    p = l.u.C(e, r),
                                    .01 > Math.random() && g.lr(Error("Deprecated subtitles format in web player: WebVTT")),
                                    n = p;
                                else
                                    b: {
                                        p = d;
                                        if ("{" === p[0])
                                            try {
                                                l.u || (l.u = new z3(MEa(e)));
                                                n = l.u.C(p, f);
                                                break b
                                            } catch (G) {
                                                g.kr(G);
                                                n = [];
                                                break b
                                            }
                                        r = g.U0(p);
                                        if (!r || !r.firstChild) {
                                            var w = Error("Invalid caption track data");
                                            w.params = p;
                                            throw w;
                                        }
                                        if ("timedtext" === r.firstChild.tagName) {
                                            if (3 === Number(r.firstChild.getAttribute("format"))) {
                                                l.u || (l.u = new t3(MEa(e),l.B));
                                                n = l.u.C(r, f);
                                                break b
                                            }
                                            var x = Error("Unsupported subtitles format in web player (Format2)");
                                            x.params = p;
                                            throw x;
                                        }
                                        if ("transcript" === r.firstChild.tagName) {
                                            var y = Error("Unsupported subtitles format in web player (Format1)");
                                            y.params = p;
                                            throw y;
                                        }
                                        var D = Error("Invalid caption track data");
                                        D.params = p;
                                        throw D;
                                    }
                                t = n
                            }
                            var F = t
                        } catch (G) {
                            g.kr(G),
                            l.clear(),
                            F = []
                        }
                    else
                        F = [];
                    g.GM(a.player, F);
                    !a.ba || a.Y || a4(a) || g.$B(a.C) || g.aC(a.C) || (a.da.vg(),
                    F = mEa({
                        Rg: 0,
                        fg: 5,
                        Ih: 5,
                        B: 2,
                        textAlign: 0,
                        u: 0,
                        lang: "en-GB"
                    }),
                    a.ha = [F],
                    l = ["Click ", " for settings"],
                    a.Aa || (t = new g.TM(g.DN()),
                    g.C(a, t),
                    a.Aa = t.element),
                    t = F.end - F.start,
                    (e = g.yE(a.u)) && a.ha.push(new p3(F.start,t,0,F.id,e)),
                    a.ha.push(new p3(F.start,t,0,F.id,l[0]), new p3(F.start,t,0,F.id,a.Aa,!0), new p3(F.start,t,0,F.id,l[1],!0)),
                    g.GM(a.player, a.ha),
                    a.da.xb());
                    !a.ba || a.Y || a4(a) || (b4(a, "module-enabled", !0),
                    a.K && (a.K.F = a.u),
                    (F = g.Z(a.player.app)) && g.OT(F.I));
                    a.ba = !1
                }
            }),
            !b || this.I || this.Y || a4(this) || this.player.va("captionschanged", d3(this.u))),
            b || (this.u && !a4(this) ? this.player.va("captionschanged", d3(this.u)) : this.player.va("onCaptionsTrackListChanged"));
        else {
            var c;
            this.Ga ? c = new k3(this.videoData.ma,this.player) : this.Qa ? c = new h3(this.C,this.videoData,this.player.getAudioTrack()) : c = new l3(this.videoData.vo,this.videoData.videoId,this.videoData.captionsLanguagePreference || this.C.captionsLanguagePreference || g.BF(this.videoData, "yt:cc_default_lang") || this.C.oe,this.videoData.Gv,this.C);
            this.B = c;
            g.C(this, this.B);
            c.Ss(function() {
                var d;
                OEa(a) || a.ba || NEa(a) ? d = $3(a, a.ba) : Y3(a) && (d = Z3(a));
                if (a.I || a.Y) {
                    for (var e = a.B.wl(!0), f = [], h = 0; h < e.length; h++) {
                        var l = e[h]
                          , m = g.Ee("TRACK");
                        m.setAttribute("kind", "subtitles");
                        m.setAttribute("label", g.yE(l));
                        m.setAttribute("srclang", e3(l));
                        m.setAttribute("id", l.toString());
                        a.Y || m.setAttribute("src", a.B.Qm(l, "vtt"));
                        l === d && m.setAttribute("default", "1");
                        f.push(m)
                    }
                    d = a.J.app.F;
                    d.mo(f);
                    f = d.Ma();
                    a.Ja && a.ea.R(f.textTracks, "change", a.GP)
                } else
                    !a.u && d && c4(a, d),
                    a.player.va("onCaptionsTrackListChanged"),
                    a.player.va("onApiChange")
            })
        }
    }
    ;
    g.k.unload = function() {
        this.I && this.u ? QEa(this, !1) : (this.da && this.da.vg(),
        g.cX(this.player, "captions"),
        this.W = [],
        this.B && this.B.Fj(),
        this.ra.clear(),
        this.N && g.GM(this.player, this.N),
        this.mz());
        g.pS.prototype.unload.call(this);
        var a = g.Z(this.player.app);
        a && g.OT(a.I);
        this.player.va("captionschanged", {})
    }
    ;
    g.k.create = function() {
        PEa(this) && this.load()
    }
    ;
    g.k.GP = function() {
        for (var a = this.J.app.F.Ma().textTracks, b = null, c = 0; c < a.length; c++)
            if ("showing" === a[c].mode)
                a: {
                    b = a[c].id;
                    for (var d = this.B.wl(!0), e = 0; e < d.length; e++)
                        if (d[e].toString() === b) {
                            b = d[e];
                            break a
                        }
                    b = null
                }
        (this.loaded ? this.u : null) !== b && c4(this, b, !0)
    }
    ;
    g.k.oR = function() {
        !this.u && this.I || this.unload()
    }
    ;
    g.k.dL = function(a) {
        this.W.push(a);
        this.X.xb()
    }
    ;
    g.k.eL = function(a) {
        g.rb(this.W, a);
        this.B instanceof k3 && this.B.F && g.HM(this.player.app, [a], void 0);
        this.X.xb()
    }
    ;
    g.k.vQ = function(a) {
        if (a instanceof q3) {
            var b = this.P[a.id];
            b && b.B !== a && (b.dispose(),
            delete this.P[a.id],
            b = null);
            b || (b = REa(this, a)) && (this.P[a.id] = b)
        } else
            b = a.windowId,
            this.ka[b] || (this.ka[b] = []),
            this.ka[b].push(a)
    }
    ;
    g.k.CQ = function() {
        SEa(this, this.ha);
        this.ha = null
    }
    ;
    g.k.BG = function() {
        var a = this;
        this.X.stop();
        g.Xb(this.ka);
        this.W.sort(g.vD);
        var b = this.W;
        if (this.N) {
            var c = g.Ke(b, function(d) {
                return -1 === this.N.indexOf(d)
            }, this);
            c.length && (b = c)
        }
        g.Gb(b, this.vQ, this);
        g.Ib(this.P, function(d, e) {
            a.ka[e] ? (d.element.parentNode || (d instanceof o3 || d instanceof n3 || g.Mb(a.P, function(f, h) {
                h !== e && f.B.params.Rg === d.B.params.Rg && f.B.params.fg === d.B.params.fg && f.B.params.Ih === d.B.params.Ih && (f.dispose(),
                delete a.P[h]);
                return h === e
            }, a),
            g.oP(a.player, d.element, 4)),
            d.dm(a.ka[e])) : (d.dispose(),
            delete a.P[e])
        }, this)
    }
    ;
    g.k.GQ = function() {
        V3(this, {}, !0);
        g.R(this.C.experiments, "web_player_disable_publish_captions_settings_changed_on_reset") || this.player.va("captionssettingschanged")
    }
    ;
    g.k.YI = function() {
        var a = d4.sc;
        a = {
            background: a.background,
            backgroundOpacity: a.backgroundOpacity,
            charEdgeStyle: a.charEdgeStyle,
            color: a.color,
            fontFamily: a.fontFamily,
            fontSizeIncrement: a.fontSizeIncrement,
            fontStyle: a.bold && a.kh ? 3 : a.bold ? 1 : a.kh ? 2 : 0,
            textOpacity: a.textOpacity,
            windowColor: d4.windowColor,
            windowOpacity: d4.windowOpacity
        };
        var b = W3(this, "display-settings") || {};
        null != b.background && (a.background = b.background);
        null != b.backgroundOverride && (a.backgroundOverride = b.backgroundOverride);
        null != b.backgroundOpacity && (a.backgroundOpacity = b.backgroundOpacity);
        null != b.backgroundOpacityOverride && (a.backgroundOpacityOverride = b.backgroundOpacityOverride);
        null != b.charEdgeStyle && (a.charEdgeStyle = b.charEdgeStyle);
        null != b.charEdgeStyleOverride && (a.charEdgeStyleOverride = b.charEdgeStyleOverride);
        null != b.color && (a.color = b.color);
        null != b.colorOverride && (a.colorOverride = b.colorOverride);
        null != b.fontFamily && (a.fontFamily = b.fontFamily);
        null != b.fontFamilyOverride && (a.fontFamilyOverride = b.fontFamilyOverride);
        null != b.fontSizeIncrement && (a.fontSizeIncrement = b.fontSizeIncrement);
        null != b.fontSizeIncrementOverride && (a.fontSizeIncrementOverride = b.fontSizeIncrementOverride);
        null != b.fontStyle && (a.fontStyle = b.fontStyle);
        null != b.fontStyleOverride && (a.fontStyleOverride = b.fontStyleOverride);
        null != b.textOpacity && (a.textOpacity = b.textOpacity);
        null != b.textOpacityOverride && (a.textOpacityOverride = b.textOpacityOverride);
        null != b.windowColor && (a.windowColor = b.windowColor);
        null != b.windowColorOverride && (a.windowColorOverride = b.windowColorOverride);
        null != b.windowOpacity && (a.windowOpacity = b.windowOpacity);
        null != b.windowOpacityOverride && (a.windowOpacityOverride = b.windowOpacityOverride);
        return a
    }
    ;
    g.k.IG = function(a, b) {
        var c = {};
        g.Xa(c, W3(this, "display-settings"));
        g.Xa(c, a);
        V3(this, c, b);
        this.player.va("captionssettingschanged")
    }
    ;
    g.k.mz = function() {
        !this.I && this.loaded && (g.Ib(this.P, function(a, b) {
            a.dispose();
            delete this.P[b]
        }, this),
        this.BG())
    }
    ;
    g.k.ee = function(a, b) {
        switch (a) {
        case "fontSize":
            if (isNaN(b))
                break;
            var c = g.be(b, -2, 4);
            this.IG({
                fontSizeIncrement: c
            });
            return c;
        case "reload":
            b && !this.I && c4(this, this.u, !0);
            break;
        case "stickyLoading":
            void 0 !== b && this.C.C && b4(this, "module-enabled", !!b);
            break;
        case "track":
            if (!this.B)
                return {};
            if (b) {
                if (this.I)
                    break;
                if (!g.Sa(b))
                    break;
                if (g.Wb(b)) {
                    c4(this, null, !0);
                    break
                }
                for (var d = this.B.wl(!0), e = 0; e < d.length; e++) {
                    var f = d[e];
                    f.languageCode !== b.languageCode || c && f.languageName !== b.languageName || (c = b.translationLanguage ? UDa(f, b.translationLanguage) : f)
                }
                !c || c === this.u && this.loaded || c4(this, c, !0)
            } else
                return this.loaded && this.u && !a4(this) ? d3(this.u) : {};
            return "";
        case "tracklist":
            return this.B ? g.Pc(this.B.wl(!(!b || !b.includeAsr)), function(h) {
                return d3(h)
            }) : [];
        case "translationLanguages":
            return this.B ? this.B.D.map(function(h) {
                return Object.assign({}, h)
            }) : [];
        case "sampleSubtitles":
            this.I || void 0 === b || TEa(this, !!b)
        }
    }
    ;
    g.k.getOptions = function() {
        var a = "reload fontSize track tracklist translationLanguages sampleSubtitle".split(" ");
        this.C.C && a.push("stickyLoading");
        return a
    }
    ;
    g.k.aK = function() {
        var a = this.u;
        return a ? {
            cc: a.vssId
        } : {}
    }
    ;
    g.k.fR = function() {
        this.loaded && this.u && !a4(this) ? (b4(this, "module-enabled", !1),
        this.unload(),
        Y3(this, !0) && c4(this, Z3(this), !1)) : c4(this, a4(this) || !this.u ? $3(this, !0) : this.u, !0)
    }
    ;
    g.k.UM = function() {
        var a = a4(this);
        Y3(this, a) ? c4(this, this.player.getAudioTrack().B, !1) : this.videoData.captionTracks.length && (this.loaded && this.unload(),
        PEa(this) && (a ? c4(this, $3(this), !1) : this.load()))
    }
    ;
    g.qX.captions = X3;
}
)(_yt_player);
