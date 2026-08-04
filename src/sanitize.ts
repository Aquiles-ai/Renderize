import type { CatalogEntry } from "./catalog.js";
import { CATALOG_MAP, CATALOG_NAMES, RADIX_PACKAGES, radixPrefix } from "./catalog.js";

export interface SanitizeResult {
  /** Cleaned code, ready to be embedded in the sandbox module. */
  code: string;
  /** Extra importmap entries (bare specifier -> esm.sh URL), including subpath prefixes. */
  importMap: Record<string, string>;
  /** Radix packages used by the code (barrel namespaces will be injected). */
  radix: string[];
  /** Fail-loud error when the code imports a package outside the catalog. */
  error?: string;
}

/**
 * Modules injected by the sandbox template (react, react-dom, the `radix`
 * barrel). Imports from these are always stripped — their bindings are
 * already in module scope.
 */
const TEMPLATE_PROVIDED_MODULES = new Set([
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "radix",
]);

/**
 * Named bindings already in scope thanks to the template's explicit imports.
 * If an import only pulls names from this set, the whole line is stripped.
 */
const TEMPLATE_PROVIDED_NAMES = new Set([
  "React",
  "useState",
  "useEffect",
  "useRef",
  "useCallback",
  "useMemo",
  "useReducer",
  "useContext",
  "createContext",
  "forwardRef",
  "Fragment",
  "createRoot",
]);

/**
 * Registers a catalog package in the importmap, including a subpath prefix
 * entry (e.g. "three/": "https://esm.sh/three/") so deep imports like
 * "three/examples/jsm/controls/OrbitControls.js" resolve too.
 */
function addToImportMap(map: Record<string, string>, entry: CatalogEntry): void {
  const version = entry.version ? `@${entry.version}` : "";
  map[entry.name] = `https://esm.sh/${entry.name}${version}?external=react,react-dom`;
  map[`${entry.name}/`] = `https://esm.sh/${entry.name}${version}/`;
}

function buildUnavailableError(modulePath: string): string {
  return `Package "${modulePath}" is not available in the Renderize sandbox. Available packages: ${CATALOG_NAMES.join(", ")}.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Given a string and the index of an opening brace, returns the index
 * immediately AFTER the matching closing brace (or -1 if not found).
 * Handles nesting and ignores braces inside string literals.
 */
function findMatchingBrace(code: string, openIndex: number): number {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = 0;

  for (let i = openIndex; i < code.length; i++) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : "";

    if (prev === "\\") continue; // escaped — skip

    if (!inDouble && !inTemplate && ch === "'") { inSingle = !inSingle; continue; }
    if (!inSingle && !inTemplate && ch === '"')  { inDouble = !inDouble; continue; }
    if (!inSingle && !inDouble && ch === "`") {
      inTemplate = inTemplate ? inTemplate - 1 : inTemplate + 1;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Strips top-level TypeScript block declarations (interface / enum)
 * that Babel standalone cannot parse without @babel/preset-typescript.
 * Also strips `type X = ...` aliases (block or inline).
 */
function stripTypeScriptDeclarations(code: string): string {
  // ── interface Foo { ... } and enum Foo { ... } ─────────────────────────
  const blockKeywords = /(?:export\s+)?(?:interface|enum)\s+\w[\w<,\s>]*\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = blockKeywords.exec(code)) !== null) {
    const openBrace = code.indexOf("{", match.index + match[0].length - 1);
    if (openBrace === -1) continue;
    const end = findMatchingBrace(code, openBrace);
    if (end === -1) continue;
    const tail = code[end] === ";" ? end + 1 : end;
    code = code.slice(0, match.index) + code.slice(tail);
    blockKeywords.lastIndex = match.index;
  }

  // ── type Foo = { ... } or type Foo = string | number; ──────────────────
  // Strip the header and then either the brace block or the rest of the line.
  code = code.replace(
    /^(?:export\s+)?type\s+\w[\w<,\s>]*\s*=\s*/gm,
    (_header, offset, fullCode) => {
      const rest = fullCode.slice(offset + _header.length);
      const trimmed = rest.trimStart();
      if (trimmed.startsWith("{")) {
        const relOpen = rest.indexOf("{");
        const end = findMatchingBrace(rest, relOpen);
        if (end !== -1) {
          code = fullCode.slice(0, offset) + fullCode.slice(offset + _header.length + end);
        }
      }
      // For inline types, removing the header is enough; the value
      // (e.g. "string | number;\n") becomes a no-op expression statement
      // which Babel tolerates, so we don't need to strip it.
      return "";
    }
  );

  return code;
}

