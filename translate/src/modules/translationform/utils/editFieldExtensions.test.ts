import { Direction, EditorView } from '@codemirror/view';
import { EditorSelection, EditorState } from '@codemirror/state';

import { bidiCaretKeymap } from './editFieldCaret';
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
  showInvisibles = false,
  showDirectionality = false,
): EditorView {
  if (currentTempView) {
    currentTempView.destroy();
    currentTempView = null;
  }

  const entry = parseEntry(format, `key = ${doc}`)!;
  const extensions = getExtensions(
    entry,
    {} as any,
    doc,
    showInvisibles,
    showDirectionality,
  );
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

describe('invisible characters', () => {
  const marks = (view: EditorView) => [
    ...view.dom.querySelectorAll('.cm-invisible-char'),
  ];
  const labelled = (view: EditorView, label: string) =>
    marks(view).find((m) => m.getAttribute('data-label')?.startsWith(label));

  describe('characters with a cell of their own', () => {
    test('leaves a lone space between two words alone', () => {
      const view = tempView('plain', 'a b c', true);
      expect(marks(view)).toHaveLength(0);
    });

    test('marks a run of two or more spaces, in place and with no badge', () => {
      const view = tempView('plain', 'a   b', true);
      const run = marks(view);
      expect(run).toHaveLength(3);
      for (const space of run) {
        expect(space.classList.contains('cm-invisible-spaces')).toBe(true);
        expect(space.classList.contains('cm-invisible-multi')).toBe(true);
        expect(space.classList.contains('cm-invisible-badge')).toBe(false);
        expect(space.hasAttribute('data-label')).toBe(false);
        expect(space.getAttribute('title')).toBe('3 spaces in a row');
        expect(space.hasAttribute('aria-label')).toBe(false);
      }
    });

    test('marks a single leading space', () => {
      const view = tempView('plain', ' ab', true);
      const [space] = marks(view);
      expect(space.classList.contains('cm-invisible-lead')).toBe(true);
      expect(space.classList.contains('cm-invisible-trail')).toBe(false);
      expect(space.getAttribute('title')).toBe(
        '1 space at the start of the line',
      );
    });

    test('marks a single trailing space', () => {
      const view = tempView('plain', 'ab ', true);
      const [space] = marks(view);
      expect(space.classList.contains('cm-invisible-trail')).toBe(true);
      expect(space.classList.contains('cm-invisible-lead')).toBe(false);
      expect(space.getAttribute('title')).toBe(
        '1 space at the end of the line',
      );
    });

    test('marks leading and trailing runs on the same line separately', () => {
      const view = tempView('plain', ' a  b ', true);
      const run = marks(view);
      expect(run).toHaveLength(4); // 1 leading + 2 interior + 1 trailing
      expect(run[0].classList.contains('cm-invisible-lead')).toBe(true);
      expect(run[1].classList.contains('cm-invisible-multi')).toBe(true);
      expect(run[2].classList.contains('cm-invisible-multi')).toBe(true);
      expect(run[3].classList.contains('cm-invisible-trail')).toBe(true);
    });

    test('reports a line of nothing but spaces as one run', () => {
      const view = tempView('plain', '  ', true);
      const run = marks(view);
      expect(run).toHaveLength(2);
      for (const space of run) {
        expect(space.classList.contains('cm-invisible-lead')).toBe(true);
        expect(space.classList.contains('cm-invisible-trail')).toBe(true);
        expect(space.getAttribute('title')).toBe(
          '2 spaces: this line holds nothing else',
        );
      }
    });

    test('classifies space runs per line, not per string', () => {
      const view = tempView('plain', 'a \n b', true);
      const run = marks(view);
      expect(run).toHaveLength(2);
      expect(run[0].classList.contains('cm-invisible-trail')).toBe(true);
      expect(run[1].classList.contains('cm-invisible-lead')).toBe(true);
    });

    test('marks a tab in place, with no badge', () => {
      const view = tempView('plain', 'a\tb', true);
      const [tab] = marks(view);
      expect(tab.classList.contains('cm-invisible-tab')).toBe(true);
      expect(tab.classList.contains('cm-invisible-badge')).toBe(false);
      expect(view.state.doc.toString()).toBe('a\tb');
    });

    test('distinguishes a look-alike space and flags it non-breaking', () => {
      const view = tempView('plain', 'foo bar', true); // NBSP
      const [nbsp] = marks(view);
      expect(nbsp.classList.contains('cm-invisible-altspace')).toBe(true);
      expect(nbsp.classList.contains('cm-invisible-nobreak')).toBe(true);
      expect(nbsp.classList.contains('cm-invisible-badge')).toBe(false);
      expect(nbsp.getAttribute('title')).toContain('no-break space');
      expect(view.state.doc.toString()).toBe('foo bar');
    });

    test('does not flag a breaking look-alike space as non-breaking', () => {
      const view = tempView('plain', 'a b', true); // EM SPACE
      const [emsp] = marks(view);
      expect(emsp.classList.contains('cm-invisible-altspace')).toBe(true);
      expect(emsp.classList.contains('cm-invisible-nobreak')).toBe(false);
    });

    test('marks the line a break follows, without adding a widget', () => {
      const view = tempView('plain', 'a\nb', true);
      const eol = [...view.dom.querySelectorAll('.cm-invisible-eol')];
      // Only the first of the two lines is followed by a break.
      expect(eol).toHaveLength(1);
      expect(eol[0].textContent).toBe('a');
      expect(view.dom.querySelector('.cm-invisible-newline')).toBeNull();
      expect(view.state.doc.toString()).toBe('a\nb');
    });
  });

  describe('zero-width characters', () => {
    test('keeps the real character in the document (does not replace it)', () => {
      const view = tempView('plain', 'foo\u200Fbar', true);
      // The RLM is still present in the text, so bidi/layout is unchanged.
      expect(view.state.doc.toString()).toBe('foo\u200Fbar');
      expect(view.state.doc.length).toBe(7);
    });

    test('gives a point mark a triangle, not a scope arrow', () => {
      const view = tempView('plain', 'foo\u200Fbar', true); // RLM
      const [rlm] = marks(view);
      expect(rlm.classList.contains('cm-invisible-point')).toBe(true);
      expect(rlm.classList.contains('cm-invisible-badge')).toBe(true);
      expect(rlm.getAttribute('data-label')).toBe('RLM ◀');
      expect(rlm.getAttribute('title')).toContain('right-to-left mark');
      expect(rlm.getAttribute('aria-label')).toBe(rlm.getAttribute('title'));
    });

    test('gives a non-directional character no direction glyph', () => {
      const view = tempView('plain', 'a‍b', true); // ZWJ
      const [zwj] = marks(view);
      expect(zwj.classList.contains('cm-invisible-blank')).toBe(true);
      expect(zwj.getAttribute('data-label')).toBe('ZWJ');
      expect(zwj.getAttribute('title')).toContain('zero width joiner');
    });

    test.each([
      ['\u2066', '\u2069', 'LRI →'], // isolate, left-to-right
      ['\u2067', '\u2069', 'RLI ←'], // isolate, right-to-left
      ['\u2068', '\u2069', 'FSI ⇄'], // isolate, decided by its content
      ['\u202B', '\u202C', 'RLE ←'], // embedding, right-to-left
      ['\u202E', '\u202C', 'RLO ⇐'], // override forces, hence double
    ])(
      'arrows a scope opener with how its contents run: %j',
      (open, close, label) => {
        // Paired with its closer, so the arrow is not replaced by the "!" flag.
        const view = tempView('plain', `a${open}x${close}b`, true);
        const [opener] = marks(view);
        expect(opener.classList.contains('cm-invisible-open')).toBe(true);
        expect(opener.getAttribute('data-label')).toBe(label);
      },
    );

    test('marks the two ends of a scope so that each labels outside it', () => {
      const view = tempView('plain', 'a\u2068x\u2069b', true); // FSI x PDI
      const fsi = labelled(view, 'FSI');
      const pdi = labelled(view, 'PDI');
      expect(fsi?.classList.contains('cm-invisible-open')).toBe(true);
      expect(fsi?.classList.contains('cm-invisible-close')).toBe(false);
      expect(pdi?.classList.contains('cm-invisible-close')).toBe(true);
      expect(pdi?.classList.contains('cm-invisible-open')).toBe(false);
      // A closer ends a scope rather than declaring a direction, so no arrow.
      expect(pdi?.getAttribute('data-label')).toBe('PDI');
    });
  });

  describe('unpaired delimiters', () => {
    test('flags an isolate with no matching PDI', () => {
      const view = tempView('plain', 'a\u2066b', true);
      const [lri] = marks(view);
      expect(lri.classList.contains('cm-invisible-unpaired')).toBe(true);
      // "!" replaces the arrow, so the warning survives a monochrome read.
      expect(lri.getAttribute('data-label')).toBe('LRI !');
      expect(lri.getAttribute('title')).toContain('no matching PDI');
    });

    test('flags a PDI with no isolate to end', () => {
      const view = tempView('plain', 'a\u2069b', true);
      const [pdi] = marks(view);
      expect(pdi.classList.contains('cm-invisible-unpaired')).toBe(true);
      expect(pdi.getAttribute('data-label')).toBe('PDI !');
    });

    test('leaves balanced nesting alone', () => {
      const view = tempView('plain', '\u2066a\u2067b\u2069c\u2069', true);
      expect(marks(view)).toHaveLength(4);
      for (const m of marks(view)) {
        expect(m.classList.contains('cm-invisible-unpaired')).toBe(false);
      }
    });

    test('matches embeddings against PDF, not PDI', () => {
      const ok = tempView('plain', '\u202Ba\u202C', true); // RLE … PDF
      for (const m of marks(ok)) {
        expect(m.classList.contains('cm-invisible-unpaired')).toBe(false);
      }
      const bad = tempView('plain', '\u202Ba\u2069', true); // RLE … PDI
      for (const m of marks(bad)) {
        expect(m.classList.contains('cm-invisible-unpaired')).toBe(true);
      }
    });

    test('does not let a PDF reach out of the isolate it sits in', () => {
      // The RLE opens outside the isolate, so a PDF inside cannot close it.
      const view = tempView('plain', '\u202B\u2066a\u202C\u2069', true);
      expect(labelled(view, 'RLE')?.classList).toContain(
        'cm-invisible-unpaired',
      );
      expect(labelled(view, 'PDF')?.classList).toContain(
        'cm-invisible-unpaired',
      );
      expect(labelled(view, 'LRI')?.classList).not.toContain(
        'cm-invisible-unpaired',
      );
    });
  });

  test('adds no background highlight (only badges and in-cell marks)', () => {
    const view = tempView('plain', 'a\u2066name\u2069b', true); // LRI … PDI
    expect(view.dom.querySelector('.cm-bidi-scope')).toBeNull();
    expect(view.dom.querySelector('.cm-dir-firststrong')).toBeNull();
    expect(view.dom.querySelector('.cm-invisible-char')).not.toBeNull();
  });

  test('shows nothing when the setting is disabled', () => {
    const view = tempView('plain', 'foo\u200Fbar', false);
    expect(view.dom.querySelector('.cm-invisible-char')).toBeNull();
    expect(view.dom.querySelector('.cm-invisible-eol')).toBeNull();
  });

  test('leaves ordinary letters untouched', () => {
    const view = tempView('plain', 'helloworld', true);
    expect(view.dom.querySelector('.cm-invisible-char')).toBeNull();
  });
});

describe('directionality', () => {
  test('marks first-strong regions when enabled', () => {
    const view = tempView('plain', 'a\u2068x\u2069b', false, true); // FSI … PDI
    const fs = view.dom.querySelector('.cm-dir-firststrong');
    expect(fs).not.toBeNull();
    expect(fs?.textContent).toContain('x');
  });

  test('shows nothing when the setting is disabled', () => {
    const view = tempView('plain', 'a\u2068x\u2069b', false, false);
    expect(view.dom.querySelector('.cm-dir-firststrong')).toBeNull();
  });

  test('is independent of the invisible-characters setting', () => {
    // Invisible chars on, directionality off → no directionality marks.
    const view = tempView('plain', 'a\u2068x\u2069b', true, false);
    expect(view.dom.querySelector('.cm-dir-firststrong')).toBeNull();
    expect(view.dom.querySelector('.cm-invisible-char')).not.toBeNull();
  });

  describe('caret colour', () => {
    const LTR = 'var(--tags-bracket-color)';
    const RTL = 'var(--tags-quote-color)';

    const caretAt = (head: number, assoc: number) => {
      const view = tempView('plain', 'ab', false, true);
      view.bidiSpans = () =>
        [
          { from: 0, to: 1, dir: Direction.LTR, level: 0 },
          { from: 1, to: 2, dir: Direction.RTL, level: 1 },
        ] as any;
      view.dispatch({
        selection: EditorSelection.create([
          EditorSelection.cursor(head, assoc),
        ]),
      });
      return view.contentDOM.style.caretColor;
    };

    test('does not depend on which arrow key put the caret there', () => {
      expect(caretAt(1, -1)).toBe(caretAt(1, 1));
      expect(caretAt(1, 0)).toBe(caretAt(1, -1)); // a mouse click often leaves 0
    });

    test('reports the direction of the character Backspace will delete', () => {
      expect(caretAt(1, 1)).toBe(LTR); // deletes index 0, in the LTR run
      expect(caretAt(2, -1)).toBe(RTL); // deletes index 1, in the RTL run
    });

    test('says nothing where there is no character to delete', () => {
      expect(caretAt(0, 1)).toBe('');
    });

    test('says nothing when a selection would be deleted instead', () => {
      const view = tempView('plain', 'ab', false, true);
      view.dispatch({
        selection: EditorSelection.create([EditorSelection.range(0, 2)]),
      });
      expect(view.contentDOM.style.caretColor).toBe('');
    });
  });
});

describe('caret movement', () => {
  const keys = () => bidiCaretKeymap.map((b) => b.key ?? b.mac);

  test('leaves the horizontal arrows to the stock visual commands', () => {
    expect(keys()).not.toContain('ArrowLeft');
    expect(keys()).not.toContain('ArrowRight');
  });

  test('still overrides the macOS line-boundary keys', () => {
    expect(keys()).toContain('Cmd-ArrowLeft');
    expect(keys()).toContain('Cmd-ArrowRight');
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
