import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);

const getArgValue = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }
  return args[index + 1];
};

const versionFilePath = resolve(getArgValue("--version-file", "VERSION"));
const packageFilePath = resolve(getArgValue("--package", "frontend/package.json"));

const version = readFileSync(versionFilePath, "utf8").trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version in ${versionFilePath}: ${version}`);
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(packageFilePath, "utf8"));

if (packageJson.version === version) {
  console.log(`Version already synced: ${version}`);
  process.exit(0);
}

packageJson.version = version;
writeFileSync(packageFilePath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`Synced ${packageFilePath} to version ${version}`);
