import { describe, expect, it } from "bun:test";

describe("setup command", () => {
  it("shows usage information with --help", async () => {
    Bun.argv = ["bun", "setup.ts", "--help"];
    const { setupCommand } = await import("../setup");

    let output = "";
    const orig = console.log;
    console.log = (s: string) => { output += s + "\n"; };

    await setupCommand();
    console.log = orig;

    expect(output).toContain("Usage:");
    expect(output).toContain("omo-kit setup");
    expect(output).toContain("oh-my-openagent");
  });
});
