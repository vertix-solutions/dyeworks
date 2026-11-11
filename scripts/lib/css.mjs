// A small parser for flat stylesheets: top-level blocks of declarations, each with the line it starts on.
// It is enough for Theme files, which may hold nothing else, and reports nesting instead of parsing it.

/** Replace comments with spaces, keeping every newline so line numbers survive. */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

/**
 * Parse `text` into `{blocks, statements, nested}`:
 * - blocks: [{prelude, line, declarations: [{property, value, line}]}]
 * - statements: top-level at-rules ended by `;` ([{prelude, line}])
 * - nested: [{prelude, line}] for every `{` found inside a block (the inner text is skipped)
 */
export function parseStylesheet(text) {
  const src = stripComments(text);
  const blocks = [];
  const statements = [];
  const nested = [];
  let i = 0;
  let line = 1;
  const advance = () => {
    if (src[i] === "\n") line++;
    i++;
  };
  const skipSpace = () => {
    while (i < src.length && /\s/.test(src[i])) advance();
  };
  while (true) {
    skipSpace();
    if (i >= src.length) break;
    const startLine = line;
    let prelude = "";
    let quote = null;
    while (i < src.length && (quote || (src[i] !== "{" && src[i] !== ";"))) {
      if (quote && src[i] === quote) quote = null;
      else if (!quote && (src[i] === '"' || src[i] === "'")) quote = src[i];
      prelude += src[i];
      advance();
    }
    if (i >= src.length) {
      statements.push({ prelude: prelude.trim(), line: startLine, unterminated: true });
      break;
    }
    if (src[i] === ";") {
      advance();
      statements.push({ prelude: prelude.trim(), line: startLine });
      continue;
    }
    advance(); // the opening brace
    const declarations = [];
    let decl = "";
    let declLine = null;
    let paren = 0;
    quote = null;
    const flush = () => {
      const t = decl.trim();
      if (t) {
        const colon = t.indexOf(":");
        declarations.push(
          colon < 0
            ? { property: t, value: "", line: declLine }
            : { property: t.slice(0, colon).trim(), value: t.slice(colon + 1).trim(), line: declLine },
        );
      }
      decl = "";
      declLine = null;
    };
    while (i < src.length) {
      const c = src[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "(") paren++;
      else if (c === ")") paren--;
      else if (paren === 0 && c === ";") {
        flush();
        advance();
        continue;
      } else if (paren === 0 && c === "}") break;
      else if (paren === 0 && c === "{") {
        nested.push({ prelude: decl.trim(), line: declLine ?? line });
        decl = "";
        declLine = null;
        let depth = 1;
        advance();
        while (i < src.length && depth > 0) {
          if (src[i] === "{") depth++;
          else if (src[i] === "}") depth--;
          advance();
        }
        continue;
      }
      if (declLine === null && !/\s/.test(c)) declLine = line;
      decl += c;
      advance();
    }
    flush();
    advance(); // the closing brace
    blocks.push({ prelude: prelude.trim().replace(/\s+/g, " "), line: startLine, declarations });
  }
  return { blocks, statements, nested };
}

/** Every custom property a value reads through `var(--name…)`. */
export function varReads(value) {
  return [...value.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((m) => m[1]);
}
