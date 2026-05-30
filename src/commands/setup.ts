import { $ } from "bun";

export async function setupCommand(): Promise<void> {
  if (Bun.argv.includes("--help") || Bun.argv.includes("-h")) {
    console.log(`omo-kit setup — Bootstrap oh-my-openagent

Usage:
  bunx omo-kit setup

Installs the oh-my-openagent plugin into OpenCode.
This is required before running 'omo-kit init'.
`);
    return;
  }

  console.log("\n  omo-kit setup — bootstrap oh-my-openagent\n");

  // Check Bun
  try {
    const v = await $`bun --version`.quiet();
    console.log(`  ✓ bun ${v.text().trim()}`);
  } catch {
    console.error("  ✗ Bun is required but not found");
    console.error("    Install: brew install bun\n");
    process.exit(1);
  }

  // Check oh-my-openagent is reachable
  console.log("  Installing oh-my-openagent plugin...\n");

  const result = await $`bunx oh-my-openagent install`.nothrow();

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    console.error("  ✗ oh-my-openagent install failed");
    if (stderr) console.error(`    ${stderr}`);
    console.error("\n  Troubleshooting:");
    console.error("    • Ensure Bun is up to date: bun upgrade");
    console.error("    • Check network connectivity");
    console.error(
      "    • See https://github.com/code-yeongyu/oh-my-openagent\n",
    );
    process.exit(1);
  }

  // Show output from install
  const out = result.stdout.toString().trim();
  if (out) {
    for (const line of out.split("\n")) {
      console.log(`  ${line}`);
    }
    console.log();
  }

  console.log("  ✓ oh-my-openagent plugin installed");
  console.log("\n  Next step: bunx omo-kit init\n");
}
