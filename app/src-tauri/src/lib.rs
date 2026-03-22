use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR, DWMWA_USE_IMMERSIVE_DARK_MODE,
};

const SERVICE_NAME: &str = "XiaoAi Control PC";
const SERVICE_ID: &str = "xiaoaicontrolpc";
const SERVICE_DESCRIPTION: &str = "通过小爱同学、米家和巴法云 MQTT 控制电脑的本地服务";
const REPO_URL: &str = "https://github.com/Frequenk/xiaoai-control-pc";
const RELEASES_URL: &str = "https://github.com/Frequenk/xiaoai-control-pc/releases";
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppConfigInput {
    bemfa_uid: String,
    bemfa_topic: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppConfigOutput {
    bemfa_uid: String,
    bemfa_topic: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ServiceStatusOutput {
    service_name: String,
    install_dir: String,
    label: String,
    raw_output: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppMetaOutput {
    version: String,
    repo_url: String,
    releases_url: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AdminJobInput {
    action: String,
    config: Option<AppConfigInput>,
    output_path: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AdminJobOutput {
    ok: bool,
    message: String,
}

fn install_dir() -> PathBuf {
    PathBuf::from(env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string()))
        .join("XiaoAiControlPC")
}

fn config_path() -> PathBuf {
    install_dir().join(".env")
}

fn wrapper_exe_path() -> PathBuf {
    install_dir().join(format!("{SERVICE_ID}.exe"))
}

fn wrapper_config_path() -> PathBuf {
    install_dir().join(format!("{SERVICE_ID}.exe.config"))
}

fn wrapper_xml_path() -> PathBuf {
    install_dir().join(format!("{SERVICE_ID}.xml"))
}

fn service_script_path() -> PathBuf {
    install_dir().join("service.js")
}

fn node_path() -> PathBuf {
    install_dir().join("node.exe")
}

fn parse_env_value(source: &str, key: &str) -> String {
    source
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with(&format!("{key}=")) {
                Some(
                    trimmed
                        .split_once('=')
                        .map(|(_, value)| value)
                        .unwrap_or("")
                        .trim()
                        .to_string(),
                )
            } else {
                None
            }
        })
        .unwrap_or_default()
}

fn load_config_from_disk() -> AppConfigOutput {
    let contents = fs::read_to_string(config_path()).unwrap_or_default();

    AppConfigOutput {
        bemfa_uid: parse_env_value(&contents, "BEMFA_UID"),
        bemfa_topic: parse_env_value(&contents, "BEMFA_TOPIC"),
    }
}

fn write_config_to_disk(config: &AppConfigInput) -> Result<(), String> {
    if config.bemfa_uid.trim().is_empty() {
        return Err("BEMFA_UID 不能为空".to_string());
    }

    if config.bemfa_topic.trim().is_empty() {
        return Err("BEMFA_TOPIC 不能为空".to_string());
    }

    fs::create_dir_all(install_dir()).map_err(|error| error.to_string())?;

    let contents = format!(
        "# 巴法云用户私钥（MQTT 客户端 ID）\r\nBEMFA_UID={}\r\n\r\n# 主题名\r\nBEMFA_TOPIC={}\r\n",
        config.bemfa_uid.trim(),
        config.bemfa_topic.trim()
    );

    fs::write(config_path(), contents).map_err(|error| error.to_string())?;
    Ok(())
}

fn candidate_resource_dirs(app: Option<&AppHandle>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(app) = app {
        if let Ok(resource_dir) = app.path().resource_dir() {
            dirs.push(resource_dir.clone());
            dirs.push(resource_dir.join("resources"));
        }
    }

    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            dirs.push(exe_dir.to_path_buf());
            dirs.push(exe_dir.join("resources"));
        }
    }

    dirs
}

fn resource_path(app: Option<&AppHandle>, file_name: &str) -> Result<PathBuf, String> {
    let candidates: Vec<PathBuf> = candidate_resource_dirs(app)
        .into_iter()
        .map(|dir| dir.join(file_name))
        .collect();

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!("未找到资源文件: {file_name}"))
}

