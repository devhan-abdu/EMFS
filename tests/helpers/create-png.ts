import { deflateSync } from "node:zlib";

export function createPng(width: number, height: number): Uint8Array {
  const signature = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = pngChunk("IHDR", ihdrData(width, height));
  const idat = pngChunk("IDAT", deflateSync(rawScanlines(width, height)));
  const iend = pngChunk("IEND", new Uint8Array());
  const out = new Uint8Array(
    signature.length + ihdr.length + idat.length + iend.length,
  );
  out.set(signature, 0);
  out.set(ihdr, signature.length);
  out.set(idat, signature.length + ihdr.length);
  out.set(iend, signature.length + ihdr.length + idat.length);
  return out;
}

function ihdrData(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = 8;
  data[9] = 2;
  return data;
}

function rawScanlines(width: number, height: number): Uint8Array {
  const row = 1 + width * 3;
  return new Uint8Array(row * height);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

const CRC_TABLE = makeCrcTable();

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
