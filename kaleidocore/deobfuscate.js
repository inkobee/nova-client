// deobfuscate.js
// Run with: node deobfuscate.js input.js output.js

const fs = require("fs");

// --- decoder copied from the obfuscated script ---
function a0_0x549621(arr, key) {
  return arr.map(num => String.fromCharCode(num ^ key)).join("");
}

// --- process a file ---
function deobfuscateFile(inputPath, outputPath) {
  let code = fs.readFileSync(inputPath, "utf8");

  // Regex to match calls like: a0_0x549621([12,34,...], 0x1a)
  // - Captures the array of numbers and the key expression.
  const regex = /a0_0x549621\(\s*\[([^\]]+)\]\s*,\s*([^)]+)\)/g;

  code = code.replace(regex, (match, arrStr, keyStr) => {
    try {
      const numbers = arrStr.split(",").map(s => s.trim()).filter(s => s.length > 0);
      if (numbers.length === 0) {
        // If it's literally [], drop the whole call
        return '""'; // or return '' to erase entirely
      }

      const nums = numbers.map(s => parseInt(s));
      const key = eval(keyStr);
      const decoded = a0_0x549621(nums, key);

      return JSON.stringify(decoded);
    } catch (e) {
      console.error("Failed to decode:", match, e);
      return match; // leave unchanged if parse failed
    }
  });

  fs.writeFileSync(outputPath, code, "utf8");
  console.log(`Deobfuscated file written to ${outputPath}`);
}

// --- CLI ---
if (process.argv.length < 4) {
  console.error("Usage: node deobfuscate.js <input.js> <output.js>");
  process.exit(1);
}

deobfuscateFile(process.argv[2], process.argv[3]);
