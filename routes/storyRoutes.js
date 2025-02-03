const express = require('express')
const router = express.Router()
const storyController = require('../controllers/storyController')
const { protect } = require('../middleware/authMiddleware')
const upload = require('../middleware/uploadMiddleware')

// Middleware pour parser le JSON
router.use(express.json())

// Route pour créer une story texte
router.post('/text', protect, storyController.createStory)

// Route pour créer une story média (image/vidéo)
router.post('/media', protect, upload.single('media'), storyController.createStory)

// Récupérer toutes les stories
router.get('/', protect, storyController.getStories)

// Voir une story
router.put('/:id/view', protect, storyController.viewStory)

// Liker/Unliker une story
router.put('/:id/like', protect, storyController.likeStory)

// Supprimer une story
router.delete('/:id', protect, storyController.deleteStory)

module.exports = router