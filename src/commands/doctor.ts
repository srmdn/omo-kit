import { join } from "node:path";

// ─── ANSI color helpers ────────────────────────────────────────────

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

function ok(msg: string) {
  console.log(`  ${GREEN}✓${RESET} ${msg}`);
}
function warn(msg: string) {
  console.log(`  ${YELLOW}⚠${RESET}  ${msg}`);
}
function err(msg: string) {
  console.log(`  ${RED}✗${RESET} ${msg}`);
}
function info(msg: string) {
  console.log(`  ${CYAN}ℹ${RESET}  ${msg}`);
}
function section(title: string) {
  console.log(`\n${BOLD}${title}${RESET}`);
}

// ─── Config check context ──────────────────────────────────────────

interface CheckContext {
  label: string;
  dir: string;
  errors: number;
  warnings: number;
  filename: string;
}

// ─── Fix infrastructure ────────────────────────────────────────────

interface TextFix {
  file: string;
  description: string;
  replacements: [string, string][];
}

interface RenameFix {
  description: string;
  oldPath: string;
  newPath: string;
}

class FixCollector {
  textFixes: Map<string, TextFix> = new Map();
  renameFixes: RenameFix[] = [];

  addText(file: string, description: string, from: string, to: string) {
    const existing = this.textFixes.get(file);
    if (existing) {
      existing.replacements.push([from, to]);
    } else {
      this.textFixes.set(file, {
        file,
        description,
        replacements: [[from, to]],
      });
    }
  }

  addTextMulti(
    file: string,
    description: string,
    replacements: [string, string][],
  ) {
    const existing = this.textFixes.get(file);
    if (existing) {
      existing.replacements.push(...replacements);
    } else {
      this.textFixes.set(file, { file, description, replacements: [...replacements] });
    }
  }

  addRename(description: string, oldPath: string, newPath: string) {
    this.renameFixes.push({ description, oldPath, newPath });
  }

  get total(): number {
    return this.textFixes.size + this.renameFixes.length;
  }

  isEmpty(): boolean {
    return this.total === 0;
  }
}

