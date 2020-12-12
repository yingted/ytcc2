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

import {EditorState, EditorSelection, Transaction} from "@codemirror/next/state";
import {getIndentation} from "@codemirror/next/language";
import {insertNewline} from "@codemirror/next/commands";

/**
 * Get the new cursor position for a Home/End command.
 * @param {EditorView} view
 * @param {SelectionRange} start
 * @param {boolean} forward
 * @returns {SelectionRange}
 */
function moveByLineBoundary(view, start, forward) {
  // First, check if we prefer the wrap or line boundaries:
  let wrapCursor = view.moveToLineBoundary(start, forward, /*includeWrap=*/true);
  let cursor =
    start.head !== wrapCursor.head ?
    wrapCursor :
    view.moveToLineBoundary(start, forward, /*includeWrap=*/false);

  // Then, check if we prefer wrap/line or indent:
  // Indent boundary only applies if !forward.
  if (!forward) {
    let line = view.visualLineAt(start.head);
    let indentBoundary = line.from + getIndentation(view.state, line.from);
    // Make sure we don't skip past the indent boundary:
    if (cursor.head < indentBoundary && indentBoundary < start.head) {
      cursor = EditorSelection.cursor(indentBoundary);
    }
  }

  return cursor;
}

/**
 * Maps the ranges of an EditorSelection without changing the primary index.
 * @param {EditorSelection} selection
 * @param {SelectionRange -> SelectionRange} f
 * @returns {EditorSelection}
 */
function mapRanges(selection, f) {
  return EditorSelection.create(selection.ranges.map(f), selection.primaryIndex);
}

/**
 * Makes a selection update.
 * @param {Editorstate} state the view.state to update
 * @returns {Transaction}
 */
function selectionUpdate(state, selection) {
  return state.update({selection, scrollIntoView: true, annotations: Transaction.userEvent.of("keyboardselection")});
}

/**
 * Modify (nav key) the selection ranges in-place and return if it changed.
 * This resets the anchors (deselects text).
 * @param {EditorView} view
 * @param {f} SelectionRange -> SelectionRange
 * @returns {boolean} whether it changed.
 */
function modifyRanges(view, f) {
  let newSelection = mapRanges(view.state.selection, f);
  if (newSelection.eq(view.state.selection)) return false;

  view.dispatch(selectionUpdate(view.state, newSelection));
  return true;
}

/**
 * Extend (shift + nav key) the selection ranges in-place and return if it changed.
 * @param {EditorView} view
 * @param {f} SelectionRange -> SelectionRange
 * @returns {boolean} whether it changed.
 */
function extendRanges(view, f) {
  let newSelection = mapRanges(view.state.selection, range => {
    let newRange = f(range);
    return EditorSelection.range(range.anchor, newRange.head, newRange.goalColumn);
  });
  if (newSelection.eq(view.state.selection)) return false;

  view.dispatch(selectionUpdate(view.state, newSelection));
  return true
}

// Override of commands.{cursor,select}LineBoundary{Forward,Backward} respecting indentation.
export const cursorLineBoundaryForward = view => modifyRanges(view, range => moveByLineBoundary(view, range, true));
export const cursorLineBoundaryBackward = view => modifyRanges(view, range => moveByLineBoundary(view, range, false));
export const selectLineBoundaryForward = view => extendRanges(view, range => moveByLineBoundary(view, range, true));
export const selectLineBoundaryBackward = view => extendRanges(view, range => moveByLineBoundary(view, range, false));

export const homeEndKeymap = [
  {key: "Home", run: cursorLineBoundaryBackward, shift: selectLineBoundaryBackward},
  {key: "End", run: cursorLineBoundaryForward, shift: selectLineBoundaryForward},
  {key: "Enter", run: insertNewline},
];
