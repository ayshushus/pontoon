import { Compartment, type Extension } from '@codemirror/state';
import { drawSelection, EditorView } from '@codemirror/view';

// enable drawSelection (draw via CM) iff content is empty
// prevents RTL text selection and caret invisibility bug #4240
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
