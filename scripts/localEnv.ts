import { readFileSync } from "fs";
import { resolve } from "path";

export const loadLocalEnv = (): void => {
  const configPath = resolve(__dirname, "..", "config", "local.json");
  const { environment } = JSON.parse(readFileSync(configPath, "utf8"));

  for (const [key, value] of Object.entries(environment)) {
    if (!process.env[key]) process.env[key] = String(value);
  }
};
