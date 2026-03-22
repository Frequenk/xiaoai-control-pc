const { exec } = require("child_process");

function runCommand(command, label) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[action:${label}] 执行失败`, error);
        reject(error);
        return;
      }

      if (stdout.trim()) {
        console.log(`[action:${label}] stdout:`, stdout.trim());
      }

      if (stderr.trim()) {
        console.log(`[action:${label}] stderr:`, stderr.trim());
      }

      resolve({ stdout, stderr });
    });
  });
}

function executeAction(actionConfig) {
  if (!actionConfig || !actionConfig.command) {
    throw new Error("动作配置无效，缺少 command");
  }

  return runCommand(
    actionConfig.command,
    actionConfig.label || actionConfig.description || "customAction"
  );
}

module.exports = {
  executeAction,
  runCommand,
};
