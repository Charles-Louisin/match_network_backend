const express = require('express')
const router = express.Router()
const storyController = require('../controllers/storyController')
const { protect } = require('../middleware/authMiddleware')
const upload = require('../middleware/uploadMiddleware')

router.post('/', protect, upload.single('image'), storyController.createStory)
router.get('/', protect, storyController.getStories)
router.put('/:id/view', protect, storyController.viewStory)

module.exports = router 