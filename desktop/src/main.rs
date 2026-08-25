//! Kleene as a native window.
//!
//! Deliberately almost empty. The whole application — the engine, the editor, the conversions —
//! is the same `web/dist` the browser gets, and this crate's job is to put a window around it
//! and connect the two things a browser cannot do: opening a file the operating system handed
//! us, and saving one without a download folder.
//!
//! ## What this is not
//!
//! It is not a second front end. Roadmap §2.5 is explicit that the desktop build reuses the
//! exact same `dist/`, and every line of behaviour that lives here rather than in the web app
//! is a line that has to be written twice and will eventually differ. The file dialogs below
//! are the exception the rule is worth making: they are OS integration, not product.
//!
//! ## Opening a file by double-clicking it
//!
//! Three platforms, three mechanisms, and none of them is a command-line argument alone:
//!
//! - **macOS** sends an `Opened` event, possibly *before* the webview exists.
//! - **Windows and Linux** pass paths in `argv`, and a second double-click starts a second
//!   process rather than reaching this one.
//!
//! So a path is stashed the moment it arrives and handed over when the page asks for it, which
//! is the only ordering that works on all three. A page that asked at load time would get
//! nothing on macOS; a shell that pushed at launch would push into a webview that does not
//! exist yet.

// The attribute Tauri's own template carries: without it a release build on Windows opens a
// console window behind the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use serde::Serialize;
use tauri::{Manager, State};

/// A file the operating system asked us to open, waiting for the page to collect it.
#[derive(Default)]
struct Pending(Mutex<Option<PendingFile>>);

#[derive(Clone, Serialize)]
struct PendingFile {
    /// What to call it in the title bar and in "save".
    name: String,
    /// The file's text. Read here rather than in the webview, because the webview has no
    /// filesystem access and the path may be anywhere on disk.
    text: String,
}

/// The extensions this app claims. Kept in step with `fileAssociations` in `tauri.conf.json`.
const OPENABLE: [&str; 2] = ["kln", "jff"];

fn readable(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| OPENABLE.contains(&extension.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// Read a path into the shape the page wants, or nothing if it cannot be read.
///
/// Failure is deliberately quiet: a file that will not read is reported by the page as an
/// import error alongside every other kind, rather than by a native dialog the web app knows
/// nothing about and cannot style.
fn stash(state: &Pending, path: &std::path::Path) {
    if !readable(path) {
        return;
    }
    let Ok(text) = std::fs::read_to_string(path) else {
        return;
    };
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("untitled")
        .to_string();

    if let Ok(mut pending) = state.0.lock() {
        *pending = Some(PendingFile { name, text });
    }
}

/// Hand over the file the OS opened us with, if there was one.
///
/// Taken rather than read: collecting it twice would reopen the same document over whatever
/// the person has done since, which is the reload-loses-my-work failure in slow motion.
#[tauri::command]
fn take_opened_file(state: State<'_, Pending>) -> Option<PendingFile> {
    state.0.lock().ok().and_then(|mut pending| pending.take())
}

/// Whether the page is running inside this shell.
///
/// The web app asks so it can prefer native dialogs over the browser's download-and-hope path.
/// A capability question rather than a platform one — `window.__TAURI__` exists, but reading a
/// global that a bundler might rename is a worse contract than a command.
#[tauri::command]
fn is_desktop() -> bool {
    true
}

fn main() {
    tauri::Builder::default()
        .manage(Pending::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![take_opened_file, is_desktop])
        .setup(|app| {
            // Windows and Linux: the path arrives in `argv`. Skipped on macOS, which uses the
            // event below and would otherwise see its own process-serial-number argument.
            #[cfg(not(target_os = "macos"))]
            {
                let state = app.state::<Pending>();
                for argument in std::env::args().skip(1) {
                    stash(&state, std::path::Path::new(&argument));
                }
            }
            let _ = app;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("the application failed to start")
        .run(|app, event| {
            // macOS: a double-clicked file arrives as an event, and can arrive before the
            // window is ready — which is exactly why it is stashed rather than delivered.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &event {
                let state = app.state::<Pending>();
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        stash(&state, &path);
                    }
                }
            }
            let _ = (app, event);
        });
}
