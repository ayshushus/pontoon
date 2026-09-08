import { Compartment, type Extension, type Range } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  Direction,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

const baseRun = Decoration.mark({ class: 'cm-dir-base' });
const oppositeRun = Decoration.mark({ class: 'cm-dir-opposite' });
const firstStrongRegion = Decoration.mark({ class: 'cm-dir-firststrong' });

const FSI = 0x2068;
const PDI = 0x2069;

function directionalityDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const base = view.textDirection;
  try {
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to; ) {
        const line = view.state.doc.lineAt(pos);
        if (line.length) {
          for (const span of view.bidiSpans(line)) {
            const mark = span.dir === base ? baseRun : oppositeRun;
            ranges.push(mark.range(line.from + span.from, line.from + span.to));
          }
        }
        pos = line.to + 1;
      }
    }
  } catch {
    // `bidiSpans` needs the line to be laid out; when that is unavailable (e.g.
    // a test environment with no layout) skip the run tints. The first-strong
    // regions below are computed from text and always apply.
  }

  const text = view.state.doc.toString();
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === FSI) {
      stack.push(i);
    } else if (code === PDI) {
      const start = stack.pop();
      if (start !== undefined) {
        ranges.push(firstStrongRegion.range(start, i + 1));
      }
    }
  }
  return Decoration.set(ranges, true);
}

const directionalityPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = directionalityDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged
      ) {
        this.decorations = directionalityDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const LTR_CARET = 'var(--tags-bracket-color)'; // teal
const RTL_CARET = 'var(--tags-quote-color)'; // amber

function caretFacingDirection(view: EditorView): Direction | null {
  const sel = view.state.selection.main;
  if (!sel.empty) return null;
  const line = view.state.doc.lineAt(sel.head);
  const target = sel.head - line.from - 1;
  if (target < 0) return null;
  try {
    for (const span of view.bidiSpans(line)) {
      if (target >= span.from && target < span.to) return span.dir;
    }
  } catch {
    return null;
  }
  return view.textDirection;
}

const caretDirectionColor = ViewPlugin.fromClass(
  class {
    view: EditorView;
    constructor(view: EditorView) {
      this.view = view;
      this.apply(view);
    }
    update(update: ViewUpdate) {
      if (
        update.selectionSet ||
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged
      ) {
        this.apply(update.view);
      }
    }
    apply(view: EditorView) {
      const dir = caretFacingDirection(view);
      view.contentDOM.style.caretColor =
        dir === null ? '' : dir === Direction.RTL ? RTL_CARET : LTR_CARET;
    }
    destroy() {
      this.view.contentDOM.style.caretColor = '';
    }
  },
);

export const directionalityCompartment = new Compartment();

export const directionalityConfig = (show: boolean): Extension =>
  show ? [directionalityPlugin, caretDirectionColor] : [];