fn copy_resource(
    app: Option<&AppHandle>,
    source_name: &str,
    target_path: &Path,
) -> Result<(), String> {
    let source_path = resource_path(app, source_name)?;
    fs::copy(source_path, target_path).map_err(|error| error.to_string())?;
    Ok(())
}

fn write_service_xml() -> Result<(), String> {
    let daemon_dir = install_dir().join("daemon");
    fs::create_dir_all(&daemon_dir).map_err(|error| error.to_string())?;

    let xml = format!(
        "<service>\r\n  <id>{}</id>\r\n  <name>{}</name>\r\n  <description>{}</description>\r\n  <executable>{}</executable>\r\n  <argument>{}</argument>\r\n  <logmode>rotate</logmode>\r\n  <logpath>{}</logpath>\r\n  <workingdirectory>{}</workingdirectory>\r\n</service>\r\n",
        SERVICE_ID,
        SERVICE_NAME,
        SERVICE_DESCRIPTION,
        node_path().display(),
        service_script_path().display(),
        daemon_dir.display(),
        install_dir().display()
    );

    fs::write(wrapper_xml_path(), xml).map_err(|error| error.to_string())?;
    Ok(())
}

fn prepare_runtime_files(app: Option<&AppHandle>) -> Result<(), String> {
    fs::create_dir_all(install_dir()).map_err(|error| error.to_string())?;

    copy_resource(app, "service.js", &service_script_path())?;
    copy_resource(app, "node.exe", &node_path())?;
    copy_resource(app, "winsw.exe", &wrapper_exe_path())?;
    copy_resource(app, "winsw.exe.config", &wrapper_config_path())?;
    write_service_xml()?;

    Ok(())
}

fn run_command(executable: &Path, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new(executable);
    command.args(args);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command.output().map_err(|error| error.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        let message = if stderr.is_empty() {
            stdout.clone()
        } else {
            format!("{stdout}\n{stderr}")
        };
        return Err(message.trim().to_string());
    }

    Ok(if stderr.is_empty() {
        stdout
    } else if stdout.is_empty() {
        stderr
    } else {
        format!("{stdout}\n{stderr}")
    })
}

fn get_service_key_name() -> Option<String> {
    let mut command = Command::new("sc");
    command.args(["getkeyname", SERVICE_NAME]);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command.output().ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .find_map(|line| line.split_once('='))
        .map(|(_, value)| value.trim().to_string())
}

fn query_service_status() -> ServiceStatusOutput {
    let install_dir_string = install_dir().display().to_string();

    let Some(service_key_name) = get_service_key_name() else {
        return ServiceStatusOutput {
            service_name: SERVICE_NAME.to_string(),
            install_dir: install_dir_string,
            label: "未安装".to_string(),
            raw_output: "服务未安装".to_string(),
        };
    };

    let mut command = Command::new("sc");
    command.args(["query", &service_key_name]);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    match command.output() {
        Ok(output) => {
            let raw_output = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let label = if raw_output.contains("RUNNING") {
                "运行中"
            } else if raw_output.contains("STOPPED") {
                "已停止"
            } else {
                "状态未知"
            };

            ServiceStatusOutput {
                service_name: SERVICE_NAME.to_string(),
                install_dir: install_dir_string,
                label: label.to_string(),
                raw_output,
            }
        }
        Err(error) => ServiceStatusOutput {
            service_name: SERVICE_NAME.to_string(),
            install_dir: install_dir_string,
            label: "查询失败".to_string(),
            raw_output: error.to_string(),
        },
    }
}

fn open_url(url: &str) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("只允许打开 http 或 https 链接".to_string());
    }

    let mut command = Command::new("cmd");
    command.args(["/C", "start", "", url]);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    command.spawn().map_err(|error| error.to_string())?;

    Ok(())
}

