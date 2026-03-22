const path = require("path");

const SERVICE_NAME = "XiaoAi Control PC";
const SERVICE_INSTALL_DIR = path.join(
  process.env.ProgramData || "C:\\ProgramData",
  "XiaoAiControlPC"
);
const BUILD_DIR = path.resolve(__dirname, "..", "..", "..", "build");
const SERVICE_BUNDLE_FILENAME = "service.js";

module.exports = {
  BUILD_DIR,
  SERVICE_BUNDLE_FILENAME,
  SERVICE_INSTALL_DIR,
  SERVICE_NAME,
};
