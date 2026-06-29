import fs from "node:fs";
import zlib from "node:zlib";

const args = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readUInt64LE(buffer, offset) {
  const low = buffer.readUInt32LE(offset);
  const high = buffer.readUInt32LE(offset + 4);
  return high * 0x100000000 + low;
}

function findEocd(buffer) {
  const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  fail("EOCD not found");
}

function parseEntries(pptxPath) {
  const buffer = fs.readFileSync(pptxPath);
  const eocd = findEocd(buffer);
  let entryCount = buffer.readUInt16LE(eocd + 10);
  let centralDirOffset = buffer.readUInt32LE(eocd + 16);

  const zip64Locator = eocd >= 20 && buffer.readUInt32LE(eocd - 20) === 0x07064b50 ? eocd - 20 : -1;
  if (zip64Locator >= 0) {
    const zip64EocdOffset = readUInt64LE(buffer, zip64Locator + 8);
    if (buffer.readUInt32LE(zip64EocdOffset) === 0x06064b50) {
      entryCount = Number(readUInt64LE(buffer, zip64EocdOffset + 32));
      centralDirOffset = Number(readUInt64LE(buffer, zip64EocdOffset + 48));
    }
  }

  const entries = new Map();
  let offset = centralDirOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) fail("Central directory is invalid");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    entries.set(name, { method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { buffer, entries };
}

function entryBytes(parsed, entryName) {
  const entry = parsed.entries.get(entryName);
  if (!entry) fail(`Entry not found: ${entryName}`);
  const { buffer } = parsed;
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) fail("Local header is invalid");
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return zlib.inflateRawSync(compressed);
  fail(`Unsupported compression method: ${entry.method}`);
}

if (args[0] === "-Z1" && args.length === 2) {
  const parsed = parseEntries(args[1]);
  process.stdout.write(Array.from(parsed.entries.keys()).join("\n"));
  process.exit(0);
}

if (args[0] === "-p" && args.length === 3) {
  const parsed = parseEntries(args[1]);
  process.stdout.write(entryBytes(parsed, args[2]));
  process.exit(0);
}

fail(`Unsupported unzip args: ${args.join(" ")}`);