fn is_admin() -> Result<bool, String> {
    let mut command = Command::new("powershell");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)",
    ]);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command.output().map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err("无法确认当前是否为管理员权限".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().eq_ignore_ascii_case("true"))
}

fn ensure_admin() -> Result<(), String> {
    if is_admin()? {
        Ok(())
    } else {
        Err("安装或卸载 Windows 服务需要管理员权限".to_string())
    }
}

#[cfg(target_os = "windows")]
fn apply_window_frame_style(window: &tauri::WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else {
        return;
    };

    let dark_mode: u32 = 0;
    let caption_color: u32 = 0x00F7F4EE;
    let text_color: u32 = 0x001E2421;

    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            &dark_mode as *const _ as _,
            std::mem::size_of_val(&dark_mode) as u32,
        );
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_CAPTION_COLOR,
            &caption_color as *const _ as _,
            std::mem::size_of_val(&caption_color) as u32,
        );
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_TEXT_COLOR,
            &text_color as *const _ as _,
            std::mem::size_of_val(&text_color) as u32,
        );
    }
}

fn escape_powershell_single_quoted(value: &str) -> String {
    value.replace('\'', "''")
}

fn run_service_installation(app: Option<&AppHandle>, config: &AppConfigInput) -> Result<String, String> {
    write_config_to_disk(config)?;

    if wrapper_exe_path().exists() {
        let _ = run_command(&wrapper_exe_path(), &["stop"]);
        thread::sleep(Duration::from_secs(1));
    }

    prepare_runtime_files(app)?;

    let mut logs = vec!["运行文件已写入安装目录".to_string()];

    if get_service_key_name().is_none() {
        let install_output = run_command(&wrapper_exe_path(), &["install"])?;
        if !install_output.is_empty() {
            logs.push(install_output);
        }
    }

    let start_output = run_command(&wrapper_exe_path(), &["start"])?;
    if !start_output.is_empty() {
        logs.push(start_output);
    }

    Ok(logs.join("\n"))
}

fn run_service_uninstall() -> Result<String, String> {
    if get_service_key_name().is_none() {
        if install_dir().exists() {
            fs::remove_dir_all(install_dir()).map_err(|error| error.to_string())?;
            return Ok("服务未安装，安装目录已清理".to_string());
        }

        return Ok("服务未安装".to_string());
    }

    if wrapper_exe_path().exists() {
        let _ = run_command(&wrapper_exe_path(), &["stop"]);
        thread::sleep(Duration::from_secs(1));
        let _ = run_command(&wrapper_exe_path(), &["uninstall"]);
    }

    thread::sleep(Duration::from_secs(2));

    if install_dir().exists() {
        fs::remove_dir_all(install_dir()).map_err(|error| error.to_string())?;
    }

    Ok("服务已卸载".to_string())
}

