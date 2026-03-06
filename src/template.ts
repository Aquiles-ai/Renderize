export function buildTemplate(code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>

  <script type="importmap">
  {
    "imports": {
      "react":                              "https://esm.sh/react@18",
      "react/jsx-runtime":                  "https://esm.sh/react@18/jsx-runtime",
      "react-dom":                          "https://esm.sh/react-dom@18",
      "react-dom/client":                   "https://esm.sh/react-dom@18/client",
      "lucide-react":                       "https://esm.sh/lucide-react?external=react",
      "clsx":                               "https://esm.sh/clsx",
      "class-variance-authority":           "https://esm.sh/class-variance-authority",
      "tailwind-merge":                     "https://esm.sh/tailwind-merge",
      "@radix-ui/react-accordion":          "https://esm.sh/@radix-ui/react-accordion?external=react,react-dom",
      "@radix-ui/react-alert-dialog":       "https://esm.sh/@radix-ui/react-alert-dialog?external=react,react-dom",
      "@radix-ui/react-avatar":             "https://esm.sh/@radix-ui/react-avatar?external=react,react-dom",
      "@radix-ui/react-checkbox":           "https://esm.sh/@radix-ui/react-checkbox?external=react,react-dom",
      "@radix-ui/react-collapsible":        "https://esm.sh/@radix-ui/react-collapsible?external=react,react-dom",
      "@radix-ui/react-context-menu":       "https://esm.sh/@radix-ui/react-context-menu?external=react,react-dom",
      "@radix-ui/react-dialog":             "https://esm.sh/@radix-ui/react-dialog?external=react,react-dom",
      "@radix-ui/react-dropdown-menu":      "https://esm.sh/@radix-ui/react-dropdown-menu?external=react,react-dom",
      "@radix-ui/react-hover-card":         "https://esm.sh/@radix-ui/react-hover-card?external=react,react-dom",
      "@radix-ui/react-label":              "https://esm.sh/@radix-ui/react-label?external=react,react-dom",
      "@radix-ui/react-menubar":            "https://esm.sh/@radix-ui/react-menubar?external=react,react-dom",
      "@radix-ui/react-navigation-menu":    "https://esm.sh/@radix-ui/react-navigation-menu?external=react,react-dom",
      "@radix-ui/react-popover":            "https://esm.sh/@radix-ui/react-popover?external=react,react-dom",
      "@radix-ui/react-progress":           "https://esm.sh/@radix-ui/react-progress?external=react,react-dom",
      "@radix-ui/react-radio-group":        "https://esm.sh/@radix-ui/react-radio-group?external=react,react-dom",
      "@radix-ui/react-scroll-area":        "https://esm.sh/@radix-ui/react-scroll-area?external=react,react-dom",
      "@radix-ui/react-select":             "https://esm.sh/@radix-ui/react-select?external=react,react-dom",
      "@radix-ui/react-separator":          "https://esm.sh/@radix-ui/react-separator?external=react,react-dom",
      "@radix-ui/react-slider":             "https://esm.sh/@radix-ui/react-slider?external=react,react-dom",
      "@radix-ui/react-slot":               "https://esm.sh/@radix-ui/react-slot?external=react,react-dom",
      "@radix-ui/react-switch":             "https://esm.sh/@radix-ui/react-switch?external=react,react-dom",
      "@radix-ui/react-tabs":               "https://esm.sh/@radix-ui/react-tabs?external=react,react-dom",
      "@radix-ui/react-toast":              "https://esm.sh/@radix-ui/react-toast?external=react,react-dom",
      "@radix-ui/react-toggle":             "https://esm.sh/@radix-ui/react-toggle?external=react,react-dom",
      "@radix-ui/react-toggle-group":       "https://esm.sh/@radix-ui/react-toggle-group?external=react,react-dom",
      "@radix-ui/react-toolbar":            "https://esm.sh/@radix-ui/react-toolbar?external=react,react-dom",
      "@radix-ui/react-tooltip":            "https://esm.sh/@radix-ui/react-tooltip?external=react,react-dom"
    }
  }
  <\/script>

  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
  <\/style>
<\/head>
<body>
  <div id="root"><\/div>

  <script type="text/babel" data-type="module">
    import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext, createContext } from "react";
    import { createRoot } from "react-dom/client";

    // ── USER CODE START ──────────────────────────────────────────────
    ${code}
    // ── USER CODE END ────────────────────────────────────────────────

    const container = document.getElementById("root");
    createRoot(container).render(React.createElement(App));
  <\/script>
<\/body>
<\/html>`;
}