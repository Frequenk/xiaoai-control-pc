const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..");
const buildDir = path.join(rootDir, "build");
const tauriResourcesDir = path.join(rootDir, "app", "src-tauri", "resources");
const nodeBinaryPath = process.execPath;
const winswDir = path.join(rootDir, "node_modules", "node-windows", "bin", "winsw");

function copyFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function buildServiceBundle() {
  execFileSync(
    process.execPath,
    [path.join(rootDir, "service", "scripts", "build-service.js")],
    {
      cwd: rootDir,
      stdio: "inherit",
    }
  );
}

function prepareResources() {
  buildServiceBundle();

  fs.rmSync(tauriResourcesDir, { recursive: true, force: true });
  fs.mkdirSync(tauriResourcesDir, { recursive: true });

  copyFile(path.join(buildDir, "service.js"), path.join(tauriResourcesDir, "service.js"));
  copyFile(path.join(buildDir, "LICENSES.txt"), path.join(tauriResourcesDir, "LICENSES.txt"));
  copyFile(nodeBinaryPath, path.join(tauriResourcesDir, "node.exe"));
  copyFile(path.join(winswDir, "winsw.exe"), path.join(tauriResourcesDir, "winsw.exe"));
  copyFile(
    path.join(winswDir, "winsw.exe.config"),
    path.join(tauriResourcesDir, "winsw.exe.config")
  );

  console.log(`[tauri] 资源准备完成: ${tauriResourcesDir}`);
}

prepareResources();
