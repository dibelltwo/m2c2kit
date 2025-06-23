import { spawn } from "child_process";

console.log("🔧 Running build-concurrent...");

const proc = spawn("npm", ["run", "build-concurrent"], {
  stdio: "inherit",
  shell: true,
});

proc.on("exit", (code) => {
  if (code !== 0) {
    console.error("\n❌ One or more build steps failed.");
    process.exitCode = code;
  } else {
    console.log("\n✅ All build steps completed successfully.");
  }
});

process.on("SIGINT", () => {
  console.log("\n🛑 Build interrupted.");
  proc.kill("SIGINT");
  process.exit(1);
});
