// Tiny HTML templating: every interpolated value is escaped unless it is wrapped in raw().
// Content comes from JSON that Ana edits in the panel, so nothing in it is trusted as markup.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

class Raw {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export function raw(value) {
  return new Raw(String(value ?? ''));
}

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escape(value);
}

/** Tagged template: html`<p>${text}</p>` escapes text; arrays and raw() are kept as markup. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new Raw(out);
}

/** Attribute helper: attrs({ href: '/x', hidden: true, 'aria-current': false }). */
export function attrs(map) {
  return raw(
    Object.entries(map)
      .filter(([, v]) => v !== false && v !== null && v !== undefined)
      .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escape(v)}"`))
      .join('')
  );
}
