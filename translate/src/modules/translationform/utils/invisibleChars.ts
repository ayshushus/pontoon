import {
  Compartment,
  type Extension,
  type Range,
  type Text,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';


type Kind = 'open' | 'close' | 'point' | 'blank' | 'altspace' | 'tab';

interface CharInfo {
  /** The short Unicode abbreviation translators recognise, e.g. RLM, NBSP. */
  label: string;
  /** The spelled-out name, used for tooltips and screen readers. */
  name: string;
  kind: Kind;
  /** Direction glyph appended to the badge label. Directional kinds only. */
  arrow?: string;
  /** What the character does; appended to the tooltip after the name. */
  effect?: string;
  /** Tooltip used instead of `effect` when the delimiter has no partner. */
  unpaired?: string;
  /** A space the line cannot break at — the thing that makes it different. */
  nobreak?: true;
}

const RUNS_LTR = '→'; // →
const RUNS_RTL = '←'; // ←
const RUNS_AUTO = '⇄'; // ⇄ decided by the first strong character inside
const FORCED_LTR = '⇒'; // ⇒
const FORCED_RTL = '⇐'; // ⇐

const ACTS_LTR = '▶'; // ▶
const ACTS_RTL = '◀'; // ◀

const INVISIBLE_CHARS: Record<number, CharInfo> = {
  0x2066: {
    label: 'LRI',
    name: 'left-to-right isolate',
    kind: 'open',
    arrow: RUNS_LTR,
    effect:
      'text up to the matching PDI runs left-to-right, isolated from its surroundings',
    unpaired:
      'no matching PDI in this string, so the isolate runs on past the end of the translation',
  },
  0x2067: {
    label: 'RLI',
    name: 'right-to-left isolate',
    kind: 'open',
    arrow: RUNS_RTL,
    effect:
      'text up to the matching PDI runs right-to-left, isolated from its surroundings',
    unpaired:
      'no matching PDI in this string, so the isolate runs on past the end of the translation',
  },
  0x2068: {
    label: 'FSI',
    name: 'first strong isolate',
    kind: 'open',
    arrow: RUNS_AUTO,
    effect:
      'text up to the matching PDI runs in the direction of its own first strong character',
    unpaired:
      'no matching PDI in this string, so the isolate runs on past the end of the translation',
  },
  0x2069: {
    label: 'PDI',
    name: 'pop directional isolate',
    kind: 'close',
    effect: 'ends the innermost open isolate',
    unpaired: 'there is no open isolate here for it to end',
  },
  0x202a: {
    label: 'LRE',
    name: 'left-to-right embedding',
    kind: 'open',
    arrow: RUNS_LTR,
    effect:
      'text up to the matching PDF runs left-to-right, and still interacts with its surroundings (unlike an isolate)',
    unpaired:
      'no matching PDF in this string, so the embedding runs on past the end of the translation',
  },
  0x202b: {
    label: 'RLE',
    name: 'right-to-left embedding',
    kind: 'open',
    arrow: RUNS_RTL,
    effect:
      'text up to the matching PDF runs right-to-left, and still interacts with its surroundings (unlike an isolate)',
    unpaired:
      'no matching PDF in this string, so the embedding runs on past the end of the translation',
  },
  0x202d: {
    label: 'LRO',
    name: 'left-to-right override',
    kind: 'open',
    arrow: FORCED_LTR,
    effect:
      'forces every character up to the matching PDF to lay out left-to-right, ignoring its own direction',
    unpaired:
      'no matching PDF in this string, so the override runs on past the end of the translation',
  },
  0x202e: {
    label: 'RLO',
    name: 'right-to-left override',
    kind: 'open',
    arrow: FORCED_RTL,
    effect:
      'forces every character up to the matching PDF to lay out right-to-left, ignoring its own direction',
    unpaired:
      'no matching PDF in this string, so the override runs on past the end of the translation',
  },
  0x202c: {
    label: 'PDF',
    name: 'pop directional formatting',
    kind: 'close',
    effect: 'ends the innermost open embedding or override',
    unpaired: 'there is no open embedding or override here for it to end',
  },

  // ── Point marks: no scope
  0x200e: {
    label: 'LRM',
    name: 'left-to-right mark',
    kind: 'point',
    arrow: ACTS_LTR,
    effect:
      'counts as a left-to-right character here, steering the neutral characters next to it',
  },
  0x200f: {
    label: 'RLM',
    name: 'right-to-left mark',
    kind: 'point',
    arrow: ACTS_RTL,
    effect:
      'counts as a right-to-left character here, steering the neutral characters next to it',
  },
  0x061c: {
    label: 'ALM',
    name: 'Arabic letter mark',
    kind: 'point',
    arrow: ACTS_RTL,
    effect:
      'counts as an Arabic letter here, steering the neutral characters next to it',
  },

  // ── Zero-width, no direction
  0x00ad: {
    label: 'SHY',
    name: 'soft hyphen',
    kind: 'blank',
    effect: 'only shows, as a hyphen, if the line happens to break here',
  },
  0x200b: {
    label: 'ZWSP',
    name: 'zero width space',
    kind: 'blank',
    effect: 'allows a line break without a visible space',
  },
  0x200c: {
    label: 'ZWNJ',
    name: 'zero width non-joiner',
    kind: 'blank',
    effect: 'keeps the letters on either side from joining',
  },
  0x200d: {
    label: 'ZWJ',
    name: 'zero width joiner',
    kind: 'blank',
    effect: 'joins the letters on either side',
  },
  0x2060: {
    label: 'WJ',
    name: 'word joiner',
    kind: 'blank',
    effect: 'prevents a line break here',
  },
  0xfeff: {
    label: 'BOM',
    name: 'byte order mark',
    kind: 'blank',
    effect: 'usually left over from a file conversion, and safe to delete',
  },

  // ── Characters that already have a cell of their own
  0x0009: { label: '⇥', name: 'tab', kind: 'tab' },
  0x00a0: {
    label: 'NBSP',
    name: 'no-break space',
    kind: 'altspace',
    nobreak: true,
    effect: 'a space the line can never break at',
  },
  0x2000: { label: 'NQSP', name: 'en quad', kind: 'altspace' },
  0x2001: { label: 'MQSP', name: 'em quad', kind: 'altspace' },
  0x2002: { label: 'ENSP', name: 'en space', kind: 'altspace' },
  0x2003: { label: 'EMSP', name: 'em space', kind: 'altspace' },
  0x2004: { label: '3/MSP', name: 'three-per-em space', kind: 'altspace' },
  0x2005: { label: '4/MSP', name: 'four-per-em space', kind: 'altspace' },
  0x2006: { label: '6/MSP', name: 'six-per-em space', kind: 'altspace' },
  0x2007: {
    label: 'FSP',
    name: 'figure space',
    kind: 'altspace',
    nobreak: true,
    effect: 'as wide as a digit, and the line can never break at it',
  },
  0x2008: { label: 'PSP', name: 'punctuation space', kind: 'altspace' },
  0x2009: { label: 'THSP', name: 'thin space', kind: 'altspace' },
  0x200a: { label: 'HSP', name: 'hair space', kind: 'altspace' },
  0x202f: {
    label: 'NNBSP',
    name: 'narrow no-break space',
    kind: 'altspace',
    nobreak: true,
    effect: 'a thin space the line can never break at',
  },
  0x205f: {
    label: 'MMSP',
    name: 'medium mathematical space',
    kind: 'altspace',
  },
  0x3000: { label: 'IDSP', name: 'ideographic space', kind: 'altspace' },
};

const INVISIBLE_RE = new RegExp(
  `[${Object.keys(INVISIBLE_CHARS)
    .map((code) => `\\u${Number(code).toString(16).padStart(4, '0')}`)
    .join('')}]`,
  'g',
);

const ISOLATE_OPEN = new Set([0x2066, 0x2067, 0x2068]); // LRI, RLI, FSI
const EMBED_OPEN = new Set([0x202a, 0x202b, 0x202d, 0x202e]); // LRE, RLE, LRO, RLO
const PDI = 0x2069;
const PDF = 0x202c;

function unpairedDelimiters(text: string): Set<number> {
  const unpaired = new Set<number>();
  const isolates: number[] = [];
  const embeds: number[][] = [[]];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (ISOLATE_OPEN.has(code)) {
      isolates.push(i);
      embeds.push([]);
    } else if (code === PDI) {
      if (isolates.length) {
        isolates.pop();
        for (const pos of embeds.pop()!) unpaired.add(pos);
      } else {
        unpaired.add(i);
      }
    } else if (EMBED_OPEN.has(code)) {
      embeds[embeds.length - 1].push(i);
    } else if (code === PDF) {
      const frame = embeds[embeds.length - 1];
      if (frame.length) {
        frame.pop();
      } else {
        unpaired.add(i);
      }
    }
  }

  for (const pos of isolates) unpaired.add(pos);
  for (const frame of embeds) for (const pos of frame) unpaired.add(pos);
  return unpaired;
}

