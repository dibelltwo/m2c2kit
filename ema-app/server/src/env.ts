import { loadEnvFile } from "node:process";

try {
  loadEnvFile();
} catch {
  // Local development can still rely on exported shell variables.
}
