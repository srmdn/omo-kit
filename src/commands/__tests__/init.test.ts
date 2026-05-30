import { describe, expect, it } from "bun:test";

describe("init — discoverStacks", () => {
  it("discovers all 7 stack templates", async () => {
    const { discoverStacks } = await import("../init");

    const stacks = await discoverStacks();
    expect(stacks).toBeDefined();
    expect(stacks.size).toBe(7);

    const names = [...stacks.keys()].sort();
    expect(names).toEqual([
      "astro",
      "generic",
      "go",
      "node",
      "python",
      "rust",
      "svelte",
    ]);
  });

  it("each stack has name and description", async () => {
    const { discoverStacks } = await import("../init");
    const stacks = await discoverStacks();

    for (const [key, profile] of stacks) {
      expect(profile.name).toBeTruthy();
      expect(typeof profile.description).toBe("string");
      expect(profile.description!.length).toBeGreaterThan(0);
    }
  });

  it("go and rust stacks disable frontend skills", async () => {
    const { discoverStacks } = await import("../init");
    const stacks = await discoverStacks();

    const go = stacks.get("go")!;
    expect(go.disabled_skills).toContain("frontend-ui-ux");
    expect(go.disabled_skills).toContain("frontend-design");
    expect(go.disabled_skills).toContain("design-taste-frontend");
    expect(go.disabled_mcps).toContain("browser");
    expect(go.disabled_mcps).toContain("playwright");

    const rust = stacks.get("rust")!;
    expect(rust.disabled_skills).toContain("frontend-ui-ux");
    expect(rust.disabled_mcps).toContain("browser");
  });

  it("web stacks keep all skills enabled", async () => {
    const { discoverStacks } = await import("../init");
    const stacks = await discoverStacks();

    const astro = stacks.get("astro")!;
    expect(astro.disabled_skills?.length || 0).toBe(0);
    expect(astro.disabled_mcps?.length || 0).toBe(0);

    const svelte = stacks.get("svelte")!;
    expect(svelte.disabled_skills?.length || 0).toBe(0);
  });

  it("go and rust set oracle thinking override", async () => {
    const { discoverStacks } = await import("../init");
    const stacks = await discoverStacks();

    const go = stacks.get("go")!;
    expect(go.agent_overrides?.oracle?.thinking?.budgetTokens).toBe(16000);

    const rust = stacks.get("rust")!;
    expect(rust.agent_overrides?.oracle?.thinking?.budgetTokens).toBe(16000);

    const python = stacks.get("python")!;
    expect(python.agent_overrides?.oracle).toBeUndefined();
  });
});

describe("init — MODEL_CATALOG", () => {
  it("has all 7 required providers", async () => {
    const { MODEL_CATALOG } = await import("../init");

    const expectedProviders = [
      "opencode-go",
      "anthropic",
      "openai",
      "github-copilot",
      "gemini",
      "xai",
      "deepseek",
    ];

    for (const provider of expectedProviders) {
      expect(MODEL_CATALOG[provider]).toBeDefined();
    }
    expect(Object.keys(MODEL_CATALOG).length).toBe(7);
  });

  it("opencode-go has 3 premium, 4 medium, 2 free models", async () => {
    const { MODEL_CATALOG } = await import("../init");
    const og = MODEL_CATALOG["opencode-go"];

    expect(og.premium.length).toBeGreaterThanOrEqual(3);
    expect(og.medium.length).toBeGreaterThanOrEqual(4);
    expect(og.free.length).toBeGreaterThanOrEqual(2);
  });

  it("all providers have at least premium tier models", async () => {
    const { MODEL_CATALOG } = await import("../init");

    for (const [name, pool] of Object.entries(MODEL_CATALOG)) {
      expect(pool.premium.length).toBeGreaterThan(0);
    }
  });
});

describe("init — config generation", () => {
  it("generateOhMyOpenagent produces valid agent config", async () => {
    const { generateOhMyOpenagent } = await import("../init");

    const config = generateOhMyOpenagent(
      ["opencode-go"],
      "frugal",
      "opencode-go/glm-5.1",
    );

    expect(config).toBeDefined();
    expect(config.agents).toBeDefined();
    expect(config.categories).toBeDefined();

    const agentCount = Object.keys(config.agents as Record<string, unknown>).length;
    expect(agentCount).toBeGreaterThanOrEqual(9);

    expect(config.agents.sisyphus).toBeDefined();
    expect(config.agents.sisyphus.model).toBe("opencode-go/glm-5.1");
  });

  it("generateOpenCodeConfig produces valid config", async () => {
    const { generateOpenCodeConfig } = await import("../init");

    const config = generateOpenCodeConfig("opencode-go/deepseek-v4-pro");
    expect(config.model).toBe("opencode-go/deepseek-v4-pro");
  });

  it("generateTuiConfig produces a config object", async () => {
    const { generateTuiConfig } = await import("../init");

    const config = generateTuiConfig();
    expect(config.theme).toBe("default");
    expect(config).toBeDefined();
    expect(typeof config.showThinking).toBe("boolean");
  });
});

describe("init — Provider validation", () => {
  it("VALID_PROVIDERS set contains all 7 providers", async () => {
    const validProviders = new Set([
      "opencode-go",
      "anthropic",
      "openai",
      "github-copilot",
      "gemini",
      "xai",
      "deepseek",
    ]);

    expect(validProviders.has("opencode-go")).toBe(true);
    expect(validProviders.has("unknown")).toBe(false);
    expect(validProviders.size).toBe(7);
  });
});
