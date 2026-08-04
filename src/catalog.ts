/**
 * Machine-readable catalog of packages available inside the Renderize sandbox.
 *
 * Exposed as `Renderize.CATALOG` so hosts can feed it to an LLM's system
 * prompt. The model writes plain imports — the sandbox resolves them
 * automatically against this catalog (no importmap knowledge required).
 */
export interface CatalogEntry {
  /** Bare specifier the model uses in its import statement. */
  name: string;
  /** Optional pinned version. When omitted, esm.sh resolves latest. */
  version?: string;
  /** One-line description for the LLM. */
  description: string;
  /** Example import statement. */
  example: string;
}

export const CATALOG: CatalogEntry[] = [
  {
    name: "react",
    description:
      "UI library. Already loaded by the sandbox — hooks (useState, useEffect, ...) are available without importing.",
    example: "// no import needed",
  },
  {
    name: "react-dom",
    description: "React DOM. Already loaded by the sandbox.",
    example: "// no import needed",
  },
  {
    name: "radix",
    description:
      "All Radix UI primitives in one namespace (Dialog, Select, Tabs, Tooltip, ...). Use compound components like <Dialog.Root>.",
    example: 'import { Dialog } from "radix"',
  },
  {
    name: "lucide-react",
    description: "Popular icon set.",
    example: 'import { Plus, Trash2 } from "lucide-react"',
  },
  {
    name: "clsx",
    description: "Conditional className builder.",
    example: 'import { clsx } from "clsx"',
  },
  {
    name: "tailwind-merge",
    description: "Merges Tailwind classes without conflicts.",
    example: 'import { twMerge } from "tailwind-merge"',
  },
  {
    name: "class-variance-authority",
    description: "Variant-based styling for components.",
    example: 'import { cva } from "class-variance-authority"',
  },
  {
    name: "recharts",
    description: "Composable charting library.",
    example:
      'import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts"',
  },
  {
    name: "framer-motion",
    description: "Animation library for React.",
    example: 'import { motion, AnimatePresence } from "framer-motion"',
  },
  {
    name: "three",
    description: "3D graphics library.",
    example: 'import * as THREE from "three"',
  },
  {
    name: "zustand",
    description: "Tiny state management store.",
    example: 'import { create } from "zustand"',
  },
  {
    name: "date-fns",
    description: "Date manipulation utilities.",
    example: 'import { format } from "date-fns"',
  },
  {
    name: "axios",
    description: "HTTP client for API calls.",
    example: 'import axios from "axios"',
  },
  {
    name: "react-hook-form",
    description: "Form state and validation hooks.",
    example: 'import { useForm } from "react-hook-form"',
  },
  {
    name: "zod",
    description: "Schema declaration and validation.",
    example: 'import { z } from "zod"',
  },
  {
    name: "@tanstack/react-query",
    description: "Server state and data fetching hooks.",
    example: 'import { useQuery } from "@tanstack/react-query"',
  },
  {
    name: "sonner",
    description: "Toast notifications. Render <Toaster /> once to display toasts.",
    example: 'import { toast } from "sonner"',
  },
];

/** Names of every package in the catalog, in catalog order. */
export const CATALOG_NAMES: string[] = CATALOG.map((entry) => entry.name);

/** name -> entry lookup. */
export const CATALOG_MAP: Map<string, CatalogEntry> = new Map(
  CATALOG.map((entry) => [entry.name, entry])
);

/**
 * Radix UI packages resolved natively by the sandbox (lazy — only fetched
 * when the code imports them). They can be imported directly by their real
 * name, or through the `radix` barrel for compound-component namespaces.
 */
export const RADIX_PACKAGES: string[] = [
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
];

/**
 * Derives the namespace prefix for a Radix package.
 * "@radix-ui/react-radio-group" -> "RadioGroup"
 * "@radix-ui/react-dialog"     -> "Dialog"
 */
export function radixPrefix(pkg: string): string {
  const base = pkg.replace(/^@radix-ui\/react-/, "");
  return base.replace(/(?:^|-)([a-z])/g, (_, c: string) => c.toUpperCase());
}
