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

// Route pour obtenir les posts d'un utilisateur spécifique
router.get('/user/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si l'utilisateur existe
    const user = await User.findById(id).select('username avatar');
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    
    // Récupérer les posts avec les informations utilisateur et commentaires
    const posts = await Post.find({ user: user._id })
      .populate('user', 'username avatar')
      .populate({
        path: 'comments.user',
        model: 'User',
        select: 'username avatar _id'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Transformer les posts pour garantir la structure des commentaires
    const transformedPosts = posts.map(post => ({
      ...post,
      user: {
        _id: user._id,
        username: user.username,
        avatar: user.avatar
      },
      comments: post.comments.map(comment => ({
        _id: comment._id,
        content: comment.content,
        createdAt: comment.createdAt,
        user: comment.user || {
          _id: 'deleted',
          username: 'Utilisateur supprimé',
          avatar: null
        }
      }))
    }));

    res.json(transformedPosts);
  } catch (error) {
    console.error('Error in user posts:', error);
    res.status(500).json({ message: "Erreur lors de la récupération des posts" });
  }
}); 

module.exports = router