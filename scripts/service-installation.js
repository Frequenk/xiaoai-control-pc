const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  BUILD_DIR,
  SERVICE_BUNDLE_FILENAME,
  SERVICE_INSTALL_DIR,
  SERVICE_NAME,
} = require("../src/config/app-constants");

const rootDir = path.resolve(__dirname, "..");
const rootEnvPath = path.join(rootDir, ".env");
const installEnvPath = path.join(SERVICE_INSTALL_DIR, ".env");
const bundledServicePath = path.join(BUILD_DIR, SERVICE_BUNDLE_FILENAME);
const installedServicePath = path.join(
  SERVICE_INSTALL_DIR,
  SERVICE_BUNDLE_FILENAME
);

function ensureEnvFile() {
  if (!fs.existsSync(rootEnvPath)) {
    throw new Error("未找到 .env，请先按 README 完成配置");
  }
}

function buildServiceBundle() {
  execFileSync(process.execPath, [path.join(rootDir, "scripts", "build-service.js")], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function publishRuntimeFiles() {
  ensureEnvFile();

  if (!fs.existsSync(bundledServicePath)) {
    throw new Error("未找到服务打包产物，请先执行 build-service");
  }

  fs.mkdirSync(SERVICE_INSTALL_DIR, { recursive: true });
  fs.copyFileSync(bundledServicePath, installedServicePath);
  fs.copyFileSync(rootEnvPath, installEnvPath);
}

function removeInstallationDir() {
  fs.rmSync(SERVICE_INSTALL_DIR, { recursive: true, force: true });
}

function getInstalledServiceScriptPath() {
  return installedServicePath;
}

module.exports = {
  buildServiceBundle,
  getInstalledServiceScriptPath,
  publishRuntimeFiles,
  removeInstallationDir,
  SERVICE_INSTALL_DIR,
  SERVICE_NAME,
};
