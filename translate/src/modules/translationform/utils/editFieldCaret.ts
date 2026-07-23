import { Compartment, type Extension } from '@codemirror/state';
import { drawSelection, EditorView } from '@codemirror/view';

// enable drawSelection only if content is empty or transitioning to empty
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
