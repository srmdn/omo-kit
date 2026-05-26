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

async function discoverStacks(): Promise<Map<string, StackProfile>> {
  const stacks = new Map<string, StackProfile>();
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const claudePath = join(TEMPLATES_DIR, e.name, "CLAUDE.md");
    const profilePath = join(TEMPLATES_DIR, e.name, "profile.json");
    try {
      await Bun.file(claudePath).text();
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
  | "gemini";

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

const MODEL_CATALOG: Record<Provider, ModelPool> = {
  "opencode-go": {
    premium: [
      "opencode-go/deepseek-v4-pro",
      "opencode-go/glm-5.1",
      "opencode-go/minimax-m2.7",
    ],
    medium: ["opencode-go/glm-5.1", "opencode-go/minimax-m2.7"],
    free: ["opencode-go/minimax-m2.5-free"],
  },
  anthropic: {
    premium: ["anthropic/claude-sonnet-4-20250514"],
    medium: ["anthropic/claude-sonnet-4-20250514"],
    free: ["anthropic/claude-haiku-3-5-20241022"],
  },
  openai: {
    premium: ["openai/gpt-4o", "openai/gpt-4.1"],
    medium: ["openai/gpt-4.1-mini"],
    free: ["openai/gpt-4.1-mini"],
  },
  "github-copilot": {
    premium: ["github-copilot/gpt-4o", "github-copilot/claude-sonnet"],
    medium: ["github-copilot/claude-sonnet"],
    free: ["github-copilot/claude-3.5-haiku"],
  },
  gemini: {
    premium: ["gemini/gemini-2.5-pro"],
    medium: ["gemini/gemini-2.5-flash"],
    free: ["gemini/gemini-2.5-flash"],
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

function generateOhMyOpenagent(
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
    if (["sisyphus", "oracle", "prometheus", "metis", "atlas"].includes(name)) {
      agent.thinking = { type: "enabled", budgetTokens: 8000 };
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

function generateOpenCodeConfig(orchestratorModel: string): OpenCodeConfig {
  return {
    $schema: "https://opencode.ai/config.json",
    ohMyOpenagent: {
      configPath: "oh-my-openagent.json",
    },
    model: orchestratorModel,
  };
}

function generateTuiConfig(): TuiConfig {
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
    message: "What is your project stack?",
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
  return checkbox<Provider>({
    message: "Which model providers do you have access to?",
    choices: [
      { name: "OpenCode Go (deepseek, glm, minimax)", value: "opencode-go" },
      { name: "Anthropic (Claude models)", value: "anthropic" },
      { name: "OpenAI (GPT models)", value: "openai" },
      { name: "GitHub Copilot", value: "github-copilot" },
      { name: "Google Gemini", value: "gemini" },
    ],
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
  const cwd = process.cwd();

  console.log("\n  omo-kit init — generate oh-my-openagent config files\n");

  try {
    const stacks = await discoverStacks();
    const stack = await promptStack(stacks);
    const profile = stacks.get(stack) ?? stacks.get("generic");
    const providers = await promptProviders();
    const orchestratorModel = await promptOrchestrator(providers);
    const budget = await promptBudget();

    const omoConfig = generateOhMyOpenagent(
      providers,
      budget,
      orchestratorModel,
      profile,
    );
    const openCodeConfig = generateOpenCodeConfig(orchestratorModel);
    const tuiConfig = generateTuiConfig();

    const templateStack = stacks.has(stack) ? stack : "generic";

    const [claudeTemplate, agentsTemplate] = await Promise.all([
      readTemplate(templateStack, "CLAUDE.md"),
      readTemplate(templateStack, "AGENTS.md"),
    ]);

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
      join(cwd, "CLAUDE.md"),
      join(cwd, "AGENTS.md"),
    ];

    for (const p of plannedPaths) {
      const f = Bun.file(p);
      try {
        if (await f.exists()) existing.push(p);
      } catch {}
    }

    if (existing.length > 0) {
      console.log(`\n  Existing files found:`);
      for (const p of existing) console.log(`    ${p}`);
      const proceed = await confirm({
        message: "Overwrite these files?",
        default: false,
      });
      if (!proceed) {
        console.log("  Aborted.\n");
        process.exit(0);
      }
    }

    files.push(await writeJsonFile(cwd, "oh-my-openagent.json", omoConfig));
    files.push(await writeJsonFile(cwd, "opencode.json", openCodeConfig));
    files.push(await writeJsonFile(cwd, "tui.json", tuiConfig));
    files.push(await writeMarkdownFile(cwd, "CLAUDE.md", claudeTemplate));
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
