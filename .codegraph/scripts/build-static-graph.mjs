#!/usr/bin/env node
/**
 * build-static-graph.mjs
 *
 * Walks the repo, extracts file-level dependencies and top-level TypeScript
 * symbols, and emits a Mermaid `graph LR` block to stdout. Used to keep
 * .codegraph/CODEGRAPH.md honest — the script does not auto-edit the file
 * (the Mermaid block is hand-curated), but its JSON summary is printed so
 * humans can diff it against the doc.
 *
 * Usage:
 *   node .codegraph/scripts/build-static-graph.mjs [--root <dir>]
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const ROOT =
  rootIdx >= 0
    ? resolve(args[rootIdx + 1])
    : resolve(fileURLToPath(import.meta.url), "..", "..", "..");

const IGNORE = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".adalflow",
  ".codegraph/cache",
  ".codegraph/index",
  ".codegraph/logs",
]);

const SOURCE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir)) {
    if (IGNORE.has(entry)) continue;
    const full = join(dir, entry);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      if (entry.startsWith(".") && entry !== ".codegraph") continue;
      out.push(...(await walk(full)));
    } else if (s.isFile()) {
      const dot = entry.lastIndexOf(".");
      if (dot < 0) continue;
      const ext = entry.slice(dot);
      if (SOURCE_EXT.has(ext)) out.push(full);
    }
  }
  return out;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import\s+(?:type\s+)?[^'"]*?from\s+|import\s+|export\s+(?:type\s+)?[^'"]*?from\s+|require\s*\()\s*['"]([^'"]+)['"]/g;
const SYMBOL_RE = /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;

function extractRel(fromFile, spec) {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null; // bare module, external
  const base = resolve(fromFile, "..", spec);
  const rel = relative(ROOT, base).split(sep).join("/");
  return rel;
}

async function buildGraph() {
  const files = (await walk(ROOT)).sort();
  const nodes = [];
  const edges = [];
  const symbols = {};

  for (const file of files) {
    const rel = relative(ROOT, file);
    const text = await readFile(file, "utf8").catch(() => "");
    nodes.push({ id: rel, size: text.length });

    // edges
    for (const m of text.matchAll(IMPORT_RE)) {
      const target = extractRel(file, m[1]);
      if (target && files.some((f) => relative(ROOT, f) === target || relative(ROOT, f) === target + ".ts" || relative(ROOT, f) === target + ".tsx")) {
        edges.push({ from: rel, to: target });
      }
    }

    // top-level symbols
    const found = new Set();
    for (const m of text.matchAll(SYMBOL_RE)) found.add(m[1]);
    symbols[rel] = [...found].sort();
  }

  return { nodes, edges, symbols };
}

const graph = await buildGraph();
const summary = {
  root: ROOT,
  fileCount: graph.nodes.length,
  totalBytes: graph.nodes.reduce((s, n) => s + n.size, 0),
  internalEdgeCount: graph.edges.length,
  files: graph.nodes.map((n) => ({
    path: n.id,
    bytes: n.size,
    imports: graph.edges.filter((e) => e.from === n.id).map((e) => e.to),
    symbols: graph.symbols[n.id],
  })),
};

console.log(JSON.stringify(summary, null, 2));
console.error(
  `\n${summary.fileCount} files, ${summary.internalEdgeCount} internal edges, ${summary.totalBytes} bytes`,
);
