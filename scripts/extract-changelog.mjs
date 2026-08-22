import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);

const getArgValue = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }
  return args[index + 1];
};

const changelogPath = resolve(
  getArgValue("--changelog", "VERSION_CHANGELOG.md")
);
const version = getArgValue("--version", "");
const outputFile = getArgValue("--output", null);

if (!version) {
  console.error("Usage: node extract-changelog.mjs --version X.Y.Z");
  process.exit(1);
}

const normalizedVersion = version.replace(/^v/, "");
const content = readFileSync(changelogPath, "utf8");
const lines = content.split("\n");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const versionPattern = new RegExp(
  `^(#{1,6})\\s+v${escapeRegExp(normalizedVersion)}\\b`
);

let capturing = false;
let result = [];
let parentHeading = null;
let versionHeadingLevel = null;
let versionHeadingLine = null;
let currentParent = null;

for (const line of lines) {
  const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
  if (!headingMatch) {
    if (capturing) {
      result.push(line);
    }
    continue;
  }

  const [, hashes] = headingMatch;
  const level = hashes.length;

  if (level === 1) {
    currentParent = line;
  }

  const versionMatch = line.match(versionPattern);
  if (versionMatch) {
    parentHeading = currentParent;
    versionHeadingLevel = versionMatch[1].length;
    versionHeadingLine = line;
    capturing = true;
    continue;
  }

  if (capturing && versionHeadingLevel !== null && level <= versionHeadingLevel) {
    break;
  }

  if (capturing) {
    result.push(line);
  }
}

const trimmed = result.join("\n").trim();

if (!trimmed || !versionHeadingLine) {
  console.warn(`No changelog entry found for v${normalizedVersion}`);
  process.exit(0);
}

const output = parentHeading && parentHeading !== versionHeadingLine
  ? `${parentHeading}\n\n${versionHeadingLine}\n${trimmed}`
  : `${versionHeadingLine}\n${trimmed}`;

if (outputFile) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(resolve(outputFile), output + "\n", "utf8");
  console.log(`Extracted changelog for v${normalizedVersion} to ${outputFile}`);
} else {
  process.stdout.write(output + "\n");
}
