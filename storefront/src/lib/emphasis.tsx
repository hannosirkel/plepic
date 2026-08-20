/**
 * Inline emphasis in operator-supplied copy, and nothing else.
 *
 * `content/` holds plain strings, which every renderer prints verbatim. That
 * is the right default and it stays the default — but the operator supplies
 * copy in prose, and prose sometimes carries an emphasised word. The team
 * caption arrived on 2026-08-20 as `*Finally*, enjoying the perfume of fresh
 * print`, and the two ways of handling it without this were both wrong:
 * printing the asterisks, or italicising the whole line and losing the
 * distinction the operator drew.
 *
 * **This is not a Markdown renderer and must not grow into one.** The plan
 * forbids a page builder and a further component library, and a general inline
 * parser is how one arrives a feature at a time. The grammar here is one rule
 * — text between a matched pair of `*` becomes `<em>` — with no nesting, no
 * links, no raw HTML and no other marker. Anything that is not a matched pair
 * is text, including a lone `*`, so a stray asterisk in copy renders as a
 * stray asterisk rather than swallowing the rest of the paragraph.
 *
 * Output is React elements, never `dangerouslySetInnerHTML`, so a `<` in copy
 * is still text and this file adds no injection surface.
 */
import type { ReactNode } from "react";

/**
 * Matched pairs only; the capture is the emphasised run.
 *
 * The two lookarounds are what keep this from being half a Markdown parser.
 * Without them `**double**` matches its *inner* pair and renders as
 * `*<em>double</em>*` — emphasis the writer did not ask for, wrapped in the
 * markers they did write. A doubled marker is ambiguous, so it is left alone
 * as text rather than guessed at.
 */
const EMPHASIS = /(?<!\*)\*([^*]+)\*(?!\*)/g;

/**
 * Splits `text` into plain runs and `<em>` runs.
 *
 * Returns a plain string when there is no emphasis, so the overwhelmingly
 * common case adds no elements to the tree and no key churn to a list.
 */
export function withEmphasis(text: string): ReactNode {
  EMPHASIS.lastIndex = 0;
  if (!EMPHASIS.test(text)) return text;

  EMPHASIS.lastIndex = 0;
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(EMPHASIS)) {
    const start = match.index;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(<em key={`${start}-${match[1]}`}>{match[1]}</em>);
    cursor = start + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
