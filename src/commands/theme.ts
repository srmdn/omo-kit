import { input, confirm } from "@inquirer/prompts";

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

type TokenMap = Record<string, string>;

const REQUIRED_TOKENS = [
  "background",
  "foreground",
  "accent",
  "selection",
  "comment",
  "error",
  "warning",
];

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value);
}

function isValidTokenValue(value: unknown): boolean {
  if (typeof value === "string") return /^#[0-9a-fA-F]{3,8}$/.test(value);
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    const d = v.dark;
    const l = v.light;
    return typeof d === "string" && typeof l === "string";
  }
  return false;
}

function formatTokenValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    return `dark=${String(v.dark)} light=${String(v.light)}`;
  }
  return JSON.stringify(value);
}

function validateTokens(
  tokens: TokenMap,
  label: string,
): { errors: string[]; warnings: string[]; passes: number; checks: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let passes = 0;
  let checks = 0;

  const tokenCount = Object.keys(tokens).length;
  console.log(`✓ ${label}: ${tokenCount} color tokens`);
  passes++;
  checks++;

  for (const token of REQUIRED_TOKENS) {
    checks++;
    const value = tokens[token];
    if (isValidTokenValue(value)) {
      passes++;
      console.log(`  ✓ ${token}: ${formatTokenValue(value)}`);
    } else if (value === undefined) {
      warnings.push(`Missing color token: "${token}"`);
      console.log(`  ✗ ${token}: missing`);
    } else {
      errors.push(
        `Invalid color value for "${token}": ${formatTokenValue(value)}`,
      );
      console.log(`  ✗ ${token}: invalid — ${formatTokenValue(value)}`);
    }
  }

  for (const [key, value] of Object.entries(tokens)) {
    if (REQUIRED_TOKENS.includes(key)) continue;
    checks++;
    if (isValidTokenValue(value)) {
      passes++;
    } else {
      errors.push(
        `Invalid color value for "${key}": ${formatTokenValue(value)}`,
      );
      console.log(`  ✗ ${key}: invalid — ${formatTokenValue(value)}`);
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

  totalChecks++;
  if (typeof obj.name === "string" && obj.name.length > 0) {
    totalPasses++;
    console.log(`✓ name: ${obj.name}`);
  } else {
    allWarnings.push("Missing name (recommended for generated themes)");
    console.log("✗ name: missing");
  }

  const tokens = obj.theme ?? obj.colors;
  if (typeof tokens === "object" && tokens !== null) {
    const result = validateTokens(
      tokens as TokenMap,
      typeof obj.theme !== "undefined" ? "theme" : "colors",
    );
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
    totalPasses += result.passes;
    totalChecks += result.checks;
  } else {
    allErrors.push("Missing or invalid theme/colors object");
    console.log("✗ theme/colors: missing or invalid");
    totalChecks++;
  }

  if (typeof obj.type === "string") {
    if (obj.type === "dark" || obj.type === "light") {
      console.log(`✓ type: ${obj.type}`);
    } else {
      allWarnings.push(
        `type should be "dark" or "light", got "${obj.type}"`,
      );
      console.log(`✗ type: invalid value "${obj.type}"`);
    }
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

interface ThemeColors {
  background: string;
  foreground: string;
  accent: string;
  selection: string;
  comment: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  textMuted: string;
  border: string;
  borderActive: string;
  backgroundPanel: string;
  backgroundElement: string;
}

const SELECTION_BLEND = 0.25;
const COMMENT_BLEND = 0.4;
const MUTED_BLEND = 0.35;
const BORDER_BLEND = 0.92;
const PANEL_SHIFT = 0.04;
const ELEMENT_SHIFT = 0.08;

const ERROR_COLOR = "#F94343";
const WARNING_COLOR = "#D8A441";
const SUCCESS_COLOR = "#46DFAE";

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

  const type = isDark(bg) ? "dark" : "light";
  const isDarkTheme = type === "dark";

  const colors: ThemeColors = {
    background: bg,
    foreground: fg,
    accent,
    selection: blend(accent, bg, SELECTION_BLEND),
    comment: blend(fg, bg, COMMENT_BLEND),
    error: ERROR_COLOR,
    warning: WARNING_COLOR,
    success: SUCCESS_COLOR,
    info: accent,
    textMuted: blend(fg, bg, MUTED_BLEND),
    border: blend(bg, fg, BORDER_BLEND),
    borderActive: accent,
    backgroundPanel: isDarkTheme ? lighten(bg, PANEL_SHIFT) : darken(bg, PANEL_SHIFT),
    backgroundElement: isDarkTheme ? lighten(bg, ELEMENT_SHIFT) : darken(bg, ELEMENT_SHIFT),
  };

  const theme = {
    $schema: "https://opencode.ai/theme.json",
    name,
    type,
    colors,
  };

  const outputPath = `./${name}.json`;
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

  await Bun.write(outputPath, JSON.stringify(theme, null, 2));
  console.log(`\n✓ Theme saved to ${outputPath}`);
  console.log(`  Type: ${type}`);
  console.log(`  Colors: ${Object.keys(colors).length} tokens`);
}

export async function themeCommand(): Promise<void> {
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
