const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Créer le dossier uploads s'il n'existe pas
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accepter les images et les vidéos
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else if (file.mimetype.startsWith('video/')) {
    // Vérifier la taille pour les vidéos
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (parseInt(req.headers['content-length']) > maxSize) {
      cb(new Error('La taille de la vidéo ne doit pas dépasser 50MB'), false);
    } else {
      cb(null, true);
    }
  } else {
    cb(new Error('Format de fichier non supporté. Veuillez télécharger une image ou une vidéo.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: fileFilter
});

module.exports = upload;