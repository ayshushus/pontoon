import {
  type Extension,
  Prec,
  StateEffect,
  StateField,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  keymap,
} from '@codemirror/view';


const MODEL_ID = 'Xenova/opus-mt-en-it';
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';

const DEBOUNCE_MS = 300;

type GhostRequest = { reqId: number; source: string; typed: string };
type GhostReply = { reqId: number; ghost: string; error?: string };

// worker transformers.js plus the whole decoder
const WORKER_SRC = `FILL_ME_IN_WITH_TRANSFORMERS_JS_PLUS_DECODER`
const MODEL_ID = ${JSON.stringify(MODEL_ID)};
const CDN = ${JSON.stringify(CDN)};

// Generation limit
const MAX_EXTRA = 16;
// Spin prevention
const MAX_STEPS = 128;
// Step examination
const TOP_K = 96;


// Normalize characters
const norm = (s) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\\u00a0/g, ' ');

// One pass no sort
function topIds(row, k) {
  const ids = new Int32Array(k);
  const vals = new Float32Array(k).fill(-Infinity);
  let count = 0;
  let min = -Infinity;
  for (let i = 0; i < row.length; i++) {
    const v = row[i];
    if (count === k && v <= min) continue;
    let j = Math.min(count, k - 1);
    while (j > 0 && vals[j - 1] < v) {
      vals[j] = vals[j - 1];
      ids[j] = ids[j - 1];
      j--;
    }
    vals[j] = v;
    ids[j] = i;
    if (count < k) count++;
    min = vals[count - 1];
  }
  return Array.from(ids.subarray(0, count));
}

const allIdsRanked = (row) => Array.from(row.keys()).sort((a, b) => row[b] - row[a]);

let enginePromise = null;
function engine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const t = await import(CDN);
      const tokenizer = await t.AutoTokenizer.from_pretrained(MODEL_ID);
      const model = await t.AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID, { device: 'wasm' });
      const c = model.config;
      const specialIds = new Set(
        [c.eos_token_id, c.pad_token_id, c.decoder_start_token_id].filter((x) => x != null),
      );
      return {
        Tensor: t.Tensor,
        tokenizer,
        model,
        startId: c.decoder_start_token_id,
        specialIds,
        encCache: new Map(), // source -> tokenized source
        transCache: new Map(), // source -> full translation
      };
    })();
  }
  return enginePromise;
}

const encodeSource = async (e, source) => {
  if (!e.encCache.has(source)) e.encCache.set(source, await e.tokenizer(source));
  return e.encCache.get(source);
};

// Compute once per source
async function translationOf(e, source) {
  if (!e.transCache.has(source)) {
    const enc = await encodeSource(e, source);
    const out = await e.model.generate({
      input_ids: enc.input_ids,
      attention_mask: enc.attention_mask,
      max_new_tokens: 128,
    });
    const ids = Array.from(out.data, Number).slice(1); // drop decoder_start
    e.transCache.set(source, e.tokenizer.decode(ids, { skip_special_tokens: true }));
  }
  return e.transCache.get(source);
}

function firstWord(rest) {
  const m = rest.match(/^\\s*\\S+/);
  return m ? m[0] : '';
}

// Constrained decode
async function constrainedNextWord(e, source, typed, stale) {
  const { Tensor, tokenizer, model, startId, specialIds } = e;
  const enc = await encodeSource(e, source);

  const target = typed.replace(/\\s+$/, '');
  const typedSpaces = typed.length - target.length;
  const ntarget = norm(target);

  const dec = [BigInt(startId)];
  const decodeSeq = (ids) => tokenizer.decode(ids.slice(1).map(Number), { skip_special_tokens: true });
  let produced = '';

  const steps = Math.min(target.length + MAX_EXTRA, MAX_STEPS);
  for (let step = 0; step < steps; step++) {
    if (stale()) return '';
    const decoder_input_ids = new Tensor('int64', BigInt64Array.from(dec), [1, dec.length]);
    const out = await model({
      input_ids: enc.input_ids,
      attention_mask: enc.attention_mask,
      decoder_input_ids,
    });
    const dims = out.logits.dims;
    const V = dims[dims.length - 1];
    const L = dims[dims.length - 2];
    const row = out.logits.data.subarray((L - 1) * V, L * V);

    let chosen;
    if (produced.length < target.length) {
      const pick = (ids) => {
        for (const tid of ids) {
          if (specialIds.has(tid)) continue;
          const cand = norm(decodeSeq([...dec, BigInt(tid)]));
          if (cand === norm(produced)) continue; // token added no visible text
          if (ntarget.startsWith(cand) || cand.startsWith(ntarget)) return tid;
        }
        return null;
      };
      chosen = pick(topIds(row, TOP_K));
      if (chosen === null) chosen = pick(allIdsRanked(row));
      if (chosen === null) return '';
    } else {
      let best = 0;
      for (let i = 1; i < V; i++) if (row[i] > row[best]) best = i;
      if (specialIds.has(best)) break;
      chosen = best;
    }

    dec.push(BigInt(chosen));
    produced = decodeSeq(dec);
    if (produced.length >= target.length) {
      const beyond = produced.slice(target.length);
      if (/^\\s*\\S+\\s/.test(beyond) || beyond.length >= MAX_EXTRA) break;
    }
  }

  const full = decodeSeq(dec);
  if (!norm(full).startsWith(ntarget)) return '';
  let rest = full.slice(target.length);
  for (let i = 0; i < typedSpaces && /^\\s/.test(rest); i++) rest = rest.slice(1);
  return firstWord(rest);
}

