import fs from "fs";
import path from "path";

const targetDir = path.join(process.cwd(), "public", "deepfilternet");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Verified direct asset URLs from official DeepFilterNet repositories
const files = [
  {
    name: "df_bg.wasm",
    url: "https://huggingface.co/Rikorose/DeepFilterNet3/resolve/main/df_bg.wasm",
  },
  {
    name: "DeepFilterNet3_onnx.tar.gz",
    url: "https://huggingface.co/Rikorose/DeepFilterNet3/resolve/main/DeepFilterNet3_onnx.tar.gz",
  },
];

async function downloadFiles() {
  for (const file of files) {
    const filePath = path.join(targetDir, file.name);
    console.log(`Downloading ${file.name}...`);

    try {
      const response = await fetch(file.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(buffer));
      console.log(`✓ Saved ${file.name} to public/deepfilternet/`);
    } catch (err) {
      console.error(`✗ Failed to download ${file.name}:`, err.message);
    }
  }
}

downloadFiles();
