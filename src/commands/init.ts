import { select, checkbox, confirm } from "@inquirer/prompts";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
);

interface AgentOverride {
  textVerbosity?: string;
  thinking?: { budgetTokens?: number; type?: string };
}

interface CategoryOverride {
  textVerbosity?: string;
  thinking?: { budgetTokens?: number; type?: string };
}

interface StackProfile {
  name: string;
  description: string;
  disabled_skills?: string[];
  disabled_mcps?: string[];
  agent_overrides?: Record<string, AgentOverride>;
  category_overrides?: Record<string, CategoryOverride>;
}

export async function discoverStacks(): Promise<Map<string, StackProfile>> {
  const stacks = new Map<string, StackProfile>();
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const agentsPath = join(TEMPLATES_DIR, e.name, "AGENTS.md");
    const profilePath = join(TEMPLATES_DIR, e.name, "profile.json");
    try {
      await Bun.file(agentsPath).text();
      const profile: StackProfile = JSON.parse(
        await Bun.file(profilePath).text(),
      );
      stacks.set(e.name, profile);
    } catch {
      continue;
    }
  }
  return stacks;
}

type Provider =
  | "opencode-go"
  | "anthropic"
  | "openai"
  | "github-copilot"
  | "gemini"
  | "xai"
  | "deepseek";

type BudgetTier = "generous" | "frugal" | "free-only";

interface FallbackModel {
  model: string;
}

interface AgentConfig {
  model: string;
  textVerbosity: string;
  thinking?: { type: string; budgetTokens: number };
  fallback_models: FallbackModel[];
}

interface CategoryConfig {
  model: string;
  textVerbosity: string;
  fallback_models: FallbackModel[];
}

interface OhMyOpenagentConfig {
  $schema: string;
  disabled_skills: string[];
  disabled_mcps: string[];
  agents: Record<string, AgentConfig>;
  categories: Record<string, CategoryConfig>;
}

interface OpenCodeConfig {
  $schema: string;
  ohMyOpenagent: {
    configPath: string;
  };
  model: string;
}

interface TuiConfig {
  theme: string;
  showThinking: boolean;
}

interface ModelPool {
  premium: string[];
  medium: string[];
  free: string[];
}

export const MODEL_CATALOG: Record<Provider, ModelPool> = {
  "opencode-go": {
    premium: [
      "opencode-go/deepseek-v4-pro",
      "opencode-go/glm-5.1",
      "opencode-go/kimi2.6",
    ],
    medium: [
      "opencode-go/glm-5.1",
      "opencode-go/minimax-m2.7",
      "opencode-go/kimi2.5",
      "opencode-go/qwen3.6-plus",
    ],
    free: ["opencode-go/minimax-m2.5-free", "opencode-go/big-pickle"],
  },
  anthropic: {
    premium: ["anthropic/claude-opus-4-8"],
    medium: ["anthropic/claude-sonnet-4-6"],
    free: ["anthropic/claude-haiku-4-5"],
  },
  openai: {
    premium: ["openai/gpt-5.5"],
    medium: ["openai/gpt-4.1"],
    free: ["openai/gpt-4.1-mini"],
  },
  "github-copilot": {
    premium: [
      "github-copilot/gpt-5.5",
      "github-copilot/claude-opus-4-8",
    ],
    medium: ["github-copilot/claude-sonnet-4-6"],
    free: ["github-copilot/claude-haiku-4-5"],
  },
  gemini: {
    premium: ["gemini/gemini-3.1-pro"],
    medium: ["gemini/gemini-3.1-flash"],
    free: ["gemini/gemini-3.1-flash-lite"],
  },
  xai: {
    premium: ["xai/grok-4.3"],
    medium: ["xai/grok-4.3"],
    free: [],
  },
  deepseek: {
    premium: ["deepseek/deepseek-v4-pro"],
    medium: ["deepseek/deepseek-v4-flash"],
    free: ["deepseek/deepseek-v4-flash"],
  },
};

