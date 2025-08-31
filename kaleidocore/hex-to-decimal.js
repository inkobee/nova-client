// hex-to-decimal.js
// Run with: node hex-to-decimal.js input.js output.js

const fs = require("fs");

function convertHexLiterals(code) {
  return code.replace(/0x[0-9a-fA-F]+/g, match => {
    return parseInt(match, 16).toString();
  });
}

if (process.argv.length < 4) {
  console.error("Usage: node hex-to-decimal.js <input.js> <output.js>");
  process.exit(1);
}

const input = fs.readFileSync(process.argv[2], "utf8");
const output = convertHexLiterals(input);
fs.writeFileSync(process.argv[3], output, "utf8");

console.log(`Converted hex literals written to ${process.argv[3]}`);
