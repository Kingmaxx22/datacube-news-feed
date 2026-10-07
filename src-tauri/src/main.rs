// GUI-only binary: never spawn a console window, in debug or release
#![windows_subsystem = "windows"]

fn main() {
    datacube_news_lib::run()
}