/**
 * Strips TypeScript `as` type assertions from expressions.
 * Carefully avoids import/export aliases like `import { x as y }`.
 *
 *   (value as string)        →  (value)
 *   setState(count as number) →  setState(count)
 *   const x = foo as Bar;    →  const x = foo;
 *
 * NOT touched:
 *   import { foo as bar } from "..."
 *   export { baz as default }
 */
function stripAsAssertions(code: string): string {
  return code.replace(
    /(?<![{,]\s*\w+)\s+as\s+[A-Z]\w*(?:<[^>]*>)?(?:\[\])?(?=\s*[),;}\n])/g,
    ""
  );
}

/**
 * Detects the name of the main React component the LLM defined, if it is not
 * already "App". Returns null when renaming is not necessary.
 *
 * Priority order:
 *   1. export default function X  →  X
 *   2. export default const/let X = ...  →  X
 *   3. Only PascalCase function/const visible at the top level  →  X
 */
function detectMainComponentName(code: string): string | null {
  const fnExport = code.match(/export\s+default\s+function\s+([A-Z]\w*)/);
  // @ts-ignore
  if (fnExport && fnExport[1] !== "App") return fnExport[1];

  const constExport = code.match(/export\s+default\s+(?:const|let)\s+([A-Z]\w*)/);
  // @ts-ignore
  if (constExport && constExport[1] !== "App") return constExport[1];

  // Fallback: single PascalCase function/const that is not App
  const allDefs = [
    ...code.matchAll(
      /^(?:function|const|let)\s+([A-Z]\w*)\s*(?:=\s*(?:\(|React\.memo\()|[\(<(])/gm
    ),
  ].map((m) => m[1]).filter((n) => n !== "App");

  // @ts-ignore
  if (allDefs.length === 1) return allDefs[0];

  return null;
}

/**
 * Collapses newlines inside multiline import statements so the per-line
 * import processor below can handle them (LLMs often emit multiline imports).
 */
function flattenMultilineImports(code: string): string {
  return code.replace(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["'][^"']+["']\s*;?/g,
    (line) => line.replace(/\s*\n\s*/g, " ")
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Sanitizes LLM-generated React code and resolves its imports against the
 * catalog, before passing it to buildTemplate().
 *
 * Steps (in order):
 *  1. Strip markdown code fences
 *  2. Fix double-escaped literals (\\n, \\t, \\r)
 *  3. Strip Next.js / RSC directives ('use client', 'use server')
 *  4. Strip TypeScript-only syntax (interface, type, enum, `as` assertions)
 *  5. Ensure the main component is named App and has no export keyword
 *  6. Resolve imports:
 *       - template-provided modules (react, radix, ...) → stripped
 *       - catalog packages → kept + added to the dynamic importmap
 *       - anything else → fail loud: stripped and reported as `error`
 *  7. Strip CommonJS require() calls
 *  8. Detect Radix usage (barrel namespaces to inject)
 *  9. Collapse excessive blank lines
 */
export function sanitizeCode(raw: string): SanitizeResult {
  let code = raw;
  const importMap: Record<string, string> = {};
  const errors: string[] = [];

  // ── 1. Strip markdown code fences ───────────────────────────────────────
  code = code.replace(/^```[a-zA-Z]*\r?\n?/, "").replace(/\r?\n?```\s*$/, "");

  // ── 2. Fix double-escaped literal sequences ─────────────────────────────
  // Only collapses \\n -> \n (two backslashes + n). Correct single-escaped
  // code like `"a\nb"` is left untouched — escaping it would be a SyntaxError.
  code = code
    .replace(/\\\\n/g, "\\n")
    .replace(/\\\\t/g, "\\t")
    .replace(/\\\\r/g, "\\r");

  // ── 3. Strip Next.js / RSC directives ───────────────────────────────────
  code = code.replace(/^\s*['"]use (client|server)['"]\s*;?\s*\n?/gm, "");

  // ── 4. Strip TypeScript-only syntax ─────────────────────────────────────
  code = stripTypeScriptDeclarations(code);
  code = stripAsAssertions(code);

  // ── 5. Fix component name and remove export keywords ────────────────────
  // The template calls React.createElement(App), so App must be a plain
  // function in module scope — no export keyword.

  const originalName = detectMainComponentName(code);
  if (originalName) {
    // Rename all occurrences of the original name to "App"
    code = code.replace(new RegExp(`\\b${originalName}\\b`, "g"), "App");
  }

  // Strip "export default" prefix from the App declaration
  code = code.replace(/\bexport\s+default\s+(function\s+App\b)/, "$1");
  code = code.replace(/\bexport\s+default\s+((?:const|let)\s+App\b)/, "$1");

  // Strip "export" (non-default) prefix from the App declaration
  code = code.replace(/\bexport\s+(function\s+App\b)/, "$1");
  code = code.replace(/\bexport\s+((?:const|let)\s+App\b)/, "$1");

  // ── 6. Resolve imports ──────────────────────────────────────────────────
  code = flattenMultilineImports(code);

  const importLineRegex =
    /^import\s+(?:type\s+)?(?:[^"'\n]+\s+from\s+)?["']([^"']+)["'];?\s*$/gm;

  code = code.replace(importLineRegex, (line, modulePath) => {
    // Template-provided modules (react, react-dom, radix) are already in scope
    if (TEMPLATE_PROVIDED_MODULES.has(modulePath)) return "";

    // Strip if all named imports are already in scope from the template
    const namedMatch = line.match(/\{([^}]+)\}/);
    if (namedMatch) {
      // @ts-ignore
      const names = namedMatch[1]
        .split(",")
        // @ts-ignore
        .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      if (names.length > 0 && names.every((n) => TEMPLATE_PROVIDED_NAMES.has(n))) {
        return "";
      }
    }

    // Catalog package → keep the import, wire it into the dynamic importmap
    const entry = CATALOG_MAP.get(modulePath);
    if (entry) {
      addToImportMap(importMap, entry);
      return line;
    }

    // Deep import from a catalog package (e.g. "three/examples/...")
    for (const name of CATALOG_MAP.keys()) {
      if (modulePath.startsWith(`${name}/`)) {
        const catalogEntry = CATALOG_MAP.get(name);
        if (catalogEntry) addToImportMap(importMap, catalogEntry);
        return line;
      }
    }

    // Radix packages are resolvable natively (the template importmap always
    // contains the full Radix suite)
    if (RADIX_PACKAGES.includes(modulePath)) return line;

    // Fail loud — never silently strip
    errors.push(buildUnavailableError(modulePath));
    return "";
  });

  // ── 7. Strip CommonJS require() calls ───────────────────────────────────
  // The sandbox runs as ESM; require() is undefined.
  code = code.replace(
    /^(?:const|let|var)\s+[\w\s,{}]+\s*=\s*require\s*\(["'][^"']+["']\)\s*;?\s*$/gm,
    ""
  );

  // ── 8. Detect Radix usage for barrel namespace injection ────────────────
  const radix: string[] = [];
  for (const pkg of RADIX_PACKAGES) {
    const prefix = radixPrefix(pkg);
    if (new RegExp(`\\b${prefix}`).test(code)) radix.push(pkg);
  }

  // ── 9. Collapse excessive blank lines ────────────────────────────────────
  code = code.replace(/\n{3,}/g, "\n\n");

  const result: SanitizeResult = {
    code: code.trim(),
    importMap,
    radix,
  };
  if (errors.length > 0) result.error = errors.join("\n");
  return result;
}
