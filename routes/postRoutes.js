const express = require('express')
const router = express.Router()
const postController = require('../controllers/postController')
const { protect } = require('../middleware/authMiddleware')
const upload = require('../middleware/uploadMiddleware')
const User = require('../models/User')
const Post = require('../models/Post')

router.post('/', protect, upload.single('image'), postController.createPost)
router.get('/feed', protect, postController.getFeedPosts)
router.get('/:id', protect, postController.getPost)
router.post('/:id/like', protect, postController.likePost)
router.post('/:id/comment', protect, postController.commentPost)
router.delete('/:id', protect, postController.deletePost)

// Nouvelles routes pour les commentaires
router.put('/:postId/comments/:commentId', protect, postController.editComment)
router.delete('/:postId/comments/:commentId', protect, postController.deleteComment)
router.post('/:postId/comments/:commentId/like', protect, postController.likeComment)
router.post('/:postId/comments/:commentId/reply', protect, postController.replyToComment)

// Route pour obtenir les posts d'un utilisateur spécifique
router.get('/user/:userId', protect, postController.getUserPosts)

module.exports = router