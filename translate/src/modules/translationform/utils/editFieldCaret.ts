import { Compartment, type Extension } from '@codemirror/state';
import {
  type Command,
  Direction,
  drawSelection,
  EditorView,
  type KeyBinding,
} from '@codemirror/view';
import {
  cursorLineBoundaryBackward,
  cursorLineBoundaryForward,
  cursorLineBoundaryLeft,
  cursorLineBoundaryRight,
  selectLineBoundaryBackward,
  selectLineBoundaryForward,
  selectLineBoundaryLeft,
  selectLineBoundaryRight,
} from '@codemirror/commands';

// drawSelection fixes tiny native caret (#4249) but regresses RTL selection (#4240)
// hence emptyEditorCaret toggles it on the empty <-> content boundary
// Not needed after https://bugzilla.mozilla.org/show_bug.cgi?id=2056439 is fixed
export function emptyEditorCaret(emptyAtInit: boolean): Extension {
  const drawn = new Compartment();
  return [
    drawn.of(emptyAtInit ? drawSelection() : []),
    EditorView.updateListener.of((update) => {
      const empty = update.state.doc.length === 0;
      if (update.docChanged && empty !== (update.startState.doc.length === 0)) {
        update.view.dispatch({
          effects: drawn.reconfigure(empty ? drawSelection() : []),
        });
      }
    }),
  ];
}

const byDirection =
  (rtl: Command, ltr: Command): Command =>
  (view) => {
    if (view.textDirection !== Direction.RTL) return ltr(view);
    rtl(view);
    return true;
  };

export const bidiCaretKeymap: readonly KeyBinding[] = [
  {
    mac: 'Cmd-ArrowLeft',
    run: byDirection(cursorLineBoundaryBackward, cursorLineBoundaryLeft),
    shift: byDirection(selectLineBoundaryBackward, selectLineBoundaryLeft),
    preventDefault: true,
  },
  {
    mac: 'Cmd-ArrowRight',
    run: byDirection(cursorLineBoundaryForward, cursorLineBoundaryRight),
    shift: byDirection(selectLineBoundaryForward, selectLineBoundaryRight),
    preventDefault: true,
  },
];
