#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "../.medusa/server/src/providers/file-cloudinary/service.js"
);

if (!fs.existsSync(target)) {
  console.log("[patch-cloudinary] Plugin file not found, skipping.");
  process.exit(0);
}

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