type AgentTier = "premium" | "medium" | "free";

const AGENT_TIERS: Record<string, AgentTier> = {
  sisyphus: "premium",
  oracle: "premium",
  explore: "medium",
  librarian: "medium",
  prometheus: "premium",
  atlas: "premium",
  metis: "premium",
  momus: "medium",
  "sisyphus-junior": "medium",
  "multimodal-looker": "medium",
};

const CATEGORY_TIERS: Record<string, AgentTier> = {
  "visual-engineering": "premium",
  ultrabrain: "premium",
  deep: "premium",
  artistry: "medium",
  quick: "free",
  "unspecified-low": "free",
  "unspecified-high": "premium",
  writing: "medium",
};

const ALL_AGENTS = [
  "sisyphus",
  "oracle",
  "explore",
  "librarian",
  "prometheus",
  "atlas",
  "metis",
  "momus",
  "sisyphus-junior",
  "multimodal-looker",
] as const;

const ALL_CATEGORIES = [
  "visual-engineering",
  "ultrabrain",
  "deep",
  "artistry",
  "quick",
  "unspecified-low",
  "unspecified-high",
  "writing",
] as const;

function buildPool(providers: Provider[]): ModelPool {
  const pool: ModelPool = { premium: [], medium: [], free: [] };
  for (const p of providers) {
    pool.premium.push(...MODEL_CATALOG[p].premium);
    pool.medium.push(...MODEL_CATALOG[p].medium);
    pool.free.push(...MODEL_CATALOG[p].free);
  }
  pool.premium = [...new Set(pool.premium)];
  pool.medium = [...new Set(pool.medium)];
  pool.free = [...new Set(pool.free)];
  return pool;
}

function effectiveTier(
  agentTier: AgentTier,
  budget: BudgetTier,
  isOrchestrator: boolean,
): AgentTier {
  if (budget === "free-only") return "free";
  if (budget === "generous") return agentTier;
  if (isOrchestrator) return "premium";
  if (agentTier === "premium") return "medium";
  if (agentTier === "medium") return "free";
  return "free";
}

function pickModel(pool: ModelPool, tier: AgentTier): string {
  const candidates = pool[tier];
  if (candidates.length > 0) return candidates[0];
  if (tier === "premium" && pool.medium.length > 0) return pool.medium[0];
  if (tier !== "free" && pool.free.length > 0) return pool.free[0];
  throw new Error(`No model available for tier "${tier}"`);
}

function pickFallbacks(
  pool: ModelPool,
  primaryTier: AgentTier,
  budget: BudgetTier,
  primaryModel: string,
): FallbackModel[] {
  const allCandidates: string[] = [];

  if (budget === "free-only") {
    allCandidates.push(...pool.free.filter((m) => m !== primaryModel));
  } else {
    const tiers: AgentTier[] =
      primaryTier === "premium"
        ? ["premium", "medium", "free"]
        : primaryTier === "medium"
          ? ["medium", "free"]
          : ["free"];

    for (const t of tiers) {
      for (const m of pool[t]) {
        if (m !== primaryModel) allCandidates.push(m);
      }
    }
  }

  const unique = [...new Set(allCandidates)];
  return unique.slice(0, 3).map((model) => ({ model }));
}

