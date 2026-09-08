import { Direction, EditorView } from '@codemirror/view';
import { EditorSelection, EditorState } from '@codemirror/state';

import { getExtensions } from './editFieldExtensions';
import { parseEntry } from '~/utils/message';

const div = document.createElement('div');
document.body.appendChild(div);

let currentTempView: EditorView | null = null;

// Create a hidden view with the given document and extensions that
// lives until the next call to `tempView`.
// From: https://github.com/codemirror/view/blob/main/test/tempview.ts
function tempView(
  format: string,
  doc = '',
  showDirectionality = false,
): EditorView {
  if (currentTempView) {
    currentTempView.destroy();
    currentTempView = null;
  }

  const entry = parseEntry(format, `key = ${doc}`)!;
  const extensions = getExtensions(entry, {} as any, doc, showDirectionality);
  currentTempView = new EditorView({
    state: EditorState.create({ doc, extensions }),
  });
  div.appendChild(currentTempView.dom);
  return currentTempView;
}

function getAncestorWith(node: Node | null, attribute: string) {
  let el = node instanceof HTMLElement ? node : node?.parentElement;
  while (el && !el.hasAttribute(attribute)) {
    el = el.parentElement;
  }
  return el;
}

describe('spellcheck', () => {
  test('fluent mode', () => {
    const view = tempView('fluent', 'foo { $bar }');

    const text = getAncestorWith(view.domAtPos(1).node, 'spellcheck');
    expect(text?.getAttribute('spellcheck')).toBe('true');

    const ph = getAncestorWith(view.domAtPos(8).node, 'spellcheck');
    expect(ph?.getAttribute('spellcheck')).toBe('false');
  });

  test('common mode', () => {
    const view = tempView('android', '%1$s foo');

    const text = getAncestorWith(view.domAtPos(7).node, 'spellcheck');
    expect(text?.getAttribute('spellcheck')).toBe('true');

    const ph = getAncestorWith(view.domAtPos(1).node, 'spellcheck');
    expect(ph?.getAttribute('spellcheck')).toBe('false');
  });
});