const markCache = new Map<string, Decoration>();

function invisibleMark(code: number, unpaired: boolean): Decoration {
  const key = `${code}:${unpaired}`;
  const cached = markCache.get(key);
  if (cached) return cached;

  const info = INVISIBLE_CHARS[code];
  const name =
    info?.name ?? `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
  const kind = info?.kind ?? 'blank';
  const badge = kind !== 'altspace' && kind !== 'tab';

  const detail = unpaired ? info?.unpaired : info?.effect;
  const attributes: Record<string, string> = {
    title: detail ? `${name} — ${detail}` : name,
  };
  const classes = ['cm-invisible-char', `cm-invisible-${kind}`];
  if (badge) {
    classes.push('cm-invisible-badge');
    const suffix = unpaired ? ' !' : info?.arrow ? ` ${info.arrow}` : '';
    attributes['data-label'] = (info?.label ?? '?') + suffix;
    attributes['aria-label'] = attributes.title;
  }
  if (info?.nobreak) classes.push('cm-invisible-nobreak');
  if (unpaired) classes.push('cm-invisible-unpaired');

  const mark = Decoration.mark({ class: classes.join(' '), attributes });
  markCache.set(key, mark);
  return mark;
}

const SPACE = 0x0020;

const spaceRunCache = new Map<string, Decoration>();

function spaceRunMark(
  length: number,
  leading: boolean,
  trailing: boolean,
): Decoration {
  const key = `${length}:${leading}:${trailing}`;
  const cached = spaceRunCache.get(key);
  if (cached) return cached;

  const n = `${length} space${length === 1 ? '' : 's'}`;
  const title =
    leading && trailing
      ? `${n}: this line holds nothing else`
      : leading
        ? `${n} at the start of the line`
        : trailing
          ? `${n} at the end of the line`
          : `${n} in a row`;

  const classes = ['cm-invisible-char', 'cm-invisible-spaces'];
  if (leading) classes.push('cm-invisible-lead');
  if (trailing) classes.push('cm-invisible-trail');
  if (!leading && !trailing) classes.push('cm-invisible-multi');

  const mark = Decoration.mark({
    class: classes.join(' '),
    attributes: { title },
  });
  spaceRunCache.set(key, mark);
  return mark;
}

function spaceRunRanges(doc: Text): Range<Decoration>[] {
  const ranges: Range<Decoration>[] = [];
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    const { text } = line;
    for (let i = 0; i < text.length; ) {
      if (text.charCodeAt(i) !== SPACE) {
        i++;
        continue;
      }
      let end = i;
      while (end < text.length && text.charCodeAt(end) === SPACE) end++;
      const leading = i === 0;
      const trailing = end === text.length;
      if (leading || trailing || end - i >= 2) {
        const mark = spaceRunMark(end - i, leading, trailing);
        for (let at = line.from + i; at < line.from + end; at++) {
          ranges.push(mark.range(at, at + 1));
        }
      }
      i = end;
    }
  }
  return ranges;
}

function invisibleDecorations(view: EditorView): DecorationSet {
  const { doc } = view.state;
  const text = doc.toString();
  const unpaired = unpairedDelimiters(text);
  const ranges = spaceRunRanges(doc);
  for (const match of text.matchAll(INVISIBLE_RE)) {
    const at = match.index!;
    const code = match[0].codePointAt(0)!;
    ranges.push(invisibleMark(code, unpaired.has(at)).range(at, at + 1));
  }
  return Decoration.set(ranges, true);
}

const invisibleCharMarks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = invisibleDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = invisibleDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const eolLine = Decoration.line({ class: 'cm-invisible-eol' });

function eolDecorations(view: EditorView): DecorationSet {
  const { doc } = view.state;
  const ranges: Range<Decoration>[] = [];
  for (let n = 1; n < doc.lines; n++) {
    ranges.push(eolLine.range(doc.line(n).from));
  }
  return Decoration.set(ranges);
}

const eolMarks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = eolDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = eolDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const showInvisiblesExtension: Extension = [invisibleCharMarks, eolMarks];

export const invisibleCharsCompartment = new Compartment();

export const invisibleCharsConfig = (show: boolean): Extension =>
  show ? showInvisiblesExtension : [];