export function generateOhMyOpenagent(
  providers: Provider[],
  budget: BudgetTier,
  orchestratorModel: string,
  profile?: StackProfile,
): OhMyOpenagentConfig {
  const pool = buildPool(providers);

  const agents: Record<string, AgentConfig> = {};
  for (const name of ALL_AGENTS) {
    const isOrch = name === "sisyphus";
    const tier = effectiveTier(AGENT_TIERS[name], budget, isOrch);
    const model = isOrch ? orchestratorModel : pickModel(pool, tier);
    const fallback_models = pickFallbacks(pool, tier, budget, model);
    const agent: AgentConfig = { model, textVerbosity: "low", fallback_models };
    // Thinking policy: conservative for premium (avoids DeepSeek thinking bug),
    // enabled for medium with budget proportional to task complexity,
    // disabled for free-tier and lightweight search agents.
    if (name === "momus") {
      agent.thinking = { type: "enabled", budgetTokens: 16000 };
    } else if (name === "sisyphus-junior") {
      agent.thinking = { type: "enabled", budgetTokens: 4000 };
    } else if (["explore", "librarian"].includes(name) || tier === "free") {
      agent.thinking = { type: "disabled", budgetTokens: 0 };
    }
    agents[name] = agent;
  }

  if (profile?.agent_overrides) {
    for (const [name, override] of Object.entries(profile.agent_overrides)) {
      if (agents[name]) {
        agents[name] = { ...agents[name], ...override };
      }
    }
  }

  const categories: Record<string, CategoryConfig> = {};
  for (const name of ALL_CATEGORIES) {
    const tier = effectiveTier(CATEGORY_TIERS[name], budget, false);
    const model = pickModel(pool, tier);
    const fallback_models = pickFallbacks(pool, tier, budget, model);
    categories[name] = { model, textVerbosity: "low", fallback_models };
    // Category thinking: enabled for visual/creative, disabled for free tier.
    if (name === "visual-engineering") {
      categories[name].thinking = { type: "enabled", budgetTokens: 8000 };
    } else if (name === "artistry") {
      categories[name].thinking = { type: "enabled", budgetTokens: 16000 };
    } else if (tier === "free") {
      categories[name].thinking = { type: "disabled", budgetTokens: 0 };
    }
  }

  if (profile?.category_overrides) {
    for (const [name, override] of Object.entries(
      profile.category_overrides,
    )) {
      if (categories[name]) {
        categories[name] = { ...categories[name], ...override };
      }
    }
  }

  return {
    $schema: "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json",
    disabled_skills: profile?.disabled_skills
      ? [...new Set(profile.disabled_skills)]
      : [],
    disabled_mcps: profile?.disabled_mcps
      ? [...new Set(profile.disabled_mcps)]
      : [],
    agents,
    categories,
  };
}

export function generateOpenCodeConfig(orchestratorModel: string): OpenCodeConfig {
  return {
    $schema: "https://opencode.ai/config.json",
    ohMyOpenagent: {
      configPath: "oh-my-openagent.json",
    },
    model: orchestratorModel,
  };
}

export function generateTuiConfig(): TuiConfig {
  return {
    theme: "default",
    showThinking: true,
  };
}

interface ValidationError {
  path: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateOhMyOpenagent(data: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isRecord(data)) {
    errors.push({
      path: "oh-my-openagent.json",
      message: "Not a JSON object",
    });
    return errors;
  }

  if (!Array.isArray(data.disabled_skills))
    errors.push({
      path: "oh-my-openagent.json.disabled_skills",
      message: "Must be an array",
    });
  if (!Array.isArray(data.disabled_mcps))
    errors.push({
      path: "oh-my-openagent.json.disabled_mcps",
      message: "Must be an array",
    });
  if (!isRecord(data.agents))
    errors.push({
      path: "oh-my-openagent.json.agents",
      message: "Must be an object",
    });
  if (!isRecord(data.categories))
    errors.push({
      path: "oh-my-openagent.json.categories",
      message: "Must be an object",
    });

  if (isRecord(data.agents)) {
    for (const [name, agent] of Object.entries(data.agents)) {
      if (!isRecord(agent)) {
        errors.push({
          path: `oh-my-openagent.json.agents.${name}`,
          message: "Must be an object",
        });
        continue;
      }
      if (typeof agent.model !== "string" || agent.model.length === 0)
        errors.push({
          path: `oh-my-openagent.json.agents.${name}.model`,
          message: "Must be a non-empty string",
        });
      if (!Array.isArray(agent.fallback_models))
        errors.push({
          path: `oh-my-openagent.json.agents.${name}.fallback_models`,
          message: "Must be an array",
        });
      else {
        for (let i = 0; i < agent.fallback_models.length; i++) {
          const fb = agent.fallback_models[i];
          if (
            !isRecord(fb) ||
            typeof fb.model !== "string" ||
            fb.model.length === 0
          ) {
            errors.push({
              path: `oh-my-openagent.json.agents.${name}.fallback_models[${i}]`,
              message: "Must have a string 'model' field",
            });
          }
        }
      }
    }
  }

