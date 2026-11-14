#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD, Engine as _};
use enigo::{Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use image::{DynamicImage, ImageFormat};
use std::io::Cursor;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(serde::Serialize)]
struct ScreenCapture { data_url: String, width: u32, height: u32 }

#[tauri::command]
fn capture_screen() -> Result<ScreenCapture, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Could not list displays: {e}"))?;
    let monitor = monitors.iter().find(|m| m.is_primary()).or_else(|| monitors.first())
        .ok_or_else(|| "No display was found.".to_string())?;
    let image = monitor.capture_image().map_err(|e| format!("Screen capture failed: {e}"))?;
    let (width, height) = (image.width(), image.height());
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image).write_to(&mut bytes, ImageFormat::Png)
        .map_err(|e| format!("Could not encode screenshot: {e}"))?;
    Ok(ScreenCapture { data_url: format!("data:image/png;base64,{}", STANDARD.encode(bytes.into_inner())), width, height })
}

#[derive(serde::Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum DesktopAction { Click { x: i32, y: i32 }, TypeText { text: String }, PressKey { key: String } }

#[tauri::command]
fn execute_desktop_action(action: DesktopAction, screen_width: i32, screen_height: i32) -> Result<(), String> {
    if screen_width <= 0 || screen_height <= 0 || screen_width > 20000 || screen_height > 20000 {
        return Err("Invalid screen dimensions.".into());
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Could not initialize input: {e}"))?;
    match action {
        DesktopAction::Click { x, y } => {
            if x < 0 || y < 0 || x >= screen_width || y >= screen_height { return Err("Click coordinates are outside the captured screen.".into()); }
            enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| e.to_string())?;
            enigo.button(Button::Left, Direction::Click).map_err(|e| e.to_string())?;
        }
        DesktopAction::TypeText { text } => {
            if text.len() > 2000 { return Err("Text action is limited to 2,000 characters.".into()); }
            enigo.text(&text).map_err(|e| e.to_string())?;
        }
        DesktopAction::PressKey { key } => {
            let key = match key.as_str() {
                "ENTER" => Key::Return, "TAB" => Key::Tab, "ESC" => Key::Escape,
                "BACKSPACE" => Key::Backspace, "DELETE" => Key::Delete,
                "UP" => Key::UpArrow, "DOWN" => Key::DownArrow, "LEFT" => Key::LeftArrow,
                "RIGHT" => Key::RightArrow, "CTRL" => Key::Control, "ALT" => Key::Alt,
                "SHIFT" => Key::Shift, _ => return Err("Unsupported key.".into())
            };
            enigo.key(key, Direction::Click).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![capture_screen, execute_desktop_action])
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main DOGE AI window should exist");
            let app_url = url::Url::parse("https://doge-ai.2122pspblore.workers.dev/").expect("valid DOGE AI URL");
            window.navigate(app_url)?;
            WebviewWindowBuilder::new(app, "vision", WebviewUrl::App("vision.html".into()))
                .title("DOGE VISION + HANDS")
                .inner_size(540.0, 820.0)
                .min_inner_size(440.0, 620.0)
                .center()
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running DOGE AI");
}
