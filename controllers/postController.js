const Post = require('../models/Post')
const User = require('../models/User')
const path = require('path')

const postController = {
  // Créer un post
  createPost: async (req, res) => {
    try {
      const { content } = req.body
      let image = null

      // Vérifier si une image a été uploadée
      if (req.file) {
        image = path.join('/uploads', req.file.filename).replace(/\\/g, '/')
      }

      // Vérifier si au moins un contenu ou une image est présent
      if (!content && !image) {
        return res.status(400).json({ 
          message: 'Le post doit contenir du texte ou une image' 
        })
      }

      // Créer le post
      const post = await Post.create({
        user: req.user._id,
        content: content || '',
        image
      })

      // Récupérer le post avec les informations de l'utilisateur
      const populatedPost = await Post.findById(post._id)
        .populate('user', 'username avatar')
        .lean()

      res.status(201).json(populatedPost)
    } catch (error) {
      console.error('Erreur création post:', error)
      res.status(500).json({ 
        message: 'Une erreur est survenue lors de la création du post',
        error: error.message 
      })
    }
  },

  // Récupérer les posts pour le fil d'actualité
  getFeedPosts: async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
      const userIds = [...user.friends, req.user._id]

      const posts = await Post.find({ user: { $in: userIds } })
        .populate('user', 'username avatar')
        .populate({
          path: 'comments.user',
          model: 'User',
          select: 'username avatar _id'
        })
        .populate('taggedUsers', 'username')
        .sort('-createdAt')
        .lean();

      // Transformer les posts pour garantir la structure des commentaires
      const transformedPosts = posts.map(post => ({
        ...post,
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

      res.json(transformedPosts)
    } catch (error) {
      console.error('Error in getFeedPosts:', error);
      res.status(500).json({ message: error.message })
    }
  },

  // Like/Unlike un post
  likePost: async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "Post non trouvé" });
      }

      const likeIndex = post.likes.indexOf(req.user.id);
      if (likeIndex === -1) {
        // Ajouter le like
        post.likes.push(req.user.id);
      } else {
        // Retirer le like
        post.likes.splice(likeIndex, 1);
      }

      await post.save();
      res.json({ likes: post.likes });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Ajouter un commentaire
  commentPost: async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ message: "Le contenu est requis" });
      }

      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "Post non trouvé" });
      }

      // Créer le nouveau commentaire avec l'ID de l'utilisateur
      const comment = {
        content,
        user: req.user._id,
        createdAt: new Date()
      };

      // Ajouter le commentaire au post
      post.comments.push(comment);
      await post.save();

      // Récupérer le commentaire ajouté (le dernier de la liste)
      const addedComment = post.comments[post.comments.length - 1];

      // Récupérer l'utilisateur qui a commenté
      const commentUser = await User.findById(req.user._id)
        .select('username avatar _id')
        .lean();

      // Créer la réponse avec les informations complètes
      const populatedComment = {
        _id: addedComment._id,
        content: addedComment.content,
        createdAt: addedComment.createdAt,
        user: commentUser
      };

      res.json(populatedComment);
    } catch (error) {
      console.error('Error in commentPost:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Récupérer un post spécifique
  getPost: async (req, res) => {
    try {
      const post = await Post.findById(req.params.id)
        .populate('user', 'username avatar')
        .populate({
          path: 'comments.user',
          select: 'username avatar _id'
        })
        .populate('taggedUsers', 'username');

      if (!post) {
        return res.status(404).json({ message: "Post non trouvé" });
      }

      res.json(post);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Supprimer un post
  deletePost: async (req, res) => {
    try {
      const post = await Post.findById(req.params.id)
      
      if (!post) {
        return res.status(404).json({ message: 'Post non trouvé' })
      }

      if (post.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Non autorisé' })
      }

      await post.remove()
      res.json({ message: 'Post supprimé' })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  }
}

module.exports = postController