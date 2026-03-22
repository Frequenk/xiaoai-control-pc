const actionMap = {};

actionMap.off = {
  description: "关机",
  command: "shutdown /s /t 0",
};

actionMap.on = {
  description: "重启",
  command: "shutdown /r /t 0",
};

actionMap.pause = {
  description: "注销当前用户",
  command: "shutdown /l",
};

// 当前项目采用 Windows 服务形式运行。
// 这种形式的能力边界是：可以执行系统级或后台命令，
// 例如关机、重启、注销、定时关机、取消关机、启动或停止服务、杀进程、执行计划任务。
// 不能执行依赖当前桌面会话的命令，例如锁屏、打开软件、模拟键鼠。
//
// 自定义操作直接参考下面的示例添加即可。
// 更多设备操作 key 的规则可以查看文档：
// https://cloud.bemfa.com/docs/src/speaker_mi.html?utm_source=chatgpt.com
//
// actionMap["on#10"] = {
//   description: "60 秒后关机",
//   command: "shutdown /s /t 60",
// };
//
// actionMap["on#20"] = {
//   description: "取消关机",
//   command: "shutdown /a",
// };
//
// actionMap["on#30"] = {
//   description: "强制关机",
//   command: "shutdown /p",
// };
//
// actionMap["on#40"] = {
//   description: "停止时间服务",
//   command: "sc stop w32time",
// };
//
// actionMap["on#50"] = {
//   description: "启动时间服务",
//   command: "sc start w32time",
// };
//
// actionMap["on#60"] = {
//   description: "刷新 DNS",
//   command: "ipconfig /flushdns",
// };
//
// actionMap["on#70"] = {
//   description: "强制结束指定进程",
//   command: "taskkill /im notepad.exe /f",
// };
//
// actionMap["on#80"] = {
//   description: "执行计划任务",
//   command: 'schtasks /run /tn "TaskName"',
// };

module.exports = actionMap;
