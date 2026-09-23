// Raster data only; never store remote URLs, SVG markup, or unbounded input.
function validateAvatar(value) {
  function invalid() { const e = new Error('头像须为不超过 128 KB 的 PNG、JPG 或 WebP 图片'); e.code = 'INVALID_AVATAR'; e.statusCode = 400; throw e; }
  if (typeof value !== 'string' || value.length > 175000) invalid();
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) invalid();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 128 * 1024 || bytes.toString('base64') !== match[2]) invalid();
  const png = bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.toString('ascii', 12, 16) === 'IHDR';
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  const webp = bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length;
  if (!({ png, jpeg, webp })[match[1]]) invalid();
  return value;
}
module.exports = { validateAvatar };