async function applyFixes(
  collector: FixCollector,
): Promise<{ applied: number; failed: number }> {
  let applied = 0;
  let failed = 0;

  for (const [file, fix] of collector.textFixes) {
    try {
      let content = await Bun.file(file).text();
      for (const [from, to] of fix.replacements) {
        content = content.replaceAll(from, to);
      }
      await Bun.write(file, content);
      ok(`Fixed ${fix.description}: ${fix.file}`);
      applied++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      err(`Could not fix ${fix.file}: ${msg}`);
      failed++;
    }
  }

  for (const fix of collector.renameFixes) {
    try {
      const f = Bun.file(fix.oldPath);
      if (await f.exists()) {
        await Bun.write(fix.newPath, await f.text());
        await f.delete();
        ok(`Renamed ${fix.oldPath} → ${fix.newPath}`);
        applied++;
      } else {
        info(`File already renamed: ${fix.oldPath}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      err(`Could not rename ${fix.oldPath}: ${msg}`);
      failed++;
    }
  }

  return { applied, failed };
}

// ─── JSON helpers ──────────────────────────────────────────────────

function tryParseJSON(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasKey(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// ─── Theme validation ──────────────────────────────────────────────

let cachedThemeFiles: string[] | null = null;

async function getThemeNames(): Promise<Set<string>> {
  if (cachedThemeFiles) return new Set(cachedThemeFiles);

  const home = process.env.HOME ?? Bun.env.HOME ?? "";
  if (!home) return new Set();

  const themesDir = join(home, ".config", "opencode", "themes");
  try {
    const dir = Array.from(
      (await import("node:fs/promises")).readdir(themesDir, {
        withFileTypes: true,
      }),
    );
    cachedThemeFiles = dir
      .filter((d) => d.isFile() && d.name.endsWith(".json"))
      .map((d) => d.name.replace(/\.json$/, ""));
    return new Set(cachedThemeFiles);
  } catch {
    cachedThemeFiles = [];
    return new Set();
  }
}

async function isValidTheme(name: string): Promise<boolean> {
  const names = await getThemeNames();
  if (names.size === 0) return true;
  return names.has(name);
}

// ─── Text-content checks ───────────────────────────────────────────

function checkLegacyReferences(
  raw: string,
  ctx: CheckContext,
  isFix: boolean,
  collector: FixCollector,
  filePath: string,
): void {
  if (raw.includes("srmdn/oh-my-openagent")) {
    ctx.warnings++;
    warn(
      `"${ctx.filename}" contains legacy reference "srmdn/oh-my-openagent" — should be "code-yeongyu"`,
    );
    if (isFix) {
      collector.addText(
        filePath,
        `replace srmdn/ references`,
        "srmdn/oh-my-openagent",
        "code-yeongyu/oh-my-openagent",
      );
    }
  }
}

function checkStrayTabs(
  raw: string,
  ctx: CheckContext,
  isFix: boolean,
  collector: FixCollector,
  filePath: string,
): void {
  let hasTabs = false;
  for (const line of raw.split("\n")) {
    if (line.match(/^\t+/)) {
      hasTabs = true;
      break;
    }
  }
  if (hasTabs) {
    ctx.warnings++;
    warn(`"${ctx.filename}" contains tab indentation — use spaces for JSON`);
    if (isFix) {
      collector.addText(
        filePath,
        `replace tabs with spaces`,
        "\t",
        "  ",
      );
    }
  }
}

// ─── File validators ───────────────────────────────────────────────

function validateOhMyOpenagent(
  raw: string,
  ctx: CheckContext,
  isFix: boolean,
  collector: FixCollector,
  filePath: string,
): void {
  ctx.filename = "oh-my-openagent.json";

  const json = tryParseJSON(raw);
  if (!json) {
    ctx.errors++;
    err("oh-my-openagent.json — invalid JSON syntax");
    return;
  }

  const schema = stringValue(json.$schema) ?? "";
  if (
    schema.includes("oh-my-opencode") &&
    !schema.includes("oh-my-openagent")
  ) {
    ctx.warnings++;
    warn(
      '$schema still references "oh-my-opencode" — should be "oh-my-openagent"',
    );
    if (isFix) {
      collector.addText(
        filePath,
        `fix $schema: oh-my-opencode → oh-my-openagent`,
        '"oh-my-opencode"',
        '"oh-my-openagent"',
      );
    }
  }
  if (schema.includes("srmdn/")) {
    ctx.warnings++;
    warn('$schema references "srmdn/" — should be "code-yeongyu/"');
    if (isFix) {
      collector.addText(
        filePath,
        `fix $schema: srmdn/ → code-yeongyu/`,
        "srmdn/",
        "code-yeongyu/",
      );
    }
  }

  if (hasKey(json, "provider") && !hasKey(json, "providers")) {
    ctx.warnings++;
    warn(
      'Key "provider" (singular) found — consider using "providers" (plural)',
    );
    if (isFix) {
      collector.addText(
        filePath,
        `rename "provider" → "providers"`,
        '"provider"',
        '"providers"',
      );
    }
  }

  if (
    json.disabled_skills !== undefined &&
    !Array.isArray(json.disabled_skills)
  ) {
    ctx.warnings++;
    warn('"disabled_skills" should be an array of strings');
  }
  if (
    json.disabled_mcps !== undefined &&
    !Array.isArray(json.disabled_mcps)
  ) {
    ctx.warnings++;
    warn('"disabled_mcps" should be an array of strings');
  }

  let missingRequired = false;

  if (!hasKey(json, "agents")) {
    ctx.errors++;
    err('Missing required key "agents"');
    missingRequired = true;
  } else if (typeof json.agents !== "object" || json.agents === null) {
    ctx.errors++;
    err('"agents" must be an object');
    missingRequired = true;
  } else {
    const agents = json.agents as Record<string, unknown>;
    const agentNames = Object.keys(agents);
    if (agentNames.length === 0) {
      ctx.warnings++;
      warn('"agents" is empty — no agents configured');
    } else {
      for (const [name, def] of Object.entries(agents)) {
        if (typeof def !== "object" || def === null) {
          ctx.errors++;
          err(
            `Agent "${name}" — value must be an object, got ${typeof def}`,
          );
          continue;
        }
        const agentDef = def as Record<string, unknown>;
        if (!hasKey(agentDef, "model")) {
          ctx.errors++;
          err(`Agent "${name}" — missing required key "model"`);
        }
        if (
          hasKey(agentDef, "fallback_models") &&
          !Array.isArray(agentDef.fallback_models)
        ) {
          ctx.warnings++;
          warn(`Agent "${name}" — "fallback_models" should be an array`);
        }
      }
    }
  }

  if (!hasKey(json, "categories")) {
    ctx.errors++;
    err('Missing required key "categories"');
    missingRequired = true;
  } else if (
    typeof json.categories !== "object" ||
    json.categories === null
  ) {
    ctx.errors++;
    err('"categories" must be an object');
    missingRequired = true;
  } else {
    const categories = json.categories as Record<string, unknown>;
    const catNames = Object.keys(categories);
    if (catNames.length === 0) {
      ctx.warnings++;
      warn('"categories" is empty — no categories configured');
    } else {
      for (const [name, def] of Object.entries(categories)) {
        if (typeof def !== "object" || def === null) {
          ctx.errors++;
          err(
            `Category "${name}" — value must be an object, got ${typeof def}`,
          );
          continue;
        }
        const catDef = def as Record<string, unknown>;
        if (!hasKey(catDef, "model")) {
          ctx.errors++;
          err(`Category "${name}" — missing required key "model"`);
        }
      }
    }
  }

  checkLegacyReferences(raw, ctx, isFix, collector, filePath);
  checkStrayTabs(raw, ctx, isFix, collector, filePath);

  if (ctx.errors === 0 && ctx.warnings === 0) {
    ok("oh-my-openagent.json");
  } else {
    ok(
      `oh-my-openagent.json (${ctx.warnings} warning${ctx.warnings > 1 ? "s" : ""})`,
    );
  }
}

function validateOpencode(
  raw: string,
  ctx: CheckContext,
  isFix: boolean,
  collector: FixCollector,
  filePath: string,
): void {
  ctx.filename = "opencode.json";

  const json = tryParseJSON(raw);
  if (!json) {
    ctx.errors++;
    err("opencode.json — invalid JSON syntax");
    return;
  }

  const schema = stringValue(json.$schema) ?? "";
  if (schema.includes("srmdn/")) {
    ctx.warnings++;
    warn('$schema references "srmdn/" — should be "code-yeongyu/"');
    if (isFix) {
      collector.addText(
        filePath,
        `fix $schema: srmdn/ → code-yeongyu/`,
        "srmdn/",
        "code-yeongyu/",
      );
    }
  }

  checkLegacyReferences(raw, ctx, isFix, collector, filePath);
  checkStrayTabs(raw, ctx, isFix, collector, filePath);

  if (ctx.errors === 0 && ctx.warnings === 0) {
    ok("opencode.json");
  } else {
    ok(`opencode.json (${ctx.warnings} warning${ctx.warnings > 1 ? "s" : ""})`);
  }
}

async function validateTui(
  raw: string,
  ctx: CheckContext,
  isFix: boolean,
  collector: FixCollector,
  filePath: string,
): Promise<void> {
  ctx.filename = "tui.json";

  const json = tryParseJSON(raw);
  if (!json) {
    ctx.errors++;
    err("tui.json — invalid JSON syntax");
    return;
  }

  const theme = stringValue(json.theme);
  if (theme === undefined) {
    ctx.warnings++;
    warn('Missing "theme" key — no theme configured');
  } else if (theme === "") {
    ctx.warnings++;
    warn('"theme" is an empty string');
  } else {
    const valid = await isValidTheme(theme);
    if (!valid) {
      ctx.warnings++;
      warn(
        `Theme "${theme}" not found in ~/.config/opencode/themes/ — may be invalid`,
      );
    }
  }

  checkStrayTabs(raw, ctx, isFix, collector, filePath);

  if (ctx.errors === 0 && ctx.warnings === 0) {
    ok("tui.json");
  } else {
    ok(`tui.json (${ctx.warnings} warning${ctx.warnings > 1 ? "s" : ""})`);
  }
}

// ─── File I/O ──────────────────────────────────────────────────────

async function fileExists(fullPath: string): Promise<boolean> {
  try {
    const f = Bun.file(fullPath);
    return await f.exists();
  } catch {
    return false;
  }
}

async function readFile(fullPath: string): Promise<string> {
  return await Bun.file(fullPath).text();
}

// ─── Directory scanner ─────────────────────────────────────────────

type FileValidator = (
  raw: string,
  ctx: CheckContext,
  isFix: boolean,
  collector: FixCollector,
  filePath: string,
) => void | Promise<void>;

interface FileEntry {
  name: string;
  validate: FileValidator;
}

async function checkDirectory(
  dir: string,
  label: string,
  isVerbose: boolean,
  isFix: boolean,
  collector: FixCollector,
): Promise<{ errors: number; warnings: number }> {
  section(`${label}/`);

  if (isVerbose) {
    info(`Scanning: ${dir}`);
  }

  const files: FileEntry[] = [
    { name: "oh-my-openagent.json", validate: validateOhMyOpenagent },
    { name: "opencode.json", validate: validateOpencode },
    { name: "tui.json", validate: validateTui },
  ];

  let foundAny = false;
  let totalErrors = 0;
  let totalWarnings = 0;

  const legacyPath = join(dir, "oh-my-opencode.json");
  if (await fileExists(legacyPath)) {
    foundAny = true;
    totalWarnings++;
    warn(
      'Found "oh-my-opencode.json" (legacy name) — rename to "oh-my-openagent.json"',
    );
    if (isFix) {
      collector.addRename(
        "legacy filename",
        legacyPath,
        join(dir, "oh-my-openagent.json"),
      );
    }
  }

  for (const { name, validate } of files) {
    const fullPath = join(dir, name);
    if (!(await fileExists(fullPath))) {
      if (isVerbose) info(`${name} — not found, skipping`);
      continue;
    }

    foundAny = true;

    if (isVerbose) {
      const f = Bun.file(fullPath);
      const size = (await f.size) || 0;
      info(`${name} (${(size / 1024).toFixed(1)} KB)`);
    }

    let raw: string;
    try {
      raw = await readFile(fullPath);
    } catch {
      totalErrors++;
      err(`${name} — could not read file`);
      continue;
    }

    if (raw.trim().length === 0) {
      totalErrors++;
      err(`${name} — empty file`);
      continue;
    }

    const ctx: CheckContext = {
      label,
      dir,
      errors: 0,
      warnings: 0,
      filename: name,
    };

    await validate(raw, ctx, isFix, collector, fullPath);

    totalErrors += ctx.errors;
    totalWarnings += ctx.warnings;
  }

  if (!foundAny) {
    console.log(`  ${DIM}(no config files found)${RESET}`);
  }

  return { errors: totalErrors, warnings: totalWarnings };
}

// ─── Main entry point ──────────────────────────────────────────────

export async function doctorCommand(): Promise<void> {
  if (Bun.argv.includes("--help") || Bun.argv.includes("-h")) {
    console.log(`omo-kit doctor — Validate oh-my-openagent config files

Usage:
  bunx omo-kit doctor [options]

Options:
  --verbose, -v   Show detailed scan information
  --fix           Auto-correct common issues (prompts for confirmation)
  --fix --yes     Auto-correct without confirmation
  --help, -h      Show this help message

Checks oh-my-openagent.json, opencode.json, tui.json, and AGENTS.md
in the current directory and ~/.config/opencode/. Exits 0 if clean,
1 with details if issues found.

Fixable issues:
  • Tab indentation → spaces
  • Legacy "srmdn/" $schema references → "code-yeongyu/"
  • Singular "provider" key → "providers" (plural)
  • Legacy filename "oh-my-opencode.json" → "oh-my-openagent.json"
`);
    return;
  }

  const isVerbose =
    Bun.argv.includes("--verbose") || Bun.argv.includes("-v");
  const isFix = Bun.argv.includes("--fix");
  const isYes = Bun.argv.includes("--yes") || Bun.argv.includes("-y");

  if (isYes && !isFix) {
    console.error("--yes flag requires --fix");
    console.error("Usage: bunx omo-kit doctor --fix --yes");
    process.exit(1);
  }

  const home = process.env.HOME ?? Bun.env.HOME ?? "";
  const cwd = process.cwd();

  if (isVerbose) {
    console.log(
      `${BOLD}omo-kit doctor${RESET} ${DIM}(verbose)${RESET} — config health check\n`,
    );
  } else {
    console.log(`${BOLD}omo-kit doctor${RESET} — config health check\n`);
  }

  if (isFix && isVerbose) {
    info("Fix mode enabled — collecting correctable issues");
  }

  const collector = new FixCollector();
  const opencodeDir = home ? join(home, ".config", "opencode") : null;

  const cwdResults = await checkDirectory(
    cwd,
    "CWD",
    isVerbose,
    isFix,
    collector,
  );

  let homeResults = { errors: 0, warnings: 0 };
  if (opencodeDir) {
    homeResults = await checkDirectory(
      opencodeDir,
      "~/.config/opencode",
      isVerbose,
      isFix,
      collector,
    );
  } else {
    section("~/.config/opencode/");
    console.log(`  ${DIM}(HOME not set — skipping)${RESET}`);
    if (isVerbose) info("HOME environment variable is not set");
  }

  const totalErrors = cwdResults.errors + homeResults.errors;
  const totalWarnings = cwdResults.warnings + homeResults.warnings;

  // Fix flow
  if (isFix && !collector.isEmpty()) {
    console.log(`\n${BOLD}Fixable issues${RESET}`);
    for (const [, fix] of collector.textFixes) {
      console.log(`  ${YELLOW}→${RESET} ${fix.description}`);
      console.log(`    ${DIM}${fix.file}${RESET}`);
    }
    for (const fix of collector.renameFixes) {
      console.log(`  ${YELLOW}→${RESET} ${fix.description}`);
      console.log(`    ${DIM}${fix.oldPath}${RESET}`);
    }

    let shouldFix = isYes;
    if (!isYes) {
      try {
        const { confirm } = await import("@inquirer/prompts");
        shouldFix = await confirm({
          message: `Apply ${collector.total} fix${collector.total > 1 ? "es" : ""}?`,
          default: true,
        });
      } catch {
        console.log(
          `  Run with ${BOLD}--yes${RESET} to apply without prompting.`,
        );
        shouldFix = false;
      }
    }

    if (shouldFix) {
      const { applied, failed } = await applyFixes(collector);
      if (applied > 0) console.log();
      if (failed > 0) {
        console.error(
          `\n  ${RED}${failed} fix${failed > 1 ? "es" : ""} failed.${RESET}`,
        );
      }
      if (applied > 0) {
        console.log(
          `\n  ${GREEN}${applied} fix${applied > 1 ? "es" : ""} applied.${RESET} Re-run doctor to verify.`,
        );
      }
    } else {
      console.log("\n  Fix skipped.");
    }
  } else if (isFix && collector.isEmpty()) {
    console.log(`\n${BOLD}Fixable issues${RESET}`);
    console.log(`  ${DIM}None found — nothing to fix.${RESET}`);
  }

  console.log(`\n${BOLD}Summary${RESET}`);
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(`  ${GREEN}All clear — no issues found.${RESET}`);
  } else {
    const parts: string[] = [];
    if (totalErrors > 0) {
      parts.push(
        `${RED}${totalErrors} error${totalErrors > 1 ? "s" : ""}${RESET}`,
      );
    }
    if (totalWarnings > 0) {
      parts.push(
        `${YELLOW}${totalWarnings} warning${totalWarnings > 1 ? "s" : ""}${RESET}`,
      );
    }
    console.log(`  ${parts.join(", ")}`);
  }

  if (isVerbose) {
    console.log(
      `\n  ${DIM}Checked: ${cwd}${opencodeDir ? `, ${opencodeDir}` : ""}${RESET}`,
    );
  }

  if (totalErrors > 0) {
    process.exit(1);
  }
}
