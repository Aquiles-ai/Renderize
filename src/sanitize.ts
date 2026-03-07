// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Modules already injected by the sandbox template (react, react-dom, etc.).
 * Imports from these are always stripped.
 */
const TEMPLATE_PROVIDED_MODULES = new Set([
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
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
 * Every module present in the template's importmap.
 * Imports from modules NOT in this set are stripped (they'd cause a network
 * error or a module-resolution failure inside the srcdoc iframe).
 */
const IMPORTMAP_MODULES = new Set([
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "lucide-react",
  "clsx",
  "class-variance-authority",
  "tailwind-merge",
  "@radix-ui/react-accordion",
  "@radix-ui/react-alert-dialog",
  "@radix-ui/react-avatar",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-collapsible",
  "@radix-ui/react-context-menu",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-hover-card",
  "@radix-ui/react-label",
  "@radix-ui/react-menubar",
  "@radix-ui/react-navigation-menu",
  "@radix-ui/react-popover",
  "@radix-ui/react-progress",
  "@radix-ui/react-radio-group",
  "@radix-ui/react-scroll-area",
  "@radix-ui/react-select",
  "@radix-ui/react-separator",
  "@radix-ui/react-slider",
  "@radix-ui/react-slot",
  "@radix-ui/react-switch",
  "@radix-ui/react-tabs",
  "@radix-ui/react-toast",
  "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group",
  "@radix-ui/react-toolbar",
  "@radix-ui/react-tooltip",
]);

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

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Sanitizes LLM-generated React code before passing it to buildTemplate().
 *
 * Steps (in order):
 *  1. Strip markdown code fences
 *  2. Fix literal escape sequences (\\n, \\t, \\r)
 *  3. Strip Next.js / RSC directives ('use client', 'use server')
 *  4. Strip TypeScript-only syntax (interface, type, enum, `as` assertions)
 *  5. Ensure the main component is named App and has no export keyword
 *  6. Strip imports from modules outside the importmap
 *  7. Strip CommonJS require() calls
 *  8. Collapse excessive blank lines
 */
export function sanitizeCode(raw: string): string {
  let code = raw;

  // ── 1. Strip markdown code fences ───────────────────────────────────────
  code = code.replace(/^```[a-zA-Z]*\r?\n?/, "").replace(/\r?\n?```\s*$/, "");

  // ── 2. Fix literal escape sequences ─────────────────────────────────────
  code = code
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");

  // ── 3. Strip Next.js / RSC directives ───────────────────────────────────
  code = code.replace(/^\s*['"]use (client|server)['"]\s*;?\s*\n?/gm, "");

  // ── 4. Strip TypeScript-only syntax ─────────────────────────────────────
  code = stripTypeScriptDeclarations(code);
  code = stripAsAssertions(code);

  // ── 5. Fix component name and remove export keywords ────────────────────
  // The template calls React.createElement(App), so App must be a plain
  // function in global scope — no export keyword.

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

  // ── 6. Strip imports from modules outside the importmap ─────────────────
  const importLineRegex =
    /^import\s+(?:type\s+)?(?:[^"'\n]+\s+from\s+)?["']([^"']+)["'];?\s*$/gm;

  code = code.replace(importLineRegex, (line, modulePath) => {
    // Always strip template-provided modules (already in global scope)
    if (TEMPLATE_PROVIDED_MODULES.has(modulePath)) return "";

    // Strip anything outside the importmap (would cause a fetch/resolve error)
    if (!IMPORTMAP_MODULES.has(modulePath)) return "";

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

    return line;
  });

  // ── 7. Strip CommonJS require() calls ───────────────────────────────────
  // The sandbox runs as ESM; require() is undefined.
  code = code.replace(
    /^(?:const|let|var)\s+[\w\s,{}]+\s*=\s*require\s*\(["'][^"']+["']\)\s*;?\s*$/gm,
    ""
  );

  // ── 8. Collapse excessive blank lines ────────────────────────────────────
  code = code.replace(/\n{3,}/g, "\n\n");

  return code.trim();
}