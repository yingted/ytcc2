/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {EditorState, EditorSelection, Transaction} from '@codemirror/next/state';
import {EditorView, keymap, Decoration, ViewPlugin, WidgetType} from '@codemirror/next/view';
import {defaultKeymap} from '@codemirror/next/commands';
import {history, historyKeymap} from '@codemirror/next/history';
import {indentService} from '@codemirror/next/language';
import {render, html} from 'lit-html';
import {
  empty,
  encodeJson3, encodeSrt, encodeSrv3, stripRaw,
  srtTextToHtml, srtTextToSpans, toSrtCues, fromSrtCues,
  decodeTimeSpaceFast as decodeTimeSpace, encodeTimeSpace,
} from 'ytcc2-captions';
import {RangeSetBuilder} from '@codemirror/next/rangeset';
import {StyleModule} from 'style-mod';
import {homeEndKeymap} from './codemirror_indent_keymap';
import {RangeSet} from '@codemirror/next/rangeset';
import {oneDark} from '@codemirror/next/theme-one-dark';
import {newUnsavedChanges} from './unsaved_changes.js';

function assert(cond) {
  console.assert(cond);
  if (!cond) debugger;
}

function captionToText({time, text, source}) {
  if (source !== undefined) return source;
  return encodeTimeSpace(time) + text.replace(/^(\d+:\d)/mg, " $1");
}
function textToCaption(textCaption) {
  let {time, offset} = decodeTimeSpace(textCaption);
  return {time, text: textCaption.substring(offset)};
}
function toText(captions) {
  return captions.map(captionToText).join('\n');
}
/**
 * Parse text to cues, skipping leading continuations.
 */
function textToCues(text) {
  let lines = text.split('\n');
  // {number} cues[i].from is the start index of the cue in text
  // {number} cues[i].to is the end index of the cue in text
  // {number} cues[i].time is when the cue is shown, in seconds
  // {number} cues[i].indent is how many characters of indent for continuations (e.g. '1:23.45 '.length)
  // {array<number>} cues[i].continuationOffsets[j] is the index of a continuation in text (e.g. '1:23.45 a\nb'.indexOf('b'))
  let cues = [];
  for (let i = 0, offset = 0; i < lines.length; offset += lines[i].length + 1, ++i) {
    // Decode this line:
    let timeOffset = decodeTimeSpace(lines[i]);
    if (timeOffset !== null) {
      // Time + text, so add a new cue:
      let {time, offset: indent} = timeOffset;

      cues.push({
        from: offset,
        to: offset + lines[i].length,
        time,
        indent,
        continuationOffsets: [],
      });
    } else if (cues.length > 0) {
      // Continuation, update the cue end:
      let lastCue = cues[cues.length - 1];
      lastCue.continuationOffsets.push(offset);
      lastCue.to = offset + lines[i].length;
    }
  }
  return cues;
}
function getOffset(state) {
  return state.selection.asSingle().ranges[0].head;
}

// Find an offset <= this time, aligned to a cue.
function timeToCueOffset(prologue, captions, time, next) {
  let curOffset = prologue.length;
  let nextOffset = prologue.length;
  // Find the last caption where caption.time <= time:
  for (let caption of captions) {
    let timeLength = captionToText({time: caption.time, text: ''}).length;
    curOffset += timeLength;
    if (caption.time > time) break;
    curOffset = nextOffset;
    nextOffset = curOffset + timeLength + caption.text.length + 1;
  }
  return next ? nextOffset : curOffset;
}
function timeToOffset(prologue, captions, time) {
  return timeToCueOffset(prologue, captions, time);
}
function getPrologue(doc, editableCaptions) {
  let docText = doc.toString();
  let captionsText = toText(editableCaptions);
  assert(docText.endsWith(captionsText));

  // Get the captions (numbers do not include "\n"):
  // Length of text before first caption:
  let prologueLength = docText.length - captionsText.length;
  let prologue = docText.substring(0, prologueLength);
  return prologue;
}

// Find a time when this offset would be rendered.
// We usually prefer earlier times, but for paused karaoke, we prefer later times.
// For simplicity, just prefer earlier times, as it's easier to play forwards than back.
function offsetToTime(prologue, captions, offset) {
  let curOffset = prologue.length;
  let curTime = 0;
  // Find the last time where curOffset <= offset:
  for (let caption of captions) {
    curTime = caption.time;
    let nextOffset = curOffset + captionToText(caption).length + 1;
    if (nextOffset > offset) break;
    curOffset = nextOffset;
  }
  return curTime;
}

