import { input, confirm } from "@inquirer/prompts";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r * (1 - amount),
    g * (1 - amount),
    b * (1 - amount),
  );
}

function blend(hex1: string, hex2: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const r = 1 - ratio;
  return rgbToHex(
    r1 * ratio + r2 * r,
    g1 * ratio + g2 * r,
    b1 * ratio + b2 * r,
  );
}

function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 128;
}

type Defs = Record<string, string>;

type ThemeValue = { dark: string; light?: string };

type ThemeMap = Record<string, ThemeValue>;

const REQUIRED_DEF_KEYS = ["bg", "fg", "ac", "sel", "com", "err", "warn"];

const REQUIRED_THEME_KEYS = [
  "primary",
  "secondary",
  "accent",
  "error",
  "warning",
  "success",
  "info",
  "text",
  "textMuted",
  "background",
  "backgroundPanel",
  "backgroundElement",
  "border",
  "borderActive",
  "borderSubtle",
  "diffAdded",
  "diffRemoved",
  "diffContext",
  "diffHunkHeader",
  "syntaxComment",
  "syntaxKeyword",
  "syntaxFunction",
  "syntaxVariable",
  "syntaxString",
  "syntaxNumber",
  "syntaxOperator",
];

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value);
}

function isValidDefValue(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value);
}

function isValidThemeValue(value: unknown): value is ThemeValue {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.dark !== "string") return false;
  if (v.light !== undefined && typeof v.light !== "string") return false;
  return true;
}

function validateDefs(
  defs: unknown,
): { errors: string[]; warnings: string[]; passes: number; checks: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let passes = 0;
  let checks = 0;

  if (typeof defs !== "object" || defs === null) {
    errors.push("Missing or invalid defs object");
    checks++;
    return { errors, warnings, passes, checks };
  }

  const d = defs as Record<string, unknown>;
  const keys = Object.keys(d);
  checks++;
  passes++;
  console.log(`✓ defs: ${keys.length} color tokens`);

  for (const key of REQUIRED_DEF_KEYS) {
    checks++;
    const value = d[key];
    if (isValidDefValue(value)) {
      passes++;
      console.log(`  ✓ defs.${key}: ${value}`);
    } else if (value === undefined) {
      warnings.push(`Missing def: "${key}"`);
      console.log(`  ✗ defs.${key}: missing`);
    } else {
      errors.push(`Invalid hex for defs."${key}": ${JSON.stringify(value)}`);
      console.log(`  ✗ defs.${key}: invalid — ${JSON.stringify(value)}`);
    }
  }

  for (const [key, value] of Object.entries(d)) {
    if (REQUIRED_DEF_KEYS.includes(key)) continue;
    checks++;
    if (isValidDefValue(value)) {
      passes++;
    } else {
      errors.push(`Invalid hex for defs."${key}": ${JSON.stringify(value)}`);
      console.log(`  ✗ defs.${key}: invalid — ${JSON.stringify(value)}`);
    }
  }

  return { errors, warnings, passes, checks };
}

function validateThemeTokens(
  theme: unknown,
  defKeys: Set<string>,
): { errors: string[]; warnings: string[]; passes: number; checks: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let passes = 0;
  let checks = 0;

  if (typeof theme !== "object" || theme === null) {
    errors.push("Missing or invalid theme object");
    checks++;
    return { errors, warnings, passes, checks };
  }

  const t = theme as Record<string, unknown>;
  checks++;
  passes++;
  console.log(`✓ theme: ${Object.keys(t).length} semantic tokens`);

  for (const key of REQUIRED_THEME_KEYS) {
    checks++;
    const value = t[key];
    if (!isValidThemeValue(value)) {
      errors.push(`Missing or invalid theme."${key}" (must have { dark, light? })`);
      console.log(`  ✗ theme.${key}: missing or invalid`);
      continue;
    }
    const tv = value as ThemeValue;
    const darkOk = defKeys.has(tv.dark);
    const lightOk = tv.light === undefined || defKeys.has(tv.light);
    if (darkOk && lightOk) {
      passes++;
      const lightInfo = tv.light ? `light=${tv.light}` : "light=none";
      console.log(`  ✓ theme.${key}: dark=${tv.dark} ${lightInfo}`);
    } else {
      if (!darkOk) errors.push(`theme."${key}".dark "${tv.dark}" not found in defs`);
      if (!lightOk  && tv.light !== undefined) errors.push(`theme."${key}".light "${tv.light}" not found in defs`);
      console.log(`  ✗ theme.${key}: unresolved refs`);
    }
  }

  for (const [key, value] of Object.entries(t)) {
    if (REQUIRED_THEME_KEYS.includes(key)) continue;
    checks++;
    if (!isValidThemeValue(value)) {
      errors.push(`Invalid theme."${key}" — must be { dark, light? }`);
      console.log(`  ✗ theme.${key}: invalid`);
    } else {
      passes++;
    }
  }

  return { errors, warnings, passes, checks };
}

