import { spawn } from "child_process";

console.log("🔧 Running build-concurrent...");

const startTime = Date.now();

const proc = spawn("npm run build-concurrent", {
  stdio: "inherit",
  shell: true,
});

proc.on("exit", (code) => {
  const elapsedMs = Date.now() - startTime;
  const elapsedSeconds = (elapsedMs / 1000).toFixed(1); // one decimal place

  if (code !== 0) {
    console.error(
      `\n❌ One or more build steps failed after ${elapsedSeconds} seconds.`,
    );
    process.exitCode = code;
  } else {
    console.log(
      `\n✅ All build steps completed successfully in ${elapsedSeconds} seconds.`,
    );
  }
});

process.on("SIGINT", () => {
  console.log("\n🛑 Build interrupted.");
  proc.kill("SIGINT");
  process.exit(1);
});
