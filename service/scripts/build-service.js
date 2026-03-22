const fs = require("fs");
const path = require("path");
const ncc = require("@vercel/ncc");
const {
  BUILD_DIR,
  SERVICE_BUNDLE_FILENAME,
} = require("../src/config/app-constants");

async function build() {
  const entryFile = path.resolve(__dirname, "..", "src", "service.js");

  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  const { code, assets } = await ncc(entryFile, {
    minify: true,
    license: "LICENSES.txt",
  });

  fs.writeFileSync(path.join(BUILD_DIR, SERVICE_BUNDLE_FILENAME), code);

  for (const [assetName, asset] of Object.entries(assets)) {
    if (path.basename(assetName).toLowerCase() === ".env") {
      continue;
    }

    const assetPath = path.isAbsolute(assetName)
      ? assetName
      : path.join(BUILD_DIR, assetName);
    fs.mkdirSync(path.dirname(assetPath), { recursive: true });
    fs.writeFileSync(assetPath, asset.source);
  }

  fs.rmSync(path.join(BUILD_DIR, ".env"), { force: true });

  console.log(
    `[build] 服务打包完成: ${path.join(BUILD_DIR, SERVICE_BUNDLE_FILENAME)}`
  );
}

build().catch((error) => {
  console.error("[build] 服务打包失败", error);
  process.exit(1);
});
