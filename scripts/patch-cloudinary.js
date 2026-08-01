#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const candidates = [
  // pnpm node_modules structure
  path.join(__dirname, "../node_modules/@tsc_tech/medusa-plugin-cloudinary/.medusa/server/src/providers/file-cloudinary/service.js"),
  // npm node_modules structure
  path.join(__dirname, "../node_modules/@tsc_tech/medusa-plugin-cloudinary/src/providers/file-cloudinary/service.js"),
  // .medusa build output (fallback)
  path.join(__dirname, "../.medusa/server/src/providers/file-cloudinary/service.js"),
];

const target = candidates.find((p) => fs.existsSync(p));

if (!target) {
  console.log("[patch-cloudinary] Plugin file not found, skipping.");
  candidates.forEach((p) => console.log("  checked:", p));
  process.exit(0);
}

console.log("[patch-cloudinary] Patching:", target);

let content = fs.readFileSync(target, "utf8");
const original = content;

content = content.replace(/resource_type:\s*"auto"/g, 'resource_type: "image"');
content = content.replace(/Buffer\.from\(file\.content,\s*"binary"\)/g, 'Buffer.from(file.content, "base64")');

if (content !== original) {
  fs.writeFileSync(target, content, "utf8");
  console.log("[patch-cloudinary] Patched resource_type: auto -> image, binary -> base64");
} else {
  console.log("[patch-cloudinary] Already patched or no changes needed.");
}