async function validateTheme(): Promise<void> {
  const filePath = Bun.argv[4];
  if (!filePath) {
    console.error(
      "Error: No file specified. Usage: bunx omo-kit theme validate <file>",
    );
    process.exit(1);
  }

  let raw: string;
  try {
    raw = await Bun.file(filePath).text();
  } catch {
    console.error(`Error: Cannot read file "${filePath}"`);
    process.exit(1);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Error: Invalid JSON in "${filePath}": ${msg}`);
    process.exit(1);
  }

  if (typeof json !== "object" || json === null) {
    console.error("Error: Theme must be a JSON object");
    process.exit(1);
  }

  const obj = json as Record<string, unknown>;
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  let totalPasses = 0;
  let totalChecks = 0;

  totalChecks++;
  if (typeof obj.$schema === "string" && obj.$schema.length > 0) {
    totalPasses++;
    console.log(`✓ $schema: ${obj.$schema}`);
  } else {
    allErrors.push("Missing or invalid $schema (must be a non-empty string)");
    console.log("✗ $schema: missing or invalid");
  }

  const hasTheme = typeof obj.theme === "object" && obj.theme !== null;
  const hasColors = typeof obj.colors === "object" && obj.colors !== null;

  if (!hasTheme && hasColors) {
    allErrors.push(
      "Detected old format (top-level 'colors'). Please re-generate with 'bunx omo-kit theme generate'",
    );
    console.log("✗ format: old flat colors format — please re-generate");
    totalChecks++;
  }

  let defKeys = new Set<string>();
  if (typeof obj.defs === "object" && obj.defs !== null) {
    const defsObj = obj.defs as Record<string, unknown>;
    defKeys = new Set(Object.keys(defsObj).filter((k) => typeof defsObj[k] === "string"));
    const defResult = validateDefs(obj.defs);
    allErrors.push(...defResult.errors);
    allWarnings.push(...defResult.warnings);
    totalPasses += defResult.passes;
    totalChecks += defResult.checks;
  } else {
    allErrors.push("Missing or invalid defs object");
    console.log("✗ defs: missing or invalid");
    totalChecks++;
  }

  if (hasTheme) {
    const themeResult = validateThemeTokens(obj.theme, defKeys);
    allErrors.push(...themeResult.errors);
    allWarnings.push(...themeResult.warnings);
    totalPasses += themeResult.passes;
    totalChecks += themeResult.checks;
  } else {
    allErrors.push("Missing theme object");
    console.log("✗ theme: missing");
    totalChecks++;
  }

  console.log(`\n── Validation Report ──`);
  console.log(`Passed: ${totalPasses}/${totalChecks}`);

  if (allErrors.length > 0) {
    console.log(`\nErrors (${allErrors.length}):`);
    for (const err of allErrors) {
      console.log(`  • ${err}`);
    }
  }

  if (allWarnings.length > 0) {
    console.log(`\nWarnings (${allWarnings.length}):`);
    for (const warn of allWarnings) {
      console.log(`  • ${warn}`);
    }
  }

  if (allErrors.length === 0 && allWarnings.length === 0) {
    console.log("\n✓ Theme is valid!");
  } else if (allErrors.length === 0) {
    console.log("\n✓ Theme is valid (with warnings)");
  } else {
    console.log("\n✗ Theme has errors");
    process.exit(1);
  }
}

interface GeneratedTheme {
  $schema: string;
  defs: Defs;
  theme: ThemeMap;
}

const DEFAULT_SUCCESS = "#46DFAE";
const DEFAULT_ERROR = "#F94343";
const DEFAULT_WARNING = "#D8A441";

async function generateTheme(): Promise<void> {
  const name = await input({
    message: "Theme name:",
    validate: (v: string) => (v.length > 0 ? true : "Name is required"),
  });

  const bg = await input({
    message: "Background color (hex, e.g. #1a1b2e):",
    validate: (v: string) =>
      /^#[0-9a-fA-F]{6}$/.test(v)
        ? true
        : "Must be a 6-digit hex color (e.g. #1a1b2e)",
  });

  const fg = await input({
    message: "Foreground / text color (hex, e.g. #e0e0e0):",
    validate: (v: string) =>
      /^#[0-9a-fA-F]{6}$/.test(v)
        ? true
        : "Must be a 6-digit hex color",
  });

  const accent = await input({
    message: "Accent color (hex, e.g. #4a9eff):",
    validate: (v: string) =>
      /^#[0-9a-fA-F]{6}$/.test(v)
        ? true
        : "Must be a 6-digit hex color",
  });

  const selection = await input({
    message: "Selection highlight color (hex, e.g. #3a4b7a):",
    default: blend(accent, bg, 0.25),
    validate: (v: string) =>
      /^#[0-9a-fA-F]{6}$/.test(v)
        ? true
        : "Must be a 6-digit hex color",
  });

  const comment = await input({
    message: "Comment / muted text color (hex, e.g. #6a6a8a):",
    default: blend(fg, bg, 0.4),
    validate: (v: string) =>
      /^#[0-9a-fA-F]{6}$/.test(v)
        ? true
        : "Must be a 6-digit hex color",
  });

  const err = await input({
    message: "Error color (hex, e.g. #F94343):",
    default: DEFAULT_ERROR,
    validate: (v: string) =>
      /^#[0-9a-fA-F]{6}$/.test(v)
        ? true
        : "Must be a 6-digit hex color",
  });

  const warn = await input({
    message: "Warning color (hex, e.g. #D8A441):",
    default: DEFAULT_WARNING,
    validate: (v: string) =>
      /^#[0-9a-fA-F]{6}$/.test(v)
        ? true
        : "Must be a 6-digit hex color",
  });

  const suc = DEFAULT_SUCCESS;
  const inf = accent;
  const txtMuted = blend(fg, bg, 0.5);
  const bgPanel = lighten(bg, 0.10);
  const bgElement = lighten(bg, 0.18);
  const border = lighten(bg, 0.20);
  const borderSubtle = lighten(bg, 0.12);
  const diffAdd = blend(suc, bg, 0.3);
  const diffRem = blend(err, bg, 0.3);

  const defs: Defs = {
    bg,
    fg,
    ac: accent,
    sel: selection,
    com: comment,
    err,
    warn,
    suc,
    inf,
    txtMuted,
    bgPanel,
    bgElement,
    border,
    borderSubtle,
    diffAdd,
    diffRem,
  };

  const theme: ThemeMap = {
    primary: { dark: "ac", light: "ac" },
    secondary: { dark: "sel", light: "sel" },
    accent: { dark: "ac", light: "ac" },
    error: { dark: "err", light: "err" },
    warning: { dark: "warn", light: "warn" },
    success: { dark: "suc", light: "suc" },
    info: { dark: "inf", light: "inf" },
    text: { dark: "fg", light: "fg" },
    textMuted: { dark: "txtMuted", light: "txtMuted" },
    background: { dark: "bg", light: "bg" },
    backgroundPanel: { dark: "bgPanel", light: "bgPanel" },
    backgroundElement: { dark: "bgElement", light: "bgElement" },
    border: { dark: "border", light: "border" },
    borderActive: { dark: "ac", light: "ac" },
    borderSubtle: { dark: "borderSubtle", light: "borderSubtle" },
    diffAdded: { dark: "diffAdd", light: "diffAdd" },
    diffRemoved: { dark: "diffRem", light: "diffRem" },
    diffContext: { dark: "bgPanel", light: "bgPanel" },
    diffHunkHeader: { dark: "ac", light: "ac" },
    syntaxComment: { dark: "com", light: "com" },
    syntaxKeyword: { dark: "ac", light: "ac" },
    syntaxFunction: { dark: "fg", light: "fg" },
    syntaxVariable: { dark: "fg", light: "fg" },
    syntaxString: { dark: "suc", light: "suc" },
    syntaxNumber: { dark: "warn", light: "warn" },
    syntaxOperator: { dark: "txtMuted", light: "txtMuted" },
  };

  const output: GeneratedTheme = {
    $schema: "https://opencode.ai/theme.json",
    defs,
    theme,
  };

  const home = process.env.HOME ?? Bun.env.HOME ?? "";
  const themesDir = home ? join(home, ".config", "opencode", "themes") : ".";
  const outputPath = join(themesDir, `${name}.json`);
  const file = Bun.file(outputPath);
  if (await file.exists()) {
    const overwrite = await confirm({
      message: `File "${outputPath}" already exists. Overwrite?`,
    });
    if (!overwrite) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  await mkdir(themesDir, { recursive: true });
  await Bun.write(outputPath, JSON.stringify(output, null, 2));

  const type = isDark(bg) ? "dark" : "light";
  console.log(`\n✓ Theme saved to ${outputPath}`);
  console.log(`  Type: ${type}`);
  console.log(`  Colors: ${Object.keys(defs).length} tokens`);
  console.log(`\n  To use this theme, set "theme": "${name}" in tui.json`);
  console.log(`  then restart OpenCode.`);
}

export async function themeCommand(): Promise<void> {
  if (Bun.argv.includes("--help") || Bun.argv.includes("-h")) {
    console.log(`omo-kit theme — Manage OpenCode themes

Usage:
  bunx omo-kit theme validate <file>   Validate a theme JSON file
  bunx omo-kit theme generate          Interactively generate a new theme

Options:
  --help, -h     Show this help message
`);
    return;
  }

  const subcommand = Bun.argv[3];

  switch (subcommand) {
    case "validate":
      await validateTheme();
      break;
    case "generate":
      await generateTheme();
      break;
    default:
      console.log(`omo-kit theme — manage OpenCode themes

Usage:
  bunx omo-kit theme validate <file>   Validate a theme JSON file
  bunx omo-kit theme generate          Interactively generate a new theme
`);
  }
}
