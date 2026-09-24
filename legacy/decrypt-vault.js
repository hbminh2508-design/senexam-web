/**
 * SENEXAM LEGACY VAULT DECRYPTOR
 * Công cụ giải mã an toàn các tệp mã nguồn legacy dành cho Quản trị viên.
 * Sử dụng: node legacy/decrypt-vault.js [output_directory]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MASTER_VAULT_KEY = process.env.SENEXAM_LEGACY_MASTER_KEY || 'SENEXAM_LEGACY_SECURE_VAULT_KEY_2026';

function decryptData(encryptedObj, secretKey) {
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = Buffer.from(encryptedObj.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
  let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const targetDir = process.argv[2] || path.join(__dirname, 'restored_source');
const archiveFile = path.join(__dirname, 'vault_archive.enc');

if (!fs.existsSync(archiveFile)) {
  console.error('Không tìm thấy file vault_archive.enc');
  process.exit(1);
}

try {
  console.log('Đang giải mã kho lưu trữ mã nguồn Legacy...');
  const encData = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
  const decryptedJson = decryptData(encData, MASTER_VAULT_KEY);
  const bundle = JSON.parse(decryptedJson);

  bundle.forEach((item) => {
    const outPath = path.join(targetDir, item.filePath);
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, item.content, 'utf8');
    console.log('Đã giải mã thành công: ' + item.filePath);
  });

  console.log('Hoàn thành giải mã ' + bundle.length + ' tệp tại: ' + targetDir);
} catch (e) {
  console.error('Giải mã thất bại. Vui lòng kiểm tra khóa SENEXAM_LEGACY_MASTER_KEY. Lỗi:', e.message);
  process.exit(1);
}
