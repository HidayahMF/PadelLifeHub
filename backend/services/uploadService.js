// Avatar storage abstraction.
//
// - When UPLOAD_STORAGE=cloudinary (and Cloudinary env vars are present) files
//   are uploaded to Cloudinary and a permanent HTTPS URL is returned. This is
//   what production (Vercel serverless, ephemeral filesystem) should use.
// - Otherwise files are written to the local uploads folder (development) and
//   a relative /uploads/... URL is returned.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const USE_CLOUDINARY =
  process.env.UPLOAD_STORAGE === 'cloudinary' &&
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (USE_CLOUDINARY) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('[uploads] Cloudinary storage enabled');
}

/** Extract the Cloudinary public_id (including folder) from a secure URL. */
function cloudinaryPublicId(url) {
  const m = String(url).match(/\/upload\/v\d+\/(.+)$/);
  if (!m) return null;
  return m[1].replace(/\.[^.]+$/, '');
}

/**
 * Persist an uploaded image buffer. Resolves to
 * `{ url, remote }` where `remote=true` means the URL is already absolute.
 */
async function saveUploadedFile(buffer, mimetype) {
  const ext = MIME_EXT[mimetype] || '.png';

  if (USE_CLOUDINARY) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'lifehub-avatars', overwrite: true, resource_type: 'image' },
        (err, result) => {
          if (err) return reject(err);
          resolve({ url: result.secure_url, remote: true });
        }
      );
      stream.end(buffer);
    });
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { url: `/uploads/${filename}`, remote: false };
}

/** Best-effort removal of an avatar file (Cloudinary or local disk). */
function removeFile(url) {
  if (!url || typeof url !== 'string') return;

  if (String(url).includes('res.cloudinary.com')) {
    const publicId = cloudinaryPublicId(url);
    if (publicId) cloudinary.uploader.destroy(publicId, () => {});
    return;
  }

  const m = url.match(/\/uploads\/([^/?]+)/);
  if (m) fs.unlink(path.join(UPLOAD_DIR, m[1]), () => {});
}

module.exports = { saveUploadedFile, removeFile, USE_CLOUDINARY };
