/**
 * A deliberately small block-YAML reader, used only to assert facts about this
 * repository's own GitHub Actions workflows.
 *
 * It exists because those assertions are worth making structurally rather than
 * by regular expression — "the `promote` job declares no permissions at all"
 * is a statement about a mapping, and a grep for `permissions: {}` cannot tell
 * the difference between that job and a comment. It is *not* a general YAML
 * implementation: no anchors, no aliases, no multiple documents, no tags, no
 * flow mappings beyond `{}`, and no type coercion — every scalar stays a
 * string, so `cancel-in-progress: false` reads as `"false"` and a workflow
 * that changed it to `off` would be visible rather than silently equal.
 *
 * Anything it does not understand throws. That is the point: a workflow this
 * cannot parse is a workflow whose guarantees are not being checked, and the
 * suite must fail rather than quietly assert nothing.
 */

export type YamlValue = string | YamlValue[] | { readonly [key: string]: YamlValue };

interface Line {
  indent: number;
  text: string;
  raw: string;
}

const MAPPING_ENTRY = /^("[^"]*"|'[^']*'|[^:]+):(?:[ \t]+(.*))?$/;
const BLOCK_SCALAR = /^[|>][+-]?$/;

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function scan(source: string): Line[] {
  return source.split("\n").map((raw) => {
    const text = raw.trim();
    return { raw, text, indent: raw.length - raw.trimStart().length };
  });
}

class Reader {
  private readonly lines: Line[];
  private index = 0;

  constructor(source: string) {
    this.lines = scan(source);
  }

  document(): YamlValue {
    const first = this.peek();
    if (first === undefined) return {};
    const value = this.block(first.indent);
    const trailing = this.peek();
    if (trailing !== undefined) {
      throw new Error(`unsupported trailing content: ${trailing.raw}`);
    }
    return value;
  }

  private peek(): Line | undefined {
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      if (line === undefined) break;
      if (line.text === "" || line.text.startsWith("#") || line.text === "---") {
        this.index += 1;
        continue;
      }
      return line;
    }
    return undefined;
  }

  private block(indent: number): YamlValue {
    const first = this.peek();
    if (first === undefined || first.indent < indent) return "";
    return first.text === "-" || first.text.startsWith("- ")
      ? this.sequence(indent)
      : this.mapping(indent);
  }

  private mapping(indent: number): YamlValue {
    const result: Record<string, YamlValue> = {};
    for (;;) {
      const line = this.peek();
      if (line === undefined || line.indent < indent) break;
      if (line.indent > indent) {
        throw new Error(`unexpected indentation: ${line.raw}`);
      }
      const entry = MAPPING_ENTRY.exec(line.text);
      if (entry === null) {
        throw new Error(`unsupported mapping entry: ${line.raw}`);
      }
      const key = unquote(entry[1]!.trim());
      if (key in result) {
        throw new Error(`duplicate mapping key: ${key}`);
      }
      this.index += 1;
      result[key] = this.value(entry[2]?.trim() ?? "", indent);
    }
    return result;
  }

  private sequence(indent: number): YamlValue {
    const result: YamlValue[] = [];
    for (;;) {
      const line = this.peek();
      if (line === undefined || line.indent < indent) break;
      if (line.indent > indent) {
        throw new Error(`unexpected indentation: ${line.raw}`);
      }
      if (line.text !== "-" && !line.text.startsWith("- ")) break;
      const rest = line.text === "-" ? "" : line.text.slice(2).trim();
      const itemIndent = indent + 2;
      if (rest === "") {
        this.index += 1;
        const next = this.peek();
        result.push(next !== undefined && next.indent > indent ? this.block(next.indent) : "");
        continue;
      }
      if (MAPPING_ENTRY.test(rest)) {
        // Re-present `- key: value` as a mapping line one level in, so the
        // item's remaining keys — which sit at that indentation — parse with it.
        this.lines[this.index] = {
          indent: itemIndent,
          text: rest,
          raw: `${" ".repeat(itemIndent)}${rest}`,
        };
        result.push(this.mapping(itemIndent));
        continue;
      }
      this.index += 1;
      result.push(unquote(rest));
    }
    return result;
  }

  private value(inline: string, keyIndent: number): YamlValue {
    if (inline === "") {
      const next = this.peek();
      if (next === undefined) return "";
      if (next.indent > keyIndent) return this.block(next.indent);
      if (next.indent === keyIndent && (next.text === "-" || next.text.startsWith("- "))) {
        return this.sequence(keyIndent);
      }
      return "";
    }
    if (BLOCK_SCALAR.test(inline)) {
      return this.blockScalar(inline, keyIndent);
    }
    if (inline === "{}") return {};
    if (inline.startsWith("{")) {
      throw new Error(`unsupported flow mapping: ${inline}`);
    }
    if (inline.startsWith("[") && inline.endsWith("]")) {
      return inline
        .slice(1, -1)
        .split(",")
        .map((item) => unquote(item.trim()))
        .filter((item) => item !== "");
    }
    return unquote(inline);
  }

  private blockScalar(header: string, keyIndent: number): string {
    const collected: string[] = [];
    let contentIndent = -1;
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      if (line === undefined) break;
      if (line.text === "") {
        collected.push("");
        this.index += 1;
        continue;
      }
      if (line.indent <= keyIndent) break;
      if (contentIndent < 0) contentIndent = line.indent;
      collected.push(line.raw.slice(contentIndent));
      this.index += 1;
    }
    while (collected.length > 0 && collected[collected.length - 1] === "") {
      collected.pop();
    }
    if (header.startsWith(">")) {
      // Folded: lines inside a paragraph join with a space, blank lines break.
      return collected
        .reduce<string[]>((paragraphs, line) => {
          if (line === "") {
            paragraphs.push("");
            return paragraphs;
          }
          const last = paragraphs[paragraphs.length - 1];
          if (last === undefined || last === "") paragraphs.push(line);
          else paragraphs[paragraphs.length - 1] = `${last} ${line}`;
          return paragraphs;
        }, [])
        .join("\n");
    }
    return collected.join("\n");
  }
}

/** Parses the block-YAML subset described above, or throws. */
export function parseYamlSubset(source: string): YamlValue {
  return new Reader(source).document();
}

/** Narrows a value to a mapping, throwing with `path` when it is not one. */
export function asMapping(value: YamlValue, path: string): { readonly [key: string]: YamlValue } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} is not a mapping`);
  }
  return value;
}

/** Narrows a value to a sequence, throwing with `path` when it is not one. */
export function asSequence(value: YamlValue, path: string): readonly YamlValue[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} is not a sequence`);
  }
  return value;
}

/** Narrows a value to a scalar, throwing with `path` when it is not one. */
export function asScalar(value: YamlValue, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} is not a scalar`);
  }
  return value;
}

/** Every scalar reachable from `value`, in document order. */
export function scalars(value: YamlValue): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => scalars(item));
  return Object.values(value).flatMap((item) => scalars(item));
}
