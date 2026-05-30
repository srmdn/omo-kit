import { describe, expect, it } from "bun:test";

describe("theme command", () => {
  it("shows usage information with --help", async () => {
    Bun.argv = ["bun", "theme.ts", "--help"];
    const { themeCommand } = await import("../theme");

    let output = "";
    const orig = console.log;
    console.log = (s: string) => { output += s + "\n"; };

    await themeCommand();
    console.log = orig;

    expect(output).toContain("Usage:");
    expect(output).toContain("validate");
    expect(output).toContain("generate");
  });

  it("shows usage when no subcommand given", async () => {
    Bun.argv = ["bun", "theme.ts"];
    const { themeCommand } = await import("../theme");

    let output = "";
    const orig = console.log;
    console.log = (s: string) => { output += s + "\n"; };

    await themeCommand();
    console.log = orig;

    expect(output).toContain("Usage:");
  });
});
