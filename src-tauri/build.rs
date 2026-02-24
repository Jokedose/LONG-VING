fn main() {
    // Link macOS frameworks required for Vision OCR
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-lib=framework=Vision");
        println!("cargo:rustc-link-lib=framework=CoreImage");
        println!("cargo:rustc-link-lib=framework=CoreVideo");
    }

    tauri_build::build()
}