class TemplateWidget extends WidgetType {
  constructor(template) {
    super(template);
    this._template = template;
  }
  toDOM(view) {
    let div = document.createElement('DIV');
    render(this._template, div);
    assert(div.firstElementChild === div.lastElementChild);
    return div.firstElementChild;
  }
}

class CaptionsHighlighter /*extends PluginValue*/ {
  static styleModule = EditorView.styleModule.of(new StyleModule({
    // All text (override CodeMirror style):
    '.cm-content': {
      'caret-color': 'auto !important',
    },
    // Unfortunately, CM dark selection is super hard to see.

    // Timestamps:
    '.cm-light .cm-content .cue-start-time': {
      color: '#444',
    },
    '.cm-dark .cm-content .cue-start-time': {
      color: '#ddd',
    },
    /* A little extra contrast: */
    '.cm-light .cm-content [x-caret-line] .cue-start-time': {
      color: '#000',
    },
    '.cm-dark .cm-content [x-caret-line] .cue-start-time': {
      color: '#fff',
    },

    // Indents (for continuations):
    '.cm-content .cue-continuation-indent': {
      // Fixed-width, like the time, which is the default:
      'font-family': 'monospace',
    },

    // Code tags:
    '.cm-light .cm-content .cue-span-tag': {
      color: '#00a',
    },
    '.cm-dark .cm-content .cue-span-tag': {
      color: '#ccf',
    },
    /* A little extra contrast: */
    '.cm-light .cm-content [x-caret-line] .cue-span-tag': {
      color: '#008',
    },
    '.cm-dark .cm-content [x-caret-line] .cue-span-tag': {
      color: '#ddf',
    },

    // Default captions text:
    '.cm-content .cue-span-text': {
      // YouTube-like fonts:
      'font-family': 'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, sans-serif',
    },

    // Current (caret) line:
    '.cm-light [x-caret-line]': {
      'background-color': '#ddd',
    },
    '.cm-dark [x-caret-line]': {
      'background-color': '#000',
    },
  }))
  constructor(view) {
    this.view = view;
    this.decorations = this._getDecorations(view);
  }
  /**
   * Convert SRT text to ranges.
   * @param {number} startIndex offset of text (added to all indices)
   * @param {string} srtText the raw SRT text
   * @return {array<Range<Decoration>>} styles relative to 
   */
  static srtTextToRanges(startIndex, srtText) {
    // @type {array<Range<Decoration>>}
    let ranges = [];

    let spans = srtTextToSpans(srtText);
    let textOffset = startIndex;
    for (let span of spans) {
      let nextTextOffset = textOffset + span.raw.length;

      // Check if it's text or not.
      if (span.text !== '') {
        // Text: build the CSS
        let style = '';
        for (let [k, v] of Object.entries(span.style)) {
          style += `${k}: ${v}; `;
        }
        ranges.push({
          from: textOffset,
          to: nextTextOffset,
          value: Decoration.mark({attributes: {class: 'cue-span-text', style}}),
        });
      } else {
        // Tag: style as a tag
        ranges.push({
          from: textOffset,
          to: nextTextOffset,
          value: Decoration.mark({class: 'cue-span-tag'}),
        });
      }

      textOffset = nextTextOffset;
    }

    return ranges;
  }
  /**
   * Get the previous line start.
   * If lineStart is 0 (BOF), returns null.
   * If the number is not a line start, implementation defined result.
   * @param {Document} doc
   * @param {number} lineStart the start of the current line (or doc.length for EOF)
   * @returns {null|number} the start of the previous line
   */
  static prevLine(doc, lineStart) {
    if (lineStart === 0) return null;
    return doc.lineAt(lineStart - 1).from;
  }
  /**
   * Get the next line start, or doc.length for EOF.
   * If lineStart is doc.length (EOF), returns null.
   * If the number is not a line start, implementation defined result.
   * @param {Document} doc
   * @param {number} lineStart the start of the current line
   * @returns {null|number} the start of the next line, or doc.length for EOF
   */
  static nextLine(doc, lineStart) {
    if (lineStart === doc.length) return null;
    let line = doc.lineAt(lineStart);
    if (line.to === doc.length) return doc.length;
    return line.to + 1;
  }
  _getDecorations(view) {
    // Syntax:
    // @type {array<Range<Decoration>>}
    let ranges = [];

    let doc = view.state.doc;
    for (let {from, to} of view.visibleRanges) {
      // Seek back to the nearest cue boundary:
      while (decodeTimeSpace(doc.lineAt(from).slice()) === null) {
        let prev = CaptionsHighlighter.prevLine(doc, from);
        if (prev === null) break;
        from = prev;
      }
      // Seek forward to the nearest cue boundary (not strictly needed):
      for (;;) {
        let next = CaptionsHighlighter.nextLine(doc, to);
        if (next === null) break;
        if (decodeTimeSpace(doc.lineAt(next).slice()) !== null) break
        to = next;
      }

      // List the cues:
      let text = doc.sliceString(from, to);
      let baseFrom = from;
      let cues = textToCues(text);

      // Convert each cue:
      for (let {from, to, time, indent, continuationOffsets} of cues) {
        // Style the time:
        ranges.push({
          from: baseFrom + from,
          to: baseFrom + from + indent,
          value: Decoration.mark({class: 'cue-start-time'}),
        });

        // Style the text:
        ranges.push.apply(
          ranges,
          CaptionsHighlighter.srtTextToRanges(
            baseFrom + from + indent,
            text.substring(from + indent, to)));

        // Indent each continuation:
        for (let offset of continuationOffsets) {
          ranges.push({
            from: baseFrom + offset,
            to: baseFrom + offset,
            value: Decoration.widget({
              widget: new TemplateWidget(html`<span class="cue-continuation-indent">${new Array(indent + 1).join(' ')}</span>`),
              side: -1,
              block: false,
            }),
          });
        }
      }
    }

    // Caret:
    let cursorLine = doc.lineAt(getOffset(view.state));
    ranges.push({
      from: cursorLine.from,
      to: cursorLine.from,
      value: Decoration.line({attributes: { 'x-caret-line': 'true' }}),
    });

    return RangeSet.of(ranges, /*sort=*/true);
  }
  update(update) {
    if (update.viewportChanged || update.docChanged || update.selectionSet) {
      this.decorations = this._getDecorations(update.view);
    }
  }
}
let captionsHighlighterExtension = [
  ViewPlugin.define(view => new CaptionsHighlighter(view), {
    decorations: v => v.decorations
  }),
  CaptionsHighlighter.styleModule,
];