fn write_admin_job_output(path: &Path, ok: bool, message: String) -> Result<(), String> {
    let payload = AdminJobOutput { ok, message };
    let contents = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn maybe_handle_admin_job() -> bool {
    let mut args = env::args().skip(1);

    while let Some(arg) = args.next() {
        if arg == "--service-admin-job" {
            let Some(job_path) = args.next() else {
                std::process::exit(1);
            };

            let exit_code = match fs::read_to_string(&job_path) {
                Ok(contents) => match serde_json::from_str::<AdminJobInput>(&contents) {
                    Ok(job) => {
                        let output_path = PathBuf::from(&job.output_path);
                        let result = match ensure_admin() {
                            Ok(()) => match job.action.as_str() {
                                "install" => match job.config {
                                    Some(config) => run_service_installation(None, &config),
                                    None => Err("缺少安装配置".to_string()),
                                },
                                "uninstall" => run_service_uninstall(),
                                _ => Err("未知的管理员操作".to_string()),
                            },
                            Err(error) => Err(error),
                        };

                        match result {
                            Ok(message) => {
                                let _ = write_admin_job_output(&output_path, true, message);
                                0
                            }
                            Err(error) => {
                                let _ = write_admin_job_output(&output_path, false, error);
                                1
                            }
                        }
                    }
                    Err(error) => {
                        let _ = write_admin_job_output(
                            Path::new(&job_path),
                            false,
                            error.to_string(),
                        );
                        1
                    }
                },
                Err(_) => 1,
            };

            std::process::exit(exit_code);
        }
    }

    false
}

fn run_elevated_admin_job(action: &str, config: Option<AppConfigInput>) -> Result<String, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let temp_dir = env::temp_dir().join("xiaoai-control-pc-admin");
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;

    let job_path = temp_dir.join(format!("job-{}-{}.json", std::process::id(), timestamp));
    let output_path = temp_dir.join(format!("result-{}-{}.json", std::process::id(), timestamp));
    let exe_path = env::current_exe().map_err(|error| error.to_string())?;

    let job = AdminJobInput {
        action: action.to_string(),
        config,
        output_path: output_path.display().to_string(),
    };
    let job_contents = serde_json::to_string(&job).map_err(|error| error.to_string())?;
    fs::write(&job_path, job_contents).map_err(|error| error.to_string())?;

    let command = format!(
        "$exe = '{}'; $job = '{}'; try {{ $p = Start-Process -FilePath $exe -ArgumentList @('--service-admin-job', $job) -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode }} catch {{ Write-Error $_.Exception.Message; exit 1223 }}",
        escape_powershell_single_quoted(&exe_path.display().to_string()),
        escape_powershell_single_quoted(&job_path.display().to_string()),
    );

    let mut process = Command::new("powershell");
    process.args(["-NoProfile", "-NonInteractive", "-Command", &command]);

    #[cfg(target_os = "windows")]
    process.creation_flags(CREATE_NO_WINDOW);

    let output = process.output().map_err(|error| error.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let message = format!("{stdout}\n{stderr}");

        let _ = fs::remove_file(&job_path);
        let _ = fs::remove_file(&output_path);

        if output.status.code() == Some(1223)
            || message.contains("canceled by the user")
            || message.contains("已取消")
            || message.contains("拒绝")
        {
            return Err("已取消管理员授权".to_string());
        }

        return Err("提权执行失败".to_string());
    }

    let result_contents = fs::read_to_string(&output_path).map_err(|error| error.to_string())?;
    let result: AdminJobOutput =
        serde_json::from_str(&result_contents).map_err(|error| error.to_string())?;

    let _ = fs::remove_file(&job_path);
    let _ = fs::remove_file(&output_path);

    if result.ok {
        Ok(result.message)
    } else {
        Err(result.message)
    }
}

#[tauri::command]
fn get_app_meta() -> AppMetaOutput {
    AppMetaOutput {
        version: env!("CARGO_PKG_VERSION").to_string(),
        repo_url: REPO_URL.to_string(),
        releases_url: RELEASES_URL.to_string(),
    }
}

#[tauri::command]
fn load_config() -> AppConfigOutput {
    load_config_from_disk()
}

#[tauri::command]
fn get_service_status() -> ServiceStatusOutput {
    query_service_status()
}

#[tauri::command]
fn install_or_update_service(app: AppHandle, config: AppConfigInput) -> Result<String, String> {
    if is_admin()? {
        run_service_installation(Some(&app), &config)
    } else {
        run_elevated_admin_job("install", Some(config))
    }
}

#[tauri::command]
fn uninstall_service() -> Result<String, String> {
    if is_admin()? {
        run_service_uninstall()
    } else {
        run_elevated_admin_job("uninstall", None)
    }
}

#[tauri::command]
fn open_external(url: String) -> Result<String, String> {
    open_url(&url)?;
    Ok("已打开链接".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if maybe_handle_admin_job() {
        return;
    }

    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                apply_window_frame_style(&window);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_meta,
            load_config,
            get_service_status,
            install_or_update_service,
            uninstall_service,
            open_external
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
