#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main DOGE AI window should exist");

            // Keep the desktop shell tied to the official DOGE AI service.
            window.on_navigation(|url| {
                url.scheme() == "https"
                    && url.host_str() == Some("doge-ai.2122pspblore.workers.dev")
            });

            let app_url = url::Url::parse("https://doge-ai.2122pspblore.workers.dev/")
                .expect("valid DOGE AI URL");
            window.navigate(app_url)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running DOGE AI");
}