  if (isRecord(data.categories)) {
    for (const [name, cat] of Object.entries(data.categories)) {
      if (!isRecord(cat)) {
        errors.push({
          path: `oh-my-openagent.json.categories.${name}`,
          message: "Must be an object",
        });
        continue;
      }
      if (typeof cat.model !== "string" || cat.model.length === 0)
        errors.push({
          path: `oh-my-openagent.json.categories.${name}.model`,
          message: "Must be a non-empty string",
        });
      if (!Array.isArray(cat.fallback_models))
        errors.push({
          path: `oh-my-openagent.json.categories.${name}.fallback_models`,
          message: "Must be an array",
        });
    }
  }

  return errors;
}

function validateOpenCodeConfig(data: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isRecord(data)) {
    errors.push({ path: "opencode.json", message: "Not a JSON object" });
    return errors;
  }
  if (typeof data.model !== "string" || data.model.length === 0)
    errors.push({
      path: "opencode.json.model",
      message: "Must be a non-empty string",
    });
  if (data.ohMyOpenagent !== undefined) {
    if (!isRecord(data.ohMyOpenagent))
      errors.push({
        path: "opencode.json.ohMyOpenagent",
        message: "Must be an object",
      });
    else if (
      typeof data.ohMyOpenagent.configPath !== "string" ||
      data.ohMyOpenagent.configPath.length === 0
    )
      errors.push({
        path: "opencode.json.ohMyOpenagent.configPath",
        message: "Must be a non-empty string",
      });
  }
  return errors;
}

function validateTuiConfig(data: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isRecord(data)) {
    errors.push({ path: "tui.json", message: "Not a JSON object" });
    return errors;
  }
  if (typeof data.theme !== "string" || data.theme.length === 0)
    errors.push({
      path: "tui.json.theme",
      message: "Must be a non-empty string",
    });
  return errors;
}

async function readTemplate(stack: string, filename: string): Promise<string> {
  const templatePath = join(TEMPLATES_DIR, stack, filename);
  return readFile(templatePath, "utf-8");
}

