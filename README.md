# ngx-fluent-cli

Find usages of an Angular i18n pipe (e.g. `fluent`) in component templates (`*.html`).

```
src/app/home.component.html:1:22 [string] 'hello.world'
src/app/home.component.html:2:21 [member_expression] user.name

Found 2 "fluent" pipe usages in 2 template(s).
```

## Developing

To install dependencies:

```bash
bun install
```

To run locally:

```bash
bun run index.ts
```

To type check:

```bash
bun check
```

Run `bun fmt` to format the code.

## Using in an Angular project

Install as a devDependency (Bun required):

```bash
bun add -d ngx-fluent-cli
```

Add the native-module packages to `trustedDependencies` in your project's `package.json`
so `bun install` can run their native builds:

```json
"trustedDependencies": [
  "tree-sitter",
  "tree-sitter-angular",
  "tree-sitter-html"
]
```

Then add a script and run it:

```json
"scripts": {
  "extract:i18n": "ngx-fluent-cli --pipe fluent"
}
```

```bash
bun run extract:i18n
# or: bunx ngx-fluent-cli
```

## Options

| Option | Short | Default | Description |
| --- | --- | --- | --- |
| `--pipe` | `-p` | `fluent` | Name of the pipe to search for |
| `--glob` | `-g` | `src/**/*.html` | Glob pattern for templates |
| `--help` | `-h` | | Show help |

This project was created using `bun init` in bun v1.4.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
