const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const Service = require("node-windows").Service;
const { resolveServiceName } = require("../src/config/service-name");

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
  quiet: true,
});

const serviceName = resolveServiceName(process.env.SERVICE_NAME);
const daemonDir = path.resolve(__dirname, "..", "src", "daemon");

const service = new Service({
  name: serviceName,
  script: path.resolve(__dirname, "..", "src", "service.js"),
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupDaemonDir(retries = 5, delayMs = 1000) {
  if (!fs.existsSync(daemonDir)) {
    return true;
  }

  for (let index = 0; index < retries; index += 1) {
    try {
      const files = fs.readdirSync(daemonDir);

      for (const file of files) {
        fs.rmSync(path.join(daemonDir, file), { force: true });
      }

      if (fs.existsSync(daemonDir) && fs.readdirSync(daemonDir).length === 0) {
        fs.rmdirSync(daemonDir);
      }

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
  const isDaemonCleanupError =
    error &&
    error.code === "EPERM" &&
    typeof error.path === "string" &&
    error.path.startsWith(daemonDir);

  if (!isDaemonCleanupError) {
    throw error;
  }

  console.warn("[service] 服务已卸载，但 daemon 文件正在被系统占用，正在重试清理...");

  try {
    const cleaned = await cleanupDaemonDir();

    if (cleaned) {
      console.log("[service] daemon 目录清理完成");
    } else {
      console.warn("[service] daemon 目录暂未清理完成，可稍后重试卸载或手动删除 src/daemon");
    }

    process.exit(0);
  } catch (cleanupError) {
    console.warn("[service] daemon 清理失败，可稍后手动删除 src/daemon");
    console.warn(cleanupError);
    process.exit(0);
  }
});

service.on("uninstall", () => {
  console.log(`[service] 卸载成功: ${serviceName}`);
});

service.on("alreadyuninstalled", async () => {
  console.log(`[service] 未安装或已卸载: ${serviceName}`);

  const cleaned = await cleanupDaemonDir();
  if (cleaned) {
    console.log("[service] daemon 目录清理完成");
  }
});

service.on("error", (error) => {
  console.error("[service] 卸载异常", error);
});

console.log(`[service] 正在卸载: ${serviceName}`);
service.uninstall();