async function writeJsonFile(
  cwd: string,
  filename: string,
  data: unknown,
): Promise<string> {
  const filePath = join(cwd, filename);
  const content = JSON.stringify(data, null, 2) + "\n";
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

async function writeMarkdownFile(
  cwd: string,
  filename: string,
  content: string,
): Promise<string> {
  const filePath = join(cwd, filename);
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

async function promptStack(stacks: Map<string, StackProfile>): Promise<string> {
  const choices = [
    ...stacks.entries().map(([value, profile]) => ({
      name: `${capitalize(value)} — ${profile.description}`,
      value,
    })),
    { name: "Custom — I'll describe my stack", value: "__custom__" },
  ];
  const choice = await select<string>({
    message: `What is your project stack? (Stacks available: ${stacks.size})`,
    choices,
  });
  if (choice === "__custom__") {
    const { input } = await import("@inquirer/prompts");
    return input({
      message: "Describe your stack (e.g. PHP/Laravel, C++/CMake):",
      validate: (v: string) => v.length > 0 || "Stack name is required",
    });
  }
  return choice;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function promptProviders(): Promise<Provider[]> {
  const choices = [
    { name: "OpenCode Go (deepseek, glm, kimi, minimax)", value: "opencode-go" as const },
    { name: "Anthropic (Claude models)", value: "anthropic" as const },
    { name: "OpenAI (GPT models)", value: "openai" as const },
    { name: "GitHub Copilot", value: "github-copilot" as const },
    { name: "Google Gemini", value: "gemini" as const },
    { name: "xAI (Grok)", value: "xai" as const },
    { name: "DeepSeek", value: "deepseek" as const },
  ];
  return checkbox<Provider>({
    message: `Which model providers do you have access to? (Providers available: ${choices.length})`,
    choices,
    validate: (answers: Provider[]) => {
      if (answers.length === 0) return "Select at least one provider.";
      return true;
    },
  });
}

async function promptOrchestrator(providers: Provider[]): Promise<string> {
  const pool = buildPool(providers);
  const choices = pool.premium.map((m) => ({ name: m, value: m }));

  if (choices.length === 1) {
    console.log(
      `  Primary orchestrator: ${choices[0].value} (only premium model available)`,
    );
    return choices[0].value;
  }

  return select<string>({
    message: "Which model should be your primary orchestrator?",
    choices,
  });
}

async function promptBudget(): Promise<BudgetTier> {
  return select<BudgetTier>({
    message: "What is your budget preference?",
    choices: [
      {
        name: "Generous — premium models for everything",
        value: "generous",
      },
      {
        name: "Frugal — premium only for orchestrator, medium/free for rest",
        value: "frugal",
      },
      {
        name: "Free only — use only free-tier models",
        value: "free-only",
      },
    ],
  });
}

export async function initCommand(): Promise<void> {
  if (Bun.argv.includes("--help") || Bun.argv.includes("-h")) {
    console.log(`omo-kit init — Generate oh-my-openagent config files interactively

Usage:
  bunx omo-kit init [options]

Options:
  --stack <name>      Skip stack selection (e.g. go, rust, astro)
  --provider <names>  Skip provider selection, comma-separated
                      (e.g. opencode-go,anthropic)
  --budget <tier>     Skip budget prompt (generous, frugal, free-only)
  -y, --yes           Skip overwrite confirmation
  --help, -h          Show this help message

Non-interactive example:
  bunx omo-kit init --stack go --provider opencode-go --budget frugal -y
`);
    return;
  }

  const stackIdx = Bun.argv.indexOf("--stack");
  const flagStack: string | null =
    stackIdx !== -1 && Bun.argv[stackIdx + 1] ? Bun.argv[stackIdx + 1] : null;

  const providerIdx = Bun.argv.indexOf("--provider");
  const flagProvidersRaw: string | null =
    providerIdx !== -1 && Bun.argv[providerIdx + 1]
      ? Bun.argv[providerIdx + 1]
      : null;

  const VALID_PROVIDERS = new Set([
    "opencode-go",
    "anthropic",
    "openai",
    "github-copilot",
    "gemini",
    "xai",
    "deepseek",
  ]);

  const budgetIdx = Bun.argv.indexOf("--budget");
  const flagBudget: string | null =
    budgetIdx !== -1 && Bun.argv[budgetIdx + 1]
      ? Bun.argv[budgetIdx + 1]
      : null;

  const VALID_BUDGETS = new Set(["generous", "frugal", "free-only"]);

  const isYes = Bun.argv.includes("--yes") || Bun.argv.includes("-y");

  const cwd = process.cwd();

  console.log("\n  omo-kit init — generate oh-my-openagent config files\n");

  try {
    const stacks = await discoverStacks();

    let stack: string;
    if (flagStack) {
      if (flagStack === "__custom__") {
        const { input } = await import("@inquirer/prompts");
        stack = await input({
          message: "Describe your stack (e.g. PHP/Laravel, C++/CMake):",
          validate: (v: string) => v.length > 0 || "Stack name is required",
        });
      } else if (stacks.has(flagStack)) {
        stack = flagStack;
      } else {
        console.error(`\n  Unknown stack: "${flagStack}"`);
        console.error(
          `  Available: ${[...stacks.keys()].join(", ")}`,
        );
        process.exit(1);
      }
    } else {
      stack = await promptStack(stacks);
    }

    const profile = stacks.get(stack) ?? stacks.get("generic");

    let providers: Provider[];
    if (flagProvidersRaw) {
      const raw = flagProvidersRaw.split(",").map((p) => p.trim());
      for (const p of raw) {
        if (!VALID_PROVIDERS.has(p)) {
          console.error(`\n  Unknown provider: "${p}"`);
          console.error(
            `  Available: ${[...VALID_PROVIDERS].join(", ")}`,
          );
          process.exit(1);
        }
      }
      providers = raw as Provider[];
    } else {
      providers = await promptProviders();
    }
    const orchestratorModel = await promptOrchestrator(providers);

    let budget: BudgetTier;
    if (flagBudget) {
      if (!VALID_BUDGETS.has(flagBudget)) {
        console.error(`\n  Unknown budget: "${flagBudget}"`);
        console.error(
          `  Available: ${[...VALID_BUDGETS].join(", ")}`,
        );
        process.exit(1);
      }
      budget = flagBudget as BudgetTier;
    } else {
      budget = await promptBudget();
    }

    const omoConfig = generateOhMyOpenagent(
      providers,
      budget,
      orchestratorModel,
      profile,
    );
    const openCodeConfig = generateOpenCodeConfig(orchestratorModel);
    const tuiConfig = generateTuiConfig();

    const templateStack = stacks.has(stack) ? stack : "generic";

    const agentsTemplate = await readTemplate(templateStack, "AGENTS.md");

    const allErrors: ValidationError[] = [
      ...validateOhMyOpenagent(omoConfig),
      ...validateOpenCodeConfig(openCodeConfig),
      ...validateTuiConfig(tuiConfig),
    ];

    if (allErrors.length > 0) {
      console.error("\n  Config validation failed:\n");
      for (const e of allErrors) {
        console.error(`    ${e.path}: ${e.message}`);
      }
      console.error("\n  Aborting — no files were written.\n");
      process.exit(1);
    }

    const files: string[] = [];
    const existing: string[] = [];
    const plannedPaths = [
      join(cwd, "oh-my-openagent.json"),
      join(cwd, "opencode.json"),
      join(cwd, "tui.json"),
      join(cwd, "AGENTS.md"),
    ];

    for (const p of plannedPaths) {
      const f = Bun.file(p);
      try {
        if (await f.exists()) existing.push(p);
      } catch {}
    }

    if (existing.length > 0) {
      const overwrite = isYes
        ? true
        : await confirm({
            message: "Overwrite these files?",
            default: false,
          });
      if (isYes) {
        console.log(
          `\n  (overwriting ${existing.length} file${existing.length > 1 ? "s" : ""} — --yes)`,
        );
      } else {
        console.log(`\n  Existing files found:`);
        for (const p of existing) console.log(`    ${p}`);
      }
      if (!overwrite) {
        console.log("  Aborted.\n");
        process.exit(0);
      }
    }

    files.push(await writeJsonFile(cwd, "oh-my-openagent.json", omoConfig));
    files.push(await writeJsonFile(cwd, "opencode.json", openCodeConfig));
    files.push(await writeJsonFile(cwd, "tui.json", tuiConfig));
    files.push(await writeMarkdownFile(cwd, "AGENTS.md", agentsTemplate));

    console.log(`\n  ✓ Generated ${files.length} files:\n`);
    for (const f of files) {
      console.log(`    ${f}`);
    }

    console.log(`\n  Stack:        ${stack}`);
    console.log(`  Providers:    ${providers.join(", ")}`);
    console.log(`  Orchestrator: ${orchestratorModel}`);
    console.log(`  Budget:       ${budget}`);
    console.log(
      `\n  Run "bunx omo-kit doctor" to validate your configs.\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n  Error: ${message}\n`);
    process.exit(1);
  }
}
