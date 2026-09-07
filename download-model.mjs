import fs from "fs";
import path from "path";

const targetDir = path.join(process.cwd(), "public", "deepfilternet");
const pkgDir = path.join(targetDir, "v2", "pkg");
const modelsDir = path.join(targetDir, "v2", "models");

// 1. Ensure target folders exist
[pkgDir, modelsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 2. Locate the installed npm package
const nodeModulesPkg = path.join(
  process.cwd(),
  "node_modules",
  "deepfilternet3-noise-filter",
  "dist",
);

console.log("Searching node_modules for assets...");

// Helper to find files recursively if dist path varies
function findFile(dir, fileName) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      const found = findFile(fullPath, fileName);
      if (found) return found;
    } else if (file === fileName) {
      return fullPath;
    }
  }
  return null;
}

const wasmSource = findFile(nodeModulesPkg, "df_bg.wasm");
const modelSource =
  findFile(nodeModulesPkg, "DeepFilterNet3_onnx.tar.gz") ||
  findFile(nodeModulesPkg, "model.tar.gz");

if (wasmSource && modelSource) {
  fs.copyFileSync(wasmSource, path.join(pkgDir, "df_bg.wasm"));
  fs.copyFileSync(
    modelSource,
    path.join(modelsDir, "DeepFilterNet3_onnx.tar.gz"),
  );
  console.log(
    "✓ Successfully copied df_bg.wasm to public/deepfilternet/v2/pkg/",
  );
  console.log(
    "✓ Successfully copied DeepFilterNet3_onnx.tar.gz to public/deepfilternet/v2/models/",
  );
} else {
  console.error(
    "✗ Assets not found in node_modules. Run: npm install deepfilternet3-noise-filter",
  );
}
