import { Compartment, type Extension, type Range } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  Direction,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

const LTR_COLOR = 'var(--editor-dir-ltr)';
const RTL_COLOR = 'var(--editor-dir-rtl)';

const ltrRun = Decoration.mark({ class: 'cm-dir-ltr' });
const rtlRun = Decoration.mark({ class: 'cm-dir-rtl' });

function runDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      if (line.length) {
        for (const span of view.bidiSpans(line)) {
          const mark = span.dir === Direction.RTL ? rtlRun : ltrRun;
          ranges.push(mark.range(line.from + span.from, line.from + span.to));
        }
      }
      pos = line.to + 1;
    }
  }
  return Decoration.set(ranges, true);
}

const directionalityRuns = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = runDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged
      ) {
        this.decorations = runDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const LRI = 0x2066;
const RLI = 0x2067;
const FSI = 0x2068;
const PDI = 0x2069;

const firstStrongRegion = Decoration.mark({ class: 'cm-dir-first-strong' });

function firstStrongRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  const open: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === LRI || code === RLI || code === FSI) {
      open.push(i);
    } else if (code === PDI) {
      const start = open.pop();
      if (start !== undefined && text.charCodeAt(start) === FSI) {
        out.push([start, i + 1]);
      }
    }
  }
  for (const start of open) {
    if (text.charCodeAt(start) === FSI) out.push([start, text.length]);
  }
  return out;
}

function firstStrongDecorations(view: EditorView): DecorationSet {
  const { doc } = view.state;
  const ranges: Range<Decoration>[] = [];
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    for (const [from, to] of firstStrongRanges(line.text)) {
      ranges.push(firstStrongRegion.range(line.from + from, line.from + to));
    }
  }
  return Decoration.set(ranges, true);
}

const firstStrongRegions = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = firstStrongDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = firstStrongDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const CARET_PROP = '--editor-caret-color';

function caretDirection(view: EditorView): Direction | null {
  const sel = view.state.selection.main;
  if (!sel.empty) return null;
  const line = view.state.doc.lineAt(sel.head);
  if (!line.length) return view.textDirection;
  const head = sel.head - line.from;
  // Clamp at the line ends, where only one of the two neighbours exists.
  const target = Math.min(
    line.length - 1,
    Math.max(0, sel.assoc < 0 ? head - 1 : head),
  );
  for (const span of view.bidiSpans(line)) {
    if (target >= span.from && target < span.to) return span.dir;
  }
  return view.textDirection;
}

const directionalityCaret = ViewPlugin.fromClass(
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
      const dir = caretDirection(view);
      if (dir === null) {
        view.dom.style.removeProperty(CARET_PROP);
      } else {
        view.dom.style.setProperty(
          CARET_PROP,
          dir === Direction.RTL ? RTL_COLOR : LTR_COLOR,
        );
      }
    }
    destroy() {
      this.view.dom.style.removeProperty(CARET_PROP);
    }
  },
);

export const directionalityCompartment = new Compartment();

export const directionalityConfig = (show: boolean): Extension =>
  show ? [directionalityRuns, firstStrongRegions, directionalityCaret] : [];
