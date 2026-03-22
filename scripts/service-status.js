const path = require("path");
const { exec } = require("child_process");
const dotenv = require("dotenv");
const Service = require("node-windows").Service;
const { resolveServiceName } = require("../src/config/service-name");

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
  quiet: true,
});

const serviceName = resolveServiceName(process.env.SERVICE_NAME);

const service = new Service({
  name: serviceName,
  script: path.resolve(__dirname, "..", "src", "service.js"),
});

if (!service.exists) {
  console.log(`[service] 未安装: ${serviceName}`);
  process.exit(0);
}

exec(`sc getkeyname "${serviceName}"`, (getKeyError, getKeyStdout) => {
  if (getKeyError) {
    console.error("[service] 无法解析服务名", getKeyError);
    process.exit(1);
  }

  const match = getKeyStdout.match(/Name\s*[=:]\s*(.+)/i);
  const actualServiceName = match ? match[1].trim() : serviceName;

  exec(`sc query "${actualServiceName}"`, (queryError, queryStdout) => {
    if (queryError) {
      console.error("[service] 查询失败", queryError);
      process.exit(1);
    }

    if (queryStdout.includes("RUNNING")) {
      console.log(`[service] 运行中: ${serviceName}`);
    } else if (queryStdout.includes("STOPPED")) {
      console.log(`[service] 已停止: ${serviceName}`);
    } else {
      console.log(`[service] 状态未知: ${serviceName}`);
    }

    console.log(queryStdout.trim());
  });
});
