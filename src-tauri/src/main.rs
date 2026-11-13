#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main DOGE AI window should exist");

            // Open the official DOGE AI service in the desktop shell.
            let app_url = url::Url::parse("https://doge-ai.2122pspblore.workers.dev/")
                .expect("valid DOGE AI URL");
            window.navigate(app_url)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running DOGE AI");
}