async function complete(source, typed, stale) {
  const e = await engine();
  const translation = await translationOf(e, source);
  if (stale()) return '';
  if (norm(translation).startsWith(norm(typed))) {
    return firstWord(translation.slice(typed.length));
  }
  return constrainedNextWord(e, source, typed, stale);
}

let latest = 0;
self.onmessage = async (ev) => {
  const { reqId, source, typed } = ev.data;
  latest = reqId;
  try {
    const ghost = await complete(source, typed, () => reqId !== latest);
    if (reqId === latest) self.postMessage({ reqId, ghost });
  } catch (err) {
    self.postMessage({ reqId, ghost: '', error: String(err) });
  }
};

let worker: Worker | null = null;
let reqSeq = 0;
const handlers = new Map<number, (ghost: string) => void>();

function getWorker(): Worker {
  if (!worker) {
    const url = URL.createObjectURL(
      new Blob([WORKER_SRC], { type: 'text/javascript' }),
    );
    worker = new Worker(url, { type: 'module' });
    worker.onmessage = (ev: MessageEvent<GhostReply>) => {
      const { reqId, ghost } = ev.data;
      const onGhost = handlers.get(reqId);
      if (onGhost) {
        handlers.delete(reqId);
        onGhost(ghost);
      }
    };
  }
  return worker;
}

function requestGhost(
  source: string,
  typed: string,
  onGhost: (ghost: string) => void,
): () => void {
  const reqId = ++reqSeq;
  handlers.set(reqId, onGhost);
  getWorker().postMessage({ reqId, source, typed } satisfies GhostRequest);
  return () => handlers.delete(reqId); // drop the handler so a late reply is ignored
}

const setGhost = StateEffect.define<string>();
const clearGhost = StateEffect.define<null>();

const ghostField = StateField.define<string>({
  create: () => '',
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setGhost)) {
        return effect.value;
      }
      if (effect.is(clearGhost)) {
        return '';
      }
    }
    return tr.docChanged || tr.selection ? '' : value;
  },
});

class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: GhostWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-ghost-text';
    span.textContent = this.text;
    return span;
  }
}

const ghostDecorations = EditorView.decorations.compute(
  [ghostField],
  (state) => {
    const text = state.field(ghostField);
    if (!text) {
      return Decoration.none;
    }
    const pos = state.selection.main.head;
    return Decoration.set([
      Decoration.widget({ widget: new GhostWidget(text), side: 1 }).range(pos),
    ]);
  },
);

function ghostDriver(getSource: () => string) {
  return ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | undefined;
      cancel: (() => void) | undefined;

      constructor(readonly view: EditorView) {}

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.schedule();
        }
      }

      schedule() {
        clearTimeout(this.timer);
        this.cancel?.(); // supersede any in-flight request
        const { view } = this;
        const sel = view.state.selection.main;
        // MVP only complete at the very end of the translation
        if (!sel.empty || sel.head !== view.state.doc.length) {
          return;
        }
        const typed = view.state.doc.toString();
        if (!typed) {
          return;
        }
        this.timer = setTimeout(() => {
          this.cancel = requestGhost(getSource(), typed, (ghost) => {
            // Ignore a reply the user has already typed past.
            if (ghost && view.state.doc.toString() === typed) {
              view.dispatch({ effects: setGhost.of(ghost) });
            }
          });
        }, DEBOUNCE_MS);
      }

      destroy() {
        clearTimeout(this.timer);
        this.cancel?.();
      }
    },
  );
}

// Tab accept else return False
const acceptGhostKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Tab',
      run: (view) => {
        const ghost = view.state.field(ghostField, false);
        if (!ghost) {
          return false;
        }
        const pos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: pos, insert: ghost },
          selection: { anchor: pos + ghost.length },
          effects: clearGhost.of(null),
        });
        return true;
      },
    },
  ]),
);

export function ghostText(source: string): Extension {
  return [
    ghostField,
    ghostDecorations,
    ghostDriver(() => source),
    acceptGhostKeymap,
  ];
}
