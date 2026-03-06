export function buildTemplate(code: string): string {
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Tailwind CSS Play CDN -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Babel standalone: transpiles JSX at runtime -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <!-- Import map: React + Radix UI + Lucide -->
  <script type="importmap">
  {
    "imports": {
      "react":                              "https://esm.sh/react@18",
      "react/jsx-runtime":                  "https://esm.sh/react@18/jsx-runtime",
      "react-dom":                          "https://esm.sh/react-dom@18",
      "react-dom/client":                   "https://esm.sh/react-dom@18/client",
      "lucide-react":                       "https://esm.sh/lucide-react@latest",
      "clsx":                               "https://esm.sh/clsx",
      "class-variance-authority":           "https://esm.sh/class-variance-authority",
      "tailwind-merge":                     "https://esm.sh/tailwind-merge",
      "@radix-ui/react-accordion":          "https://esm.sh/@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog":       "https://esm.sh/@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar":             "https://esm.sh/@radix-ui/react-avatar",
      "@radix-ui/react-checkbox":           "https://esm.sh/@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible":        "https://esm.sh/@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu":       "https://esm.sh/@radix-ui/react-context-menu",
      "@radix-ui/react-dialog":             "https://esm.sh/@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu":      "https://esm.sh/@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card":         "https://esm.sh/@radix-ui/react-hover-card",
      "@radix-ui/react-label":              "https://esm.sh/@radix-ui/react-label",
      "@radix-ui/react-menubar":            "https://esm.sh/@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu":    "https://esm.sh/@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover":            "https://esm.sh/@radix-ui/react-popover",
      "@radix-ui/react-progress":           "https://esm.sh/@radix-ui/react-progress",
      "@radix-ui/react-radio-group":        "https://esm.sh/@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area":        "https://esm.sh/@radix-ui/react-scroll-area",
      "@radix-ui/react-select":             "https://esm.sh/@radix-ui/react-select",
      "@radix-ui/react-separator":          "https://esm.sh/@radix-ui/react-separator",
      "@radix-ui/react-slider":             "https://esm.sh/@radix-ui/react-slider",
      "@radix-ui/react-slot":               "https://esm.sh/@radix-ui/react-slot",
      "@radix-ui/react-switch":             "https://esm.sh/@radix-ui/react-switch",
      "@radix-ui/react-tabs":               "https://esm.sh/@radix-ui/react-tabs",
      "@radix-ui/react-toast":              "https://esm.sh/@radix-ui/react-toast",
      "@radix-ui/react-toggle":             "https://esm.sh/@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group":       "https://esm.sh/@radix-ui/react-toggle-group",
      "@radix-ui/react-toolbar":            "https://esm.sh/@radix-ui/react-toolbar",
      "@radix-ui/react-tooltip":            "https://esm.sh/@radix-ui/react-tooltip"
    }
  }
  </script>

  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel" data-type="module">
    import { createRoot } from "react-dom/client";

    // ── USER CODE START ──────────────────────────────────────────────
    ${code}
    // ── USER CODE END ────────────────────────────────────────────────

    const container = document.getElementById("root");
    createRoot(container).render(<App />);
  </script>
</body>
</html>
`.trim();
}