/**
 * Caption editor for a video.
 * Properties:
 * - captions:
 *   - time and text
 * - captions source:
 *   - optional prologue (ending in "\n")
 *   - formatted cues
 *   - includes some invalid syntax (in `source`)
 * - player-only captions style, currently just karaoke timings
 *   - TODO: reconsider this, maybe render them as ⏲️ but copy as full text
 * Events:
 * - captions edit: propagate change to the player, preserving styles for untouched lines
 * - selection update: seek the player
 * - player seek: update the selection
 */
export class CaptionsEditor {
  /**
   * Create a captions editor for a video.
   * @param {YouTubeVideo} video 
   * @param {Srt.raw Track.t option} captions the initial captions, or undefined for empty
   */
  constructor(video, captions) {
    // Widgets:
    this.video = video;
    this.view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          history(),
          keymap([
            ...homeEndKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          captionsHighlighterExtension,
          EditorView.updateListener.of(this._onEditorUpdate.bind(this)),
          indentService.of((context, pos) => {
            let line = context.state.doc.lineAt(pos);
            let timeOffset = decodeTimeSpace(line.slice());
            if (timeOffset === null) {
              return 0;
            }
            return timeOffset.offset;
          }),
          // Force dark theme for now:
          oneDark,
        ],
      }),
    });

    // Event handlers:
    this._inSetCaptions = false;
    this._inOnVideoUpdate = false;
    this.video.addUpdateListener(this._onVideoUpdate.bind(this));
    this._unsavedChanges = newUnsavedChanges();

    // Initialize the captions:
    if (captions === undefined) {
      captions = empty;
    }
    this.setCaptions(captions, /*addToHistory=*/false, /*isSaved=*/true);
  }

  /**
   * Set the captions.
   * @param {Srt.raw Track.t} captions
   * @param {boolean} addToHistory
   * @param {boolean} isSaved
   */
  setCaptions(captions, addToHistory, isSaved) {
    this._inSetCaptions = true;
    {
      // {'raw Track.t} captions with style and karaoke, but no unknown tags
      // Used for rendering.
      this._rawCaptions = captions;
      // {array<{time: ..., text: ..., raw: ...}>} same as _rawCaptions, but as an array
      // Used for editing.
      this._editableCaptions = toSrtCues(this._rawCaptions);

      this.video.captions = this._rawCaptions;
      this.view.dispatch(this.view.state.update({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: toText(this._editableCaptions),
        },
        annotations: [
          Transaction.addToHistory.of(addToHistory),
        ],
      }));
    }
    this._inSetCaptions = false;

    if (isSaved) this._unsavedChanges.clear();
  }

  /**
   * Get the captions as SRT.
   * @returns {ArrayBuffer}
   */
  getSrtCaptions() {
    return encodeSrt(stripRaw(this._rawCaptions));
  }
  /**
   * Get the captions as json3.
   * @returns {ArrayBuffer}
   */
  getJson3Captions() {
    return encodeJson3(stripRaw(this._rawCaptions));
  }
  /**
   * Get the captions as srv3.
   * @returns {ArrayBuffer}
   */
  getSrv3Captions() {
    return encodeSrv3(stripRaw(this._rawCaptions));
  }
  /**
   * Reformat syntax and remove any hidden formatting.
   * This closes unclosed tags, converts ASS tags to HTML,
   * removes karaoke, and removes text before the first cue.
   */
  normalize() {
    // Remove raw anything:
    this.setCaptions(
      this._getNormalizedCaptions(),
      /*addToHistory=*/true, /*isSaved=*/false);
  }
  _getNormalizedCaptions() {
    return fromSrtCues(
      this._editableCaptions.map(({time, text}) =>
        textToCaption(captionToText({time, text}))));
  }
  /**
   * Get the normalized captions as SRT.
   * @returns {ArrayBuffer}
   */
  getNormalizedSrtCaptions() {
    return encodeSrt(this._getNormalizedCaptions());
  }
  /**
   * Add a new cue
   * @param {number} time
   * @param {string} text
   */
  addCue(time, text) {
    let offset = timeToCueOffset(this._getPrologue(), this._editableCaptions, time, true);
    let insert = captionToText({time, text}) + '\n';

    this.view.dispatch(this.view.state.update({
      changes: {
        from: offset,
        to: offset,
        insert,
      },
      selection: EditorSelection.single(offset + insert.length - 1),
      scrollIntoView: true,
    }));
  }
  _getPrologue() {
    return getPrologue(this.view.state.doc, this._editableCaptions);
  }

  _onEditorUpdate(update) {
    if (this._inSetCaptions) return;
    if (this._inOnVideoUpdate) return;

    // Update the captions if needed:
    if (update.docChanged) {
      this._unsavedChanges.set();

      // Get the sorted changes:
      // @type {{fromA: number, toA: number, textB: string}}
      let changes = [];
      update.changes.iterChanges((fromA, toA, fromB, toB, inserted) =>
        changes.push({fromA, toA, textB: inserted.sliceString(0)}));
      changes.sort((x, y) => (x.fromA > y.fromA) - (x.fromA < y.fromA));

      // Get the captions (numbers do not include "\n"):
      // @type {{fromA: number, toA: number, caption: {time: ..., text: ..., raw: ...}, text: string}}
      let captions = [];
      let prologue = getPrologue(update.prevState.doc, this._editableCaptions);
      if (prologue !== '' && prologue.length !== update.prevState.doc.length) {
        // Prologue and captions are both nonempty, remove the separator:
        assert(prologue[prologue.length - 1] === '\n');
        prologue = prologue.substring(0, prologue.length - 1);
      }
      let offset = prologue.length;
      for (let caption of this._editableCaptions) {
        // Get the range of this line
        let text = captionToText(caption);
        let endOffset = offset + text.length;
        captions.push({fromA: offset, toA: endOffset, caption, text});
        // Next offset comes after a newline, except for the last caption:
        offset = endOffset + 1;
      }

      // Apply all of the sorted changes, in reverse order:
      changes.reverse();
      let i = captions.length - 1;
      for (let change of changes) {
        let {fromA: from, toA: to, textB: insert} = change;
        // Delete [from, to), then add insert in the from position.

        // Find the indices of the affected captions:
        let affectedIndices = [];  // affected captions
        for (; i >= 0; --i) {
          let caption = captions[i];

          // Restrict to captions that touch the change:
          if (caption.fromA > to) continue;
          if (caption.toA < from) break;

          affectedIndices.push(i);
        }

        let minAffectedIndex;  // affected captions offset
        let fromA;  // affected chars offset
        let affectedA;  // affected chars
        if (affectedIndices.length > 0) {
          // Add one more, just in case:
          minAffectedIndex = affectedIndices[affectedIndices.length - 1];
          if (minAffectedIndex > 0) {
            // Add the previous caption:
            // TODO: don't do this if we don't need it
            affectedIndices.push(--minAffectedIndex);

            affectedIndices.reverse();

            // Get the new cues:
            fromA = captions[affectedIndices[0]].fromA;
            affectedA = affectedIndices.map(i => captions[i].text).join('\n');
          } else {
            // Add the prologue:
            affectedIndices.reverse();

            // Get the new cues:
            fromA = 0;
            affectedA = prologue + affectedIndices.map(i => captions[i].text).join('\n');
          }
        } else {
          // Add the prologue:
          minAffectedIndex = 0;
          fromA = 0;
          affectedA = prologue;
        }

        // console.log('updating affected range', {affectedA, fromA, affectedIndices, from, to, insert});

        let affectedB =
          affectedA.substring(0, from - fromA) +
          insert +
          affectedA.substring(to - fromA);
        let newCues = textToCues(affectedB);

        // Convert them back to captions, except without `raw`:
        let newCaptions = newCues.map(({from, to, time, indent}) => {
          return {
            fromA: fromA + from,
            toA: fromA + to,
            text: affectedB.substring(from, to),
            caption: {
              time,
              text: affectedB.substring(from + indent, to),
              source: affectedB.substring(from, to),
              // TODO: precompute raw here to avoid reparsing
            },
          };
        });

        assert(affectedA.endsWith(toText(
          captions.slice(
            minAffectedIndex,
            minAffectedIndex + affectedIndices.length)
          .map(c => c.caption))));
        assert(affectedB.endsWith(toText(newCaptions.map(c => c.caption))));

        // Put them back:
        captions.splice.apply(captions, [
          /*start=*/minAffectedIndex,
          /*deleteCount=*/affectedIndices.length,
        ].concat(newCaptions));
        i = minAffectedIndex + affectedIndices.length - 1;
      }

      // Commit the captions:
      this._editableCaptions = captions.map(c => c.caption);
      this._rawCaptions = fromSrtCues(this._editableCaptions);
      this.video.captions = this._rawCaptions;

      assert(update.state.doc.toString().endsWith(toText(this._editableCaptions)));
    }

    // Seek the video if needed:
    if (update.selectionSet) {
      let prevOffset = getOffset(update.prevState);
      let offset = getOffset(update.state);
      let prevTime = offsetToTime(this._getPrologue(), this._editableCaptions, prevOffset);
      let time = offsetToTime(this._getPrologue(), this._editableCaptions, offset);
      if (time !== prevTime) {
        this.video.seekTo(time);
      }
    }
  }

  _onVideoUpdate(time) {
    // Don't scroll the editor if we're focused on it.
    // This means we only focus once after seeking.
    if (this.view.hasFocus) return;
    this._inOnVideoUpdate = true;
    {
      let prevOffset = getOffset(this.view.state);
      let offset = timeToOffset(this._getPrologue(), this._editableCaptions, time);
      if (offset !== prevOffset) {
        // Scroll the current position into view:
        this.view.dispatch(this.view.state.update({
          selection: EditorSelection.single(offset),
          scrollIntoView: true,
        }));
      }
    }
    this._inOnVideoUpdate = false;
  }

  render() {
    let textbox = this.view.dom.querySelector('[role=textbox]');
    if (textbox !== null) {
      textbox.setAttribute('aria-label', 'Captions editor');
    }
    return html`
      <div style="height: 25em; width: 100%; overflow: auto;">
        ${this.view.dom}
      </div>
    `;
  }
}