describe('directionality', () => {
  const LTR = 'var(--editor-dir-ltr)';
  const RTL = 'var(--editor-dir-rtl)';
  const MIXED = 'aאb';

  const tints = (view: EditorView) =>
    [...view.dom.querySelectorAll('.cm-dir-ltr, .cm-dir-rtl')].reduce<
      [string, string][]
    >((runs, el) => {
      const dir = el.classList.contains('cm-dir-rtl') ? 'rtl' : 'ltr';
      const last = runs[runs.length - 1];
      if (last?.[0] === dir) {
        last[1] += el.textContent ?? '';
      } else {
        runs.push([dir, el.textContent ?? '']);
      }
      return runs;
    }, []);

  describe('run tints', () => {
    test('tints each run by the direction it resolves to', () => {
      expect(tints(tempView('plain', MIXED, true))).toEqual([
        ['ltr', 'a'],
        ['rtl', 'א'],
        ['ltr', 'b'],
      ]);
    });

    test('shows nothing when the setting is disabled', () => {
      expect(tints(tempView('plain', MIXED, false))).toEqual([]);
    });
  });

  describe('first-strong regions', () => {
    const region = (view: EditorView) =>
      [...view.dom.querySelectorAll('.cm-dir-first-strong')]
        .map((el) => el.textContent)
        .join('');

    test('marks an FSI region whose direction resolved from Hebrew', () => {
      const view = tempView('plain', 'a\u2068אב\u2069d', true);
      expect(region(view)).toBe('\u2068אב\u2069');
      // The region keeps the tint of the direction it actually resolved to.
      expect(tints(view)).toEqual([
        ['ltr', 'a\u2068'],
        ['rtl', 'אב'],
        ['ltr', '\u2069d'],
      ]);
    });

    test('marks an FSI region holding nothing strong', () => {
      const view = tempView('plain', 'a\u2068{0}\u2069d', true);
      expect(region(view)).toBe('\u2068{0}\u2069');
      expect(tints(view).every(([dir]) => dir === 'ltr')).toBe(true);
    });

    test('does not mark isolates that declare their own direction', () => {
      // LRI and RLI state a direction outright, so nothing is inferred.
      expect(region(tempView('plain', 'a\u2066bc\u2069d', true))).toBe('');
      expect(region(tempView('plain', 'a\u2067bc\u2069d', true))).toBe('');
    });

    test('pairs FSI with its own PDI across nested isolates', () => {
      // The inner LRI…PDI must not steal the FSI's terminator (UAX #9 BD9).
      const view = tempView('plain', '\u2068a\u2066b\u2069c\u2069d', true);
      expect(region(view)).toBe('\u2068a\u2066b\u2069c\u2069');
    });

    test('runs an unterminated FSI to the end of the line', () => {
      // An isolate with no PDI isolates the rest of the paragraph.
      expect(region(tempView('plain', 'ab\u2068cd', true))).toBe('\u2068cd');
    });

    test('does not pair an FSI with a PDI on another line', () => {
      // Each line is its own bidi paragraph, so an isolate cannot span a break.
      const view = tempView('plain', 'a\u2068b\nc\u2069d', true);
      expect(region(view)).toBe('\u2068b');
    });

    test('shows nothing when the setting is disabled', () => {
      expect(region(tempView('plain', 'a\u2068אב\u2069d', false))).toBe('');
    });
  });

  describe('caret colour', () => {
    const caretColor = (view: EditorView) =>
      view.dom.style.getPropertyValue('--editor-caret-color');

    // `MIXED` is an LTR run, an RTL run and an LTR run, one character each.
    const caretAt = (head: number, assoc: number, doc = MIXED) => {
      const view = tempView('plain', doc, true);
      view.dispatch({
        selection: EditorSelection.create([
          EditorSelection.cursor(head, assoc),
        ]),
      });
      return caretColor(view);
    };

    test('reports the direction of the run the caret is attached to', () => {
      expect(caretAt(0, 1)).toBe(LTR); // leading `a`
      expect(caretAt(1, 1)).toBe(RTL); // leading alef
      expect(caretAt(2, 1)).toBe(LTR); // leading `b`
    });

    test('follows assoc across a bidi boundary', () => {
      // One offset, two visual caret positions. CodeMirror picks between them
      // with assoc, so the colour has to as well — this is the whole point.
      expect(caretAt(1, -1)).toBe(LTR); // trailing `a`
      expect(caretAt(1, 1)).toBe(RTL); // leading alef
      expect(caretAt(2, -1)).toBe(RTL); // trailing alef
      expect(caretAt(2, 1)).toBe(LTR); // leading `b`
    });

    test('reads assoc 0 as CodeMirror does, i.e. as 1', () => {
      expect(caretAt(1, 0)).toBe(caretAt(1, 1));
      expect(caretAt(2, 0)).toBe(caretAt(2, 1));
    });

    test('clamps at the line ends, where one neighbour is missing', () => {
      expect(caretAt(0, -1)).toBe(LTR); // nothing before `a`
      expect(caretAt(3, 1)).toBe(LTR); // nothing after `b`
    });

    test('falls back to the base direction on an empty line', () => {
      // A fresh field is empty, and drawSelection owns the caret there, so
      // this is the first thing a translator sees.
      expect(caretAt(0, 1, '')).toBe(LTR);
    });

    test('says nothing when there is no single caret', () => {
      const view = tempView('plain', MIXED, true);
      view.dispatch({
        selection: EditorSelection.create([EditorSelection.range(0, 3)]),
      });
      expect(caretColor(view)).toBe('');
    });

    test('leaves the caret alone when the setting is disabled', () => {
      const view = tempView('plain', MIXED, false);
      view.dispatch({
        selection: EditorSelection.create([EditorSelection.cursor(2, -1)]),
      });
      expect(caretColor(view)).toBe('');
    });
  });
});

describe('keyword', () => {
  describe('common mode', () => {
    test('i18next format', () => {
      const view1 = tempView('plain', '{{name}} foo');
      const nameEl = getAncestorWith(view1.domAtPos(1).node, 'dir');
      expect(nameEl?.textContent).toBe('{{name}}');

      const view2 = tempView('plain', '{{balance, money}} foo');
      const balanceEl = getAncestorWith(view2.domAtPos(1).node, 'dir');
      expect(balanceEl?.textContent).toBe('{{balance, money}}');

      const view3 = tempView(
        'plain',
        '{{num, number(minimumFractionDigits: 2)}} foo',
      );
      const numEl = getAncestorWith(view3.domAtPos(1).node, 'dir');
      expect(numEl?.textContent).toBe(
        '{{num, number(minimumFractionDigits: 2)}}',
      );

      const view4 = tempView('plain', '{{value, formatter1, formatter2}} foo');
      const valueEl = getAncestorWith(view4.domAtPos(1).node, 'dir');
      expect(valueEl?.textContent).toBe('{{value, formatter1, formatter2}}');
    });
  });
});
