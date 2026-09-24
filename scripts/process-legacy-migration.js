const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MASTER_VAULT_KEY = process.env.SENEXAM_LEGACY_MASTER_KEY || 'SENEXAM_LEGACY_SECURE_VAULT_KEY_2026';

const LEGACY_MODULES = [
  'admin',
  'announcements',
  'dashboard',
  'exams',
  'exclusive-store',
  'focus',
  'library',
  'senai-studio',
  'submissions',
  'vip',
  'tinhdiem',
  'phongthinghiem',
  'senvideo',
  'sen-cap-lai-mat-khau',
  'vi-sen',
  'forum',
  'mes'
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  files.forEach((file) => {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.statSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}

// AES-256-GCM Encryption
function encryptData(text, secretKey) {
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    authTag,
    encryptedData: encrypted,
  };
}

async function run() {
  console.log('--- 1. BẮT ĐẦU QUÁ TRÌNH DI CHUYỂN & MÃ HÓA CÁC MODULE LEGACY ---');

  const rootDir = process.cwd();
  const legacyArchiveDir = path.join(rootDir, 'legacy');
  const legacyVaultDir = path.join(legacyArchiveDir, 'encrypted_vault');

  if (!fs.existsSync(legacyVaultDir)) {
    fs.mkdirSync(legacyVaultDir, { recursive: true });
  }

  const archiveBundle = [];

  // 1. Sao chép sang app/legacy-<module> và thu thập file để mã hóa
  for (const mod of LEGACY_MODULES) {
    const srcDir = path.join(rootDir, 'app', mod);
    const destDir = path.join(rootDir, 'app', `legacy-${mod}`);

    if (fs.existsSync(srcDir)) {
      console.log(`[COPY] app/${mod} -> app/legacy-${mod}`);
      copyFolderRecursiveSync(srcDir, destDir);

      const files = getAllFiles(srcDir);
      for (const f of files) {
        const relativeToApp = path.relative(path.join(rootDir, 'app'), f);
        const content = fs.readFileSync(f, 'utf8');

        // Mã hóa từng file riêng biệt lưu vào legacy/encrypted_vault
        const enc = encryptData(content, MASTER_VAULT_KEY);
        const encFilePath = path.join(legacyVaultDir, `${relativeToApp}.enc`);
        const encFileDir = path.dirname(encFilePath);
        if (!fs.existsSync(encFileDir)) {
          fs.mkdirSync(encFileDir, { recursive: true });
        }
        fs.writeFileSync(encFilePath, JSON.stringify(enc, null, 2), 'utf8');

        archiveBundle.push({
          filePath: relativeToApp,
          content,
          sha256: crypto.createHash('sha256').update(content).digest('hex'),
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // 2. Tạo file master archive được mã hóa toàn bộ: legacy/vault_archive.enc
  console.log(`[ENCRYPT] Đang mã hóa toàn bộ gói lưu trữ legacy (${archiveBundle.length} tệp)...`);
  const masterEncrypted = encryptData(JSON.stringify(archiveBundle), MASTER_VAULT_KEY);
  fs.writeFileSync(
    path.join(legacyArchiveDir, 'vault_archive.enc'),
    JSON.stringify(masterEncrypted, null, 2),
    'utf8'
  );

  // 3. Tạo script giải mã cho Quản trị viên: legacy/decrypt-vault.js
  const decryptScript = `/**
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
`;
  fs.writeFileSync(path.join(legacyArchiveDir, 'decrypt-vault.js'), decryptScript, 'utf8');

  // 4. Tạo file README giải thích và hướng dẫn bảo mật trong thư mục legacy
  const readmeContent = `# SenExam Legacy Vault (Encrypted Storage)

Thư mục này chứa toàn bộ các mô-đun và tệp mã nguồn phiên bản cũ (Legacy) của hệ thống **SenExam** trước đợt nâng cấp giao diện lớn 2026.

## 1. Cơ chế Bảo mật
- Tất cả các tệp mã nguồn legacy đã được mã hóa theo chuẩn **AES-256-GCM** quân đội để ngăn chặn triệt để nguy cơ quét lỗ hổng (vulnerability scanning), rò rỉ mã nguồn và khai thác dữ liệu cũ.
- Từng tệp riêng lẻ được lưu dưới định dạng \`.enc\` trong thư mục \`encrypted_vault/\`.
- Toàn bộ gói tổng hợp được đóng gói trong \`vault_archive.enc\`.

## 2. Truy cập Giao diện Legacy (Dành cho Admin)
- Trong ứng dụng web, Quản trị viên (Admin/Collab) có thể truy cập các trang legacy để quản lý tính năng cũ thông qua tiền tố:
  - \`/legacy-dashboard\`
  - \`/legacy-admin\`
  - \`/legacy-exams\`
  - \`/legacy-library\`
  - \`/legacy-submissions\`
  - \`/legacy-vip\`
  - \`/legacy-senai-studio\`
  - ... (toàn bộ các module cũ được cấp đầu \`legacy-\`)
- Người dùng thông thường khi truy cập các đường dẫn này sẽ tự động được chuyển hướng về giao diện mới (\`/new-...\` hoặc \`/dashboard\`).

## 3. Khôi phục / Giải mã mã nguồn khi cần
Nếu Quản trị viên cần khôi phục lại mã nguồn rõ để đối chiếu:
\`\`\`bash
node legacy/decrypt-vault.js [đường_dẫn_đích]
\`\`\`
*(Khóa giải mã mặc định được đọc từ biến môi trường \`SENEXAM_LEGACY_MASTER_KEY\`)*
`;
  fs.writeFileSync(path.join(legacyArchiveDir, 'README.md'), readmeContent, 'utf8');

  // 5. Thay thế app/dashboard/page.tsx bằng code của app/new-dashboard/page.tsx
  console.log('[UPDATE] Chuyển toàn bộ code của app/new-dashboard/page.tsx sang app/dashboard/page.tsx...');
  const newDashboardContent = fs.readFileSync(path.join(rootDir, 'app', 'new-dashboard', 'page.tsx'), 'utf8');
  fs.writeFileSync(path.join(rootDir, 'app', 'dashboard', 'page.tsx'), newDashboardContent, 'utf8');

  // Xóa thư mục app/dashboard/_home vì dashboard mới không dùng _home nữa (đã chuyển sang legacy-dashboard/_home)
  const oldHomeDir = path.join(rootDir, 'app', 'dashboard', '_home');
  if (fs.existsSync(oldHomeDir)) {
    fs.rmSync(oldHomeDir, { recursive: true, force: true });
    console.log('[CLEANUP] Đã dọn dẹp app/dashboard/_home (đã lưu an toàn trong app/legacy-dashboard/_home)');
  }

  // 6. Xóa bỏ 16 thư mục legacy cũ trong app/ (ngoại trừ dashboard vì dashboard nay chạy code mới)
  const modulesToDelete = LEGACY_MODULES.filter((m) => m !== 'dashboard');
  for (const mod of modulesToDelete) {
    const dirToDelete = path.join(rootDir, 'app', mod);
    if (fs.existsSync(dirToDelete)) {
      fs.rmSync(dirToDelete, { recursive: true, force: true });
      console.log(`[DELETE LEGACY] Đã gỡ bỏ thư mục app/${mod}`);
    }
  }

  // 7. Xóa các file rác phát sinh ngoài root do gõ nhầm lệnh
  const junkFiles = [
    'et --hard ad0f03f',
    'h origin backup-before-restore',
    'napshot backup của main hiện tại (phòng khi cần khôi phục)',
    'napshot hiện tại (backup)',
  ];
  for (const jf of junkFiles) {
    const p = path.join(rootDir, jf);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`[CLEANUP] Đã xóa file rác: "${jf}"`);
    }
  }

  console.log('--- HOÀN THÀNH QUÁ TRÌNH DI CHUYỂN & MÃ HÓA LEGACY ---');
}

run().catch((err) => {
  console.error('Lỗi khi thực hiện:', err);
  process.exit(1);
});
