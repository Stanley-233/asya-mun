import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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
const publicChangelogPathArg = getArgValue("--public-changelog", null);
const changelogFilePathArg = getArgValue("--changelog-file", null);

const syncPublicChangelog = () => {
  if (!publicChangelogPathArg) {
    return;
  }

  const publicChangelogPath = resolve(publicChangelogPathArg);
  const versionDir = dirname(versionFilePath);
  const changelogCandidates = [
    changelogFilePathArg ? resolve(changelogFilePathArg) : null,
    resolve(versionDir, "VERSION_CHANGELOG.md"),
    publicChangelogPath,
  ].filter(Boolean);

  const sourcePath = changelogCandidates.find((candidate) => existsSync(candidate));
  if (!sourcePath) {
    console.error(
      `Unable to find changelog source. Checked: ${changelogCandidates.join(", ")}`,
    );
    process.exit(1);
  }

  if (sourcePath !== publicChangelogPath) {
    copyFileSync(sourcePath, publicChangelogPath);
    console.log(`Synced changelog to ${publicChangelogPath}`);
  }
};

const version = readFileSync(versionFilePath, "utf8").trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version in ${versionFilePath}: ${version}`);
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(packageFilePath, "utf8"));

if (packageJson.version === version) {
  console.log(`Version already synced: ${version}`);
  syncPublicChangelog();
  process.exit(0);
}

packageJson.version = version;
writeFileSync(packageFilePath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`Synced ${packageFilePath} to version ${version}`);
syncPublicChangelog();
