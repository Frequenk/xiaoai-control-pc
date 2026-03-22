const { exec } = require("child_process");
const Service = require("node-windows").Service;
const {
  getInstalledServiceScriptPath,
  SERVICE_NAME,
} = require("./service-installation");

const service = new Service({
  name: SERVICE_NAME,
  script: getInstalledServiceScriptPath(),
});

if (!service.exists) {
  console.log(`[service] 未安装: ${SERVICE_NAME}`);
  process.exit(0);
}

exec(`sc getkeyname "${SERVICE_NAME}"`, (getKeyError, getKeyStdout) => {
  if (getKeyError) {
    console.error("[service] 无法解析服务名", getKeyError);
    process.exit(1);
  }

  const match = getKeyStdout.match(/Name\s*[=:]\s*(.+)/i);
  const actualServiceName = match ? match[1].trim() : SERVICE_NAME;

  exec(`sc query "${actualServiceName}"`, (queryError, queryStdout) => {
    if (queryError) {
      console.error("[service] 查询失败", queryError);
      process.exit(1);
    }

    if (queryStdout.includes("RUNNING")) {
      console.log(`[service] 运行中: ${SERVICE_NAME}`);
    } else if (queryStdout.includes("STOPPED")) {
      console.log(`[service] 已停止: ${SERVICE_NAME}`);
    } else {
      console.log(`[service] 状态未知: ${SERVICE_NAME}`);
    }

    console.log(queryStdout.trim());
  });
});
