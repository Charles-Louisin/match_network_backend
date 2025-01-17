const express = require('express')
const router = express.Router()
const userController = require('../controllers/userController')
const { protect } = require('../middleware/authMiddleware')
const upload = require('../middleware/uploadMiddleware')

// Routes publiques
router.post('/register', userController.register)
router.post('/login', userController.login)

// Routes protégées
router.use(protect)

// Routes de recherche et profil
router.get('/search', userController.searchUsers)
router.get('/profile/:id', userController.getProfile)
router.put('/profile', userController.updateProfile)

// Routes d'upload d'images
router.post('/upload-avatar', protect, upload.single('image'), userController.uploadAvatar)
router.post('/upload-coverPhoto', protect, upload.single('image'), userController.uploadCoverPhoto)

module.exports = router