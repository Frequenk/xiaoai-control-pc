const path = require("path");
const Service = require("node-windows").Service;
const {
  getInstalledServiceScriptPath,
  removeInstallationDir,
  SERVICE_INSTALL_DIR,
  SERVICE_NAME,
} = require("./service-installation");

const daemonDir = path.join(SERVICE_INSTALL_DIR, "daemon");

const service = new Service({
  name: SERVICE_NAME,
  script: getInstalledServiceScriptPath(),
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupInstallationDir(retries = 5, delayMs = 1000) {
  for (let index = 0; index < retries; index += 1) {
    try {
      removeInstallationDir();
      return true;
    } catch (error) {
      if (error.code !== "EPERM") {
        throw error;
      }

      await sleep(delayMs);
    }
  }

  return false;
}

process.on("uncaughtException", async (error) => {
  const isCleanupError =
    error &&
    error.code === "EPERM" &&
    typeof error.path === "string" &&
    error.path.startsWith(daemonDir);

  if (!isCleanupError) {
    throw error;
  }

  console.warn("[service] 服务已卸载，但安装目录文件正在被系统占用，正在重试清理...");

  try {
    const cleaned = await cleanupInstallationDir();

    if (cleaned) {
      console.log("[service] 安装目录清理完成");
    } else {
      console.warn(`[service] 安装目录暂未清理完成，可稍后手动删除 ${SERVICE_INSTALL_DIR}`);
    }

    process.exit(0);
  } catch (cleanupError) {
    console.warn(`[service] 安装目录清理失败，可稍后手动删除 ${SERVICE_INSTALL_DIR}`);
    console.warn(cleanupError);
    process.exit(0);
  }
});

service.on("uninstall", () => {
  console.log(`[service] 卸载成功: ${SERVICE_NAME}`);
});

service.on("alreadyuninstalled", async () => {
  console.log(`[service] 未安装或已卸载: ${SERVICE_NAME}`);

  const cleaned = await cleanupInstallationDir();
  if (cleaned) {
    console.log("[service] 安装目录清理完成");
  }
});

service.on("error", (error) => {
  console.error("[service] 卸载异常", error);
});

console.log(`[service] 正在卸载: ${SERVICE_NAME}`);
service.uninstall();
