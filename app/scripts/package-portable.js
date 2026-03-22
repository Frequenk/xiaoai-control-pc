const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..");
const releaseDir = path.join(rootDir, "app", "src-tauri", "target", "release");
const portableRootDir = path.join(rootDir, "build", "portable");
const appDir = path.join(portableRootDir, "XiaoAi Control PC");
const resourcesDir = path.join(appDir, "resources");
const outputZipPath = path.join(
  portableRootDir,
  "xiaoai-control-pc-portable.zip"
);

function cleanPortableDir() {
  fs.rmSync(portableRootDir, { recursive: true, force: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
}

function copyFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirectory(sourceDir, targetDir) {
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
  });
}

function buildPortableZip() {
  cleanPortableDir();

  copyFile(
    path.join(releaseDir, "xiaoai-control-pc-ui.exe"),
    path.join(appDir, "XiaoAi Control PC.exe")
  );
  copyDirectory(path.join(releaseDir, "resources"), resourcesDir);

  if (fs.existsSync(outputZipPath)) {
    fs.rmSync(outputZipPath, { force: true });
  }

  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Compress-Archive -Path '${appDir}\\*' -DestinationPath '${outputZipPath}' -Force`,
    ],
    {
      cwd: rootDir,
      stdio: "inherit",
    }
  );

  console.log(`[portable] 绿色版压缩包已生成: ${outputZipPath}`);
}

buildPortableZip();
