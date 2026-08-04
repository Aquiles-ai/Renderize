import { RADIX_PACKAGES, radixPrefix } from "./catalog.js";

const BASE_IMPORT_MAP: Record<string, string> = {
  react: "https://esm.sh/react@18",
  "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
  "react-dom": "https://esm.sh/react-dom@18",
  "react-dom/client": "https://esm.sh/react-dom@18/client",
};

const radixUrl = (pkg: string) =>
  `https://esm.sh/${pkg}?external=react,react-dom`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds the sandbox srcdoc for a piece of (already sanitized) user code.
 *
 * @param code        Sanitized LLM code.
 * @param extraImports Extra importmap entries (bare specifier -> esm.sh URL).
 * @param usedRadix   Radix packages to expose as compound-component
 *                    namespaces (e.g. `Dialog` for @radix-ui/react-dialog).
 */
export function buildTemplate(
  code: string,
  extraImports: Record<string, string> = {},
  usedRadix: string[] = []
): string {
  const importMap: Record<string, string> = { ...BASE_IMPORT_MAP };
  for (const pkg of RADIX_PACKAGES) importMap[pkg] = radixUrl(pkg);
  Object.assign(importMap, extraImports);

  const importMapJson = JSON.stringify({ imports: importMap });

  // Namespace injection: `Dialog` -> compound component namespace
  // (Dialog.Root, Dialog.Trigger, ...) resolved to @radix-ui/react-dialog.
  const radixSetup = usedRadix
    .map((pkg) => {
      const prefix = radixPrefix(pkg);
      return `import * as _Radix${prefix} from "${radixUrl(pkg)}";\nconst ${prefix} = _Radix${prefix};`;
    })
    .join("\n");
  const modulePrelude = radixSetup ? `${radixSetup}\n` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>

  <script type="importmap">
  ${importMapJson}
  <\/script>

  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }

    /* Scrollbar personalizada: fina y semi-transparente */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.35);
      border-radius: 999px;
      transition: background 0.2s ease;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.55);
    }
    /* Firefox */
    * {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
    }
  <\/style>
<\/head>
<body>
  <div id="root"><\/div>

  <script>
    // ── FETCH PROXY ──────────────────────────────────────────────────
    // Override window.fetch to proxy requests through the parent window.
    // This solves the CORS/null-origin issue with srcdoc iframes:
    // the parent has a real origin and can make fetch calls freely.
    window.fetch = function(url, options = {}) {
      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);

        // Serialize body — postMessage can't transfer Request objects
        const serializedOptions = {
          method: options.method || "GET",
          headers: options.headers || {},
          body: options.body || null,
        };

        // Listen for the response from the parent
        function handleMessage(event) {
          if (
            event.source !== window.parent ||
            event.data?.source !== "renderize" ||
            event.data?.type !== "fetch-response" ||
            event.data?.id !== id
          ) return;

          window.removeEventListener("message", handleMessage);

          if (event.data.error) {
            reject(new Error(event.data.error));
            return;
          }

          // Reconstruct a real Response object from the serialized data
          const { status, statusText, headers, body } = event.data;
          const responseBody = typeof body === "string" ? body : JSON.stringify(body);

          const response = new Response(responseBody, {
            status,
            statusText,
            headers: new Headers(headers),
          });

          resolve(response);
        }

        window.addEventListener("message", handleMessage);

        // Ask the parent to perform the fetch on our behalf
        window.parent.postMessage({
          source: "renderize",
          type: "fetch-request",
          id,
          url,
          options: serializedOptions,
        }, "*");
      });
    };
    // ── END FETCH PROXY ──────────────────────────────────────────────

    // ── ERROR FORWARDING ─────────────────────────────────────────────
    // Surfaces runtime errors to the parent via onError().
    window.addEventListener("error", function(event) {
      var message = event.error && event.error.message ? event.error.message : event.message;
      window.parent.postMessage({ source: "renderize", type: "error", message: String(message) }, "*");
    }, true);
    window.addEventListener("unhandledrejection", function(event) {
      var reason = event.reason;
      window.parent.postMessage({
        source: "renderize",
        type: "error",
        message: String(reason && reason.message ? reason.message : reason),
      }, "*");
    }, true);
    // ── END ERROR FORWARDING ─────────────────────────────────────────
  <\/script>

  <script type="text/babel" data-type="module">
    import React, {
      useState, useEffect, useRef, useCallback,
      useMemo, useReducer, useContext, createContext,
      forwardRef, Fragment
    } from "react";
    import { createRoot } from "react-dom/client";

    ${modulePrelude}
    // ── USER CODE START ──────────────────────────────────────────────
    ${code}
    // ── USER CODE END ────────────────────────────────────────────────

    class RenderizeErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { message: null };
      }
      static getDerivedStateFromError(error) {
        return { message: (error && error.message) || String(error) };
      }
      componentDidCatch(error) {
        window.parent.postMessage({
          source: "renderize",
          type: "error",
          message: (error && error.message) || String(error),
        }, "*");
      }
      render() {
        if (this.state.message) {
          return React.createElement(
            "div",
            { style: { padding: "16px", fontFamily: "system-ui, sans-serif", color: "#b91c1c", whiteSpace: "pre-wrap" } },
            "Render error: " + this.state.message
          );
        }
        return this.props.children;
      }
    }

    const container = document.getElementById("root");
    createRoot(container).render(
      React.createElement(RenderizeErrorBoundary, null, React.createElement(App))
    );
  <\/script>
<\/body>
<\/html>`;
}

/**
 * Builds the srcdoc shown when the code fails to sanitize/resolve — a clear,
 * agent-friendly error screen instead of a silently broken (or blank) iframe.
 */
export function buildErrorTemplate(error: string): string {
  const escaped = escapeHtml(error);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: #0d0d12;
      color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      max-width: 640px;
      width: 100%;
      background: #16161d;
      border: 1px solid #2a2a38;
      border-radius: 12px;
      padding: 20px 24px;
    }
    .badge {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #8b8b9e;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .msg {
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Renderize Sandbox</div>
    <div class="msg">${escaped}</div>
  </div>
</body>
</html>`;
}
