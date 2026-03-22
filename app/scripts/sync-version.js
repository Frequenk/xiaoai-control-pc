const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const packageJsonPath = path.join(rootDir, "package.json");
const cargoTomlPath = path.join(rootDir, "app", "src-tauri", "Cargo.toml");
const tauriConfigPath = path.join(rootDir, "app", "src-tauri", "tauri.conf.json");

function normalizeVersion(input) {
  return String(input || "")
    .trim()
    .replace(/^v/i, "");
}

function resolveVersion() {
  const cliVersion = process.argv[2];
  const envVersion = process.env.APP_VERSION;

  const version = normalizeVersion(cliVersion || envVersion);
  if (version) {
    return version;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  return normalizeVersion(packageJson.version);
}

function assertVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`版本号格式不正确: ${version}`);
  }
}

function updatePackageJson(version) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.version = version;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function updateCargoToml(version) {
  const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
  const nextCargoToml = cargoToml.replace(
    /^version = ".*"$/m,
    `version = "${version}"`
  );
  fs.writeFileSync(cargoTomlPath, nextCargoToml);
}

function updateTauriConfig(version) {
  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
  tauriConfig.version = version;
  fs.writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);
}

function main() {
  const version = resolveVersion();
  assertVersion(version);
  updatePackageJson(version);
  updateCargoToml(version);
  updateTauriConfig(version);
  console.log(`[version] 已同步版本号: ${version}`);
}

main();
