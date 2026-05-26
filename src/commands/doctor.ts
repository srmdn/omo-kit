import { join } from "node:path";

// ─── ANSI color helpers ────────────────────────────────────────────

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
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

// ─── JSON helpers ──────────────────────────────────────────────────

function tryParseJSON(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
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
      (await import("node:fs/promises")).readdir(themesDir, { withFileTypes: true }),
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

function checkLegacyReferences(raw: string, ctx: CheckContext): void {
  if (raw.includes("srmdn/oh-my-openagent")) {
    ctx.warnings++;
    warn(
      `"${ctx.filename}" contains legacy reference "srmdn/oh-my-openagent" — should be "code-yeongyu"`,
    );
  }
}

function checkStrayTabs(raw: string, ctx: CheckContext): void {
  for (const line of raw.split("\n")) {
    if (line.match(/^\t+/)) {
      ctx.warnings++;
      warn(`"${ctx.filename}" contains tab indentation — use spaces for JSON`);
      return;
    }
  }
}

// ─── File validators ───────────────────────────────────────────────

function validateOhMyOpenagent(raw: string, ctx: CheckContext): void {
  ctx.filename = "oh-my-openagent.json";

  const json = tryParseJSON(raw);
  if (!json) {
    ctx.errors++;
    err("oh-my-openagent.json — invalid JSON syntax");
    return;
  }

  const schema = stringValue(json.$schema) ?? "";
  if (schema.includes("oh-my-opencode") && !schema.includes("oh-my-openagent")) {
    ctx.warnings++;
    warn('$schema still references "oh-my-opencode" — should be "oh-my-openagent"');
  }
  if (schema.includes("srmdn/")) {
    ctx.warnings++;
    warn('$schema references "srmdn/" — should be "code-yeongyu/"');
  }

  if (hasKey(json, "provider") && !hasKey(json, "providers")) {
    ctx.warnings++;
    warn('Key "provider" (singular) found — consider using "providers" (plural)');
  }

  if (json.disabled_skills !== undefined && !Array.isArray(json.disabled_skills)) {
    ctx.warnings++;
    warn('"disabled_skills" should be an array of strings');
  }
  if (json.disabled_mcps !== undefined && !Array.isArray(json.disabled_mcps)) {
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
          err(`Agent "${name}" — value must be an object, got ${typeof def}`);
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
  } else if (typeof json.categories !== "object" || json.categories === null) {
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
          err(`Category "${name}" — value must be an object, got ${typeof def}`);
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

  checkLegacyReferences(raw, ctx);
  checkStrayTabs(raw, ctx);

  if (ctx.errors === 0 && ctx.warnings === 0) {
    ok("oh-my-openagent.json");
  } else {
    ok(`oh-my-openagent.json (${ctx.warnings} warning${ctx.warnings > 1 ? "s" : ""})`);
  }
}

function validateOpencode(raw: string, ctx: CheckContext): void {
  ctx.filename = "opencode.json";

  const json = tryParseJSON(raw);
  if (!json) {
    ctx.errors++;
    err("opencode.json — invalid JSON syntax");
    return;
  }

  if (hasKey(json, "provider") && !hasKey(json, "providers")) {
    ctx.warnings++;
    warn('Key "provider" (singular) found — consider using "providers" (plural)');
  }

  const schema = stringValue(json.$schema) ?? "";
  if (schema.includes("srmdn/")) {
    ctx.warnings++;
    warn('$schema references "srmdn/" — should be "code-yeongyu/"');
  }

  checkLegacyReferences(raw, ctx);
  checkStrayTabs(raw, ctx);

  if (ctx.errors === 0 && ctx.warnings === 0) {
    ok("opencode.json");
  } else {
    ok(`opencode.json (${ctx.warnings} warning${ctx.warnings > 1 ? "s" : ""})`);
  }
}

async function validateTui(raw: string, ctx: CheckContext): Promise<void> {
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
      warn(`Theme "${theme}" not found in ~/.config/opencode/themes/ — may be invalid`);
    }
  }

  checkStrayTabs(raw, ctx);

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

type FileValidator = (raw: string, ctx: CheckContext) => void | Promise<void>;

interface FileEntry {
  name: string;
  validate: FileValidator;
}

async function checkDirectory(
  dir: string,
  label: string,
): Promise<{ errors: number; warnings: number }> {
  section(`${label}/`);

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
  }

  for (const { name, validate } of files) {
    const fullPath = join(dir, name);
    if (!(await fileExists(fullPath))) continue;

    foundAny = true;
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

    await validate(raw, ctx);

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
  const home = process.env.HOME ?? Bun.env.HOME ?? "";
  const cwd = process.cwd();

  console.log(`${BOLD}omo-kit doctor${RESET} — config health check\n`);

  const opencodeDir = home ? join(home, ".config", "opencode") : null;

  const cwdResults = await checkDirectory(cwd, "CWD");

  let homeResults = { errors: 0, warnings: 0 };
  if (opencodeDir) {
    homeResults = await checkDirectory(opencodeDir, "~/.config/opencode");
  } else {
    section("~/.config/opencode/");
    console.log(`  ${DIM}(HOME not set — skipping)${RESET}`);
  }

  const totalErrors = cwdResults.errors + homeResults.errors;
  const totalWarnings = cwdResults.warnings + homeResults.warnings;

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

  if (totalErrors > 0) {
    process.exit(1);
  }
}
