const express = require('express');
const multer = require('multer');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS ayarları
app.use(cors());
app.use(express.json());

// Uploads klasörünü statik olarak sun
app.use('/uploads', express.static('uploads'));

// Firebase Admin SDK başlatma
const serviceAccount = {
  // Firebase console'dan service account key'i buraya gelecek
  // Şimdilik boş bırakıyoruz, sonra ekleyeceğiz
};

// Firebase Admin SDK'yı başlat (serviceAccount boş olduğu için şimdilik yorum satırı)
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// Multer ayarları (dosya upload için)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Dosya adını timestamp + orijinal uzantı olarak kaydet
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    // Sadece resim dosyalarına izin ver
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
    }
  }
});

// Firebase token doğrulama middleware (şimdilik devre dışı)
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token gerekli' });
    }

    const token = authHeader.split(' ')[1];
    // Firebase Admin SDK henüz başlatılmadığı için şimdilik geçici olarak devam ediyoruz
    // const decodedToken = await admin.auth().verifyIdToken(token);
    // req.user = decodedToken;
    
    // Geçici olarak token'ı kabul ediyoruz
    req.user = { uid: 'test-user' };
    next();
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    res.status(401).json({ error: 'Geçersiz token' });
  }
};

// Avatar upload endpoint'i
app.post('/upload-avatar', authenticateToken, upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    const userId = req.user.uid;
    const fileName = req.file.filename;
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;

    // Disk kullanımı kontrolü
    const uploadsDir = './uploads';
    const files = fs.readdirSync(uploadsDir);
    const totalSize = files.reduce((size, file) => {
      const filePath = path.join(uploadsDir, file);
      return size + fs.statSync(filePath).size;
    }, 0);

    // 100MB limit kontrolü
    if (totalSize > 100 * 1024 * 1024) {
      // Dosyayı sil
      fs.unlinkSync(req.file.path);
      return res.status(507).json({ error: 'Depolama alanı dolu' });
    }

    res.json({
      success: true,
      url: fileUrl,
      userId: userId,
      fileName: fileName
    });

  } catch (error) {
    console.error('Upload hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Disk kullanımı kontrol endpoint'i
app.get('/disk-usage', (req, res) => {
  try {
    const uploadsDir = './uploads';
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ usage: 0, limit: 100 * 1024 * 1024 });
    }

    const files = fs.readdirSync(uploadsDir);
    const totalSize = files.reduce((size, file) => {
      const filePath = path.join(uploadsDir, file);
      return size + fs.statSync(filePath).size;
    }, 0);

    res.json({
      usage: totalSize,
      limit: 100 * 1024 * 1024, // 100MB
      percentage: (totalSize / (100 * 1024 * 1024)) * 100
    });
  } catch (error) {
    res.status(500).json({ error: 'Disk kullanımı hesaplanamadı' });
  }
});

// Sağlık kontrolü
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
}); 