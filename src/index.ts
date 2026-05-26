#!/usr/bin/env bun
import { initCommand } from "./commands/init";
import { doctorCommand } from "./commands/doctor";
import { themeCommand } from "./commands/theme";

const command = Bun.argv[2];

async function main() {
  switch (command) {
    case "init":
      await initCommand();
      break;
    case "setup":
      console.log("Not yet implemented. Run: bunx oh-my-openagent install");
      console.log("Then: bunx omo-kit init");
      break;
    case "doctor":
      await doctorCommand();
      break;
    case "theme":
      await themeCommand();
      break;
    case undefined:
    case "--help":
    case "-h":
      console.log(`omo-kit — CLI toolkit for oh-my-openagent

Usage:
  bunx omo-kit init       Generate config files interactively
  bunx omo-kit doctor     Validate existing config files
  bunx omo-kit theme      Manage themes (validate, generate)

Docs: https://github.com/srmdn/rig/tree/main/cli
`);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run bunx omo-kit --help for usage.");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
