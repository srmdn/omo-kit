import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir: string;
let originalArgv: string[];

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "omo-doctor-test-"));
  originalArgv = [...Bun.argv];
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  Bun.argv.length = 0;
  Bun.argv.push(...originalArgv);
});

function setArgv(args: string[]) {
  Bun.argv.length = 0;
  Bun.argv.push("bun", "doctor.ts", ...args);
}

// ─── Validation helpers ────────────────────────────────────────────

function writeConfig(name: string, content: string) {
  writeFileSync(join(tmpDir, name), content);
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("doctor command", () => {
  describe("--help", () => {
    it("shows help text with all flags", async () => {
      setArgv(["--help"]);
      const { doctorCommand } = await import("../doctor");

      let output = "";
      const origConsole = console.log;
      console.log = (s: string) => {
        output += s + "\n";
      };

      await doctorCommand();
      console.log = origConsole;

      expect(output).toContain("Usage:");
      expect(output).toContain("--verbose");
      expect(output).toContain("--fix");
    });
  });

  describe("validation", () => {
    it("passes for valid config", async () => {
      writeConfig(
        "oh-my-openagent.json",
        JSON.stringify({
          $schema:
            "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/main/schema.json",
          providers: "opencode-go",
          agents: {
            sisyphus: { model: "opencode-go/deepseek-v4-pro" },
          },
          categories: {
            quick: { model: "opencode-go/minimax-m2.5-free" },
          },
        }),
      );

      setArgv([]);
      const oraCwd = process.cwd;
      process.cwd = () => tmpDir;

      const { doctorCommand } = await import("../doctor");
      let exited = false;
      const origExit = process.exit;
      process.exit = (() => {
        exited = true;
      }) as typeof process.exit;

      let output = "";
      const origLog = console.log;
      console.log = (s: string) => {
        output += s + "\n";
      };

      await doctorCommand();
      console.log = origLog;
      process.exit = origExit;
      process.cwd = oraCwd;

      expect(output).toContain("All clear");
      expect(output).not.toContain("warning");
      expect(exited).toBe(false);
    });

    it("fails for invalid JSON", async () => {
      writeConfig("oh-my-openagent.json", "not json at all");

      setArgv([]);
      const oraCwd = process.cwd;
      process.cwd = () => tmpDir;

      const { doctorCommand } = await import("../doctor");
      let exitCode = 0;
      const origExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code ?? 0;
      }) as typeof process.exit;

      let output = "";
      const origLog = console.log;
      console.log = (s: string) => {
        output += s + "\n";
      };

      await doctorCommand();
      console.log = origLog;
      process.exit = origExit;
      process.cwd = oraCwd;

      expect(output).toContain("invalid JSON");
      expect(exitCode).toBe(1);
    });

    it("detects tab indentation", async () => {
      writeConfig(
        "oh-my-openagent.json",
        '{\n\t"providers": "opencode-go",\n\t"agents": {},\n\t"categories": {}\n}',
      );

      setArgv([]);
      const oraCwd = process.cwd;
      process.cwd = () => tmpDir;

      const { doctorCommand } = await import("../doctor");
      let output = "";
      const origLog = console.log;
      console.log = (s: string) => {
        output += s + "\n";
      };

      await doctorCommand();
      console.log = origLog;
      process.cwd = oraCwd;

      expect(output).toContain("tab indentation");
    });

    it("detects legacy srmdn/ references", async () => {
      writeConfig(
        "oh-my-openagent.json",
        JSON.stringify({
          $schema:
            "https://raw.githubusercontent.com/srmdn/oh-my-openagent/main/schema.json",
          providers: "opencode-go",
          agents: { sisyphus: { model: "test" } },
          categories: { quick: { model: "test" } },
        }),
      );

      setArgv([]);
      const oraCwd = process.cwd;
      process.cwd = () => tmpDir;

      const { doctorCommand } = await import("../doctor");
      let output = "";
      const origLog = console.log;
      console.log = (s: string) => {
        output += s + "\n";
      };

      await doctorCommand();
      console.log = origLog;
      process.cwd = oraCwd;

      expect(output).toContain("srmdn/");
    });

    it("detects singular provider key", async () => {
      writeConfig(
        "oh-my-openagent.json",
        JSON.stringify({
          $schema:
            "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/main/schema.json",
          provider: "opencode-go",
          agents: { sisyphus: { model: "test" } },
          categories: { quick: { model: "test" } },
        }),
      );

      setArgv([]);
      const oraCwd = process.cwd;
      process.cwd = () => tmpDir;

      const { doctorCommand } = await import("../doctor");
      let output = "";
      const origLog = console.log;
      console.log = (s: string) => {
        output += s + "\n";
      };

      await doctorCommand();
      console.log = origLog;
      process.cwd = oraCwd;

      expect(output).toContain('"provider" (singular)');
    });
  });

  describe("--fix", () => {
    it("collects and applies fixable issues with --yes", async () => {
      writeConfig(
        "oh-my-openagent.json",
        JSON.stringify({
          $schema:
            "https://raw.githubusercontent.com/srmdn/oh-my-openagent/main/schema.json",
          provider: "opencode-go",
          agents: { sisyphus: { model: "test" } },
          categories: { quick: { model: "test" } },
        }),
      );

      setArgv(["--fix", "--yes"]);
      const oraCwd = process.cwd;
      process.cwd = () => tmpDir;

      const { doctorCommand } = await import("../doctor");
      let output = "";
      const origLog = console.log;
      console.log = (s: string) => {
        output += s + "\n";
      };

      await doctorCommand();
      console.log = origLog;
      process.cwd = oraCwd;

      expect(output).toContain("Fixable issues");
      expect(output).toContain("srmdn/");
      expect(output).toContain("provider");
      expect(output).toContain("fix applied");
    });

    it("reports nothing to fix when config is clean", async () => {
      writeConfig(
        "oh-my-openagent.json",
        JSON.stringify({
          $schema:
            "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/main/schema.json",
          providers: "opencode-go",
          agents: { sisyphus: { model: "test" } },
          categories: { quick: { model: "test" } },
        }),
      );

      setArgv(["--fix"]);
      const oraCwd = process.cwd;
      process.cwd = () => tmpDir;

      const { doctorCommand } = await import("../doctor");
      let output = "";
      const origLog = console.log;
      console.log = (s: string) => {
        output += s + "\n";
      };

      await doctorCommand();
      console.log = origLog;
      process.cwd = oraCwd;

      expect(output).toContain("nothing to fix");
    });

    it("errors when --yes used without --fix", async () => {
      setArgv(["--yes"]);
      const { doctorCommand } = await import("../doctor");
      let errOutput = "";
      const origErr = console.error;
      console.error = (s: string) => {
        errOutput += s + "\n";
      };

      let exitCode = 0;
      const origExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code ?? 0;
      }) as typeof process.exit;

      await doctorCommand();
      console.error = origErr;
      process.exit = origExit;

      expect(errOutput).toContain("--yes flag requires --fix");
      expect(exitCode).toBe(1);
    });
  });

  describe("--verbose", () => {
    it("shows scanning and file size info", async () => {
      writeConfig(
        "oh-my-openagent.json",
        JSON.stringify({
          $schema:
            "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/main/schema.json",
          providers: "opencode-go",
          agents: { sisyphus: { model: "test" } },
          categories: { quick: { model: "test" } },
        }),
      );

      setArgv(["--verbose"]);
      const oraCwd = process.cwd;
      process.cwd = () => tmpDir;

      const { doctorCommand } = await import("../doctor");
      let output = "";
      const origLog = console.log;
      console.log = (s: string) => {
        output += s + "\n";
      };

      await doctorCommand();
      console.log = origLog;
      process.cwd = oraCwd;

      expect(output).toContain("Scanning");
      expect(output).toContain("KB");
      expect(output).toContain("(verbose)");
    });
  });
});
