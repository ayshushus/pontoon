import { Compartment, type Extension } from '@codemirror/state';
import { drawSelection, EditorView } from '@codemirror/view';

/**
 * Fix the tiny native caret shown in the empty editor (#4249) without
 * regressing the caret and selection in right-to-left messages (#4240).
 * Conditionally and independently draw the caret for different cases.
 */
const caret = new Compartment();

/**
 * Swap extensions to toggle caret drawing bundles.
 */
const drawnCaret = drawSelection();
const caretFor = (empty: boolean): Extension => (empty ? drawnCaret : []);

const toggleOnEmptyChange = EditorView.updateListener.of((update) => {
  if (!update.docChanged) {
    return;
  }
  const empty = update.state.doc.length === 0;
  if (empty !== (update.startState.doc.length === 0)) {
    update.view.dispatch({ effects: caret.reconfigure(caretFor(empty)) });
  }
});

/**
 * Draw the caret and selection with CodeMirror while the document is empty.
 */
export function emptyEditorCaret(emptyAtInit: boolean): Extension {
  return [caret.of(caretFor(emptyAtInit)), toggleOnEmptyChange];
}
