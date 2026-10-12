/**
 * The source scan that goes with the marker fixture
 * (`./marker-site-copy.ts`): every literal in a component that a reader could
 * meet.
 *
 * A render under the fixture cannot reach a string a component only shows
 * after an event. A form's validation error appears when a visitor presses
 * its button, and no static render presses one. So a component that has been
 * made locale-aware is also parsed, and what it still says in its own words
 * is listed for the test to compare with the few it may keep.
 *
 * It parses with the TypeScript compiler rather than matching text, because
 * the question is about syntax: the same two words are a sentence in JSX
 * text and nothing at all in a `className` or a module path.
 */
import ts from "typescript";

/** Attributes whose value a reader meets as words. */
const READER_FACING_ATTRIBUTES: ReadonlySet<string> = new Set([
  "alt",
  "aria-label",
  "title",
  "placeholder",
  "label",
]);

const HAS_LETTER = /\p{L}/u;
/** Two words, or one that begins like a label: `"Subscribe"`, not `"primary"`. */
const READS_AS_COPY = /\p{L}\s+\p{L}|^\p{Lu}\p{Ll}/u;

function attributeOf(node: ts.Node): ts.JsxAttribute | undefined {
  if (ts.isJsxAttribute(node.parent)) return node.parent;
  return ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent)
    ? node.parent.parent
    : undefined;
}

/**
 * Every literal in `code` that a reader could meet, in document order:
 *
 * - text between JSX tags;
 * - a literal in a reader-facing attribute, with or without braces;
 * - the words of a template literal;
 * - any other string that is two words or begins like a label.
 *
 * Module paths, directives, the other attributes (`className`, `src`,
 * `sizes`) and lower-case tokens (`"primary"`, `"email"`) are none of those.
 */
export function readerFacingLiterals(fileName: string, code: string): readonly string[] {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      if (HAS_LETTER.test(node.text)) found.push(node.text.trim());
    } else if (ts.isStringLiteralLike(node)) {
      const attribute = attributeOf(node);
      if (attribute !== undefined) {
        const readerFacing = READER_FACING_ATTRIBUTES.has(attribute.name.getText());
        if (readerFacing && HAS_LETTER.test(node.text)) found.push(node.text);
      } else if (
        !ts.isImportDeclaration(node.parent) &&
        !ts.isExpressionStatement(node.parent) &&
        READS_AS_COPY.test(node.text)
      ) {
        found.push(node.text);
      }
    } else if (ts.isTemplateExpression(node)) {
      const words = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("");
      if (HAS_LETTER.test(words)) found.push(words);
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}
