#!/usr/bin/env bun
import { parseArgs } from "node:util";

const {
  values: { pipe: pipeName, glob: globString, help, "fluent-file-dir": fluentFileDir, "default-locale": defaultLocale, "migrate-from-default": migrateFromDefault },
} = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    pipe: {
      type: "string",
      default: "fluent",
      short: "p",
    },
    glob: {
      type: "string",
      default: "src/**/*.html",
      short: "g",
    },
    help: {
      type: "boolean",
      short: "h",
    },
    "fluent-file-dir": {
      short: "f",
      type: "string",
    },
    "default-locale": {
      short: "l",
      type: "string",
      default: "en",
    },
    "migrate-from-default": {
      type: "boolean",
      default: false,
    }
  },
  strict: true,
});

if (help) {
  console.log(`
Usage: ngx-fluent-cli [options]

Scans Angular component templates (*.html) for usages of an i18n pipe.

Options:
  -p, --pipe <name>   The name of the pipe to search for (default: "fluent")
  -g, --glob <pattern> The glob pattern for templates (default: "src/**/*.html")
  -h, --help          Show this help message
`);
  process.exit(0);
}

import Parser from "tree-sitter";
import type { SyntaxNode } from "tree-sitter";
import Angular from "tree-sitter-angular";
import { FluentResource, FluentBundle } from "@fluent/bundle";
import { join } from "node:path";

const parser = new Parser();
parser.setLanguage(Angular);

function findPipeCalls(root: SyntaxNode) {
  const found: SyntaxNode[] = [];
  const cursor = root.walk();

  const visit = () => {
    if (
      cursor.nodeType === "pipe_call" &&
      cursor.currentNode.childForFieldName("name")?.text === pipeName
    ) {
      found.push(cursor.currentNode);
    }
    if (cursor.gotoFirstChild()) {
      do visit();
      while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  };

  visit();
  return found;
}

function describe(pipeCall: SyntaxNode) {
  const expression = pipeCall.parent?.parent;
  const source = expression?.namedChild(0);
  const position = pipeCall.startPosition;
  return {
    source: source?.text ?? "",
    sourceType: source?.type ?? "unknown",
    line: position.row + 1,
    column: position.column + 1,
  };
}

const glob = new Bun.Glob(globString);
let total = 0;
let fileCount = 0;

const sources: Record<string, string[]> = {};

for await (const htmlPath of glob.scan()) {
  fileCount++;
  const html = await Bun.file(htmlPath).text();
  const tree = parser.parse(html);

  for (const pipeCall of findPipeCalls(tree.rootNode)) {
    const { source, sourceType, line, column } = describe(pipeCall);
    console.log(`${htmlPath}:${line}:${column} [${sourceType}] ${source}`);
    sources[sourceType] ??= [];
    if (sourceType === 'string') {
      let cleanedSource = source.trim();
      if ((cleanedSource.startsWith("'") && cleanedSource.endsWith("'")) ||
          (cleanedSource.startsWith('"') && cleanedSource.endsWith('"'))) {
        cleanedSource = cleanedSource.slice(1, -1);
      }
      sources[sourceType].push(cleanedSource);
    } else {
      sources[sourceType].push(source);
    }
    total++;
  }
}

console.log(`\nFound ${total} "${pipeName}" pipe usages in ${fileCount} template(s).`);

const ftlGlob = new Bun.Glob(`*.ftl`);
const fluentFiles = await Array.fromAsync(ftlGlob.scan({ cwd: fluentFileDir }));

if (fluentFileDir && fluentFiles.length > 0) {
  console.log(`\nValidating against ${fluentFiles.length} Fluent file(s)...\n`);
  for (const fluentFileName of fluentFiles) {
    const fluentFilePath = join(fluentFileDir, fluentFileName);
    const content = await Bun.file(fluentFilePath).text();
    const resource = new FluentResource(content);
    const locale = fluentFilePath.split('/').at(-1)?.split('.ftl').at(0) || 'en-US';
    const bundle = new FluentBundle(locale);
    bundle.addResource(resource);

    const stringSources = sources["string"] ?? [];
    for (const source of stringSources) {
      const message = bundle.getMessage(source);
      if (!message) {
        console.warn(`Warning: Key "${source}" not found in ${fluentFilePath}`);

        if (migrateFromDefault && defaultLocale) {
          // TODO: Implement migration logic here, e.g., copy from default locale to the current locale.
        }
      }
    }

    if (Object.keys(sources).filter(key => key !== "string").length > 0) {
      console.warn(`Warning: Non-string sources found in templates, which cannot be validated against Fluent files.`);
    }
  }
}
