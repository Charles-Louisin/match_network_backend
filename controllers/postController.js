const Post = require('../models/Post')
const User = require('../models/User')
const path = require('path')
const { createNotification } = require('./notificationController')

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

      // Notifier les amis de l'utilisateur
      const user = await User.findById(req.user._id).populate('friends');
      if (user && user.friends && user.friends.length > 0) {
        console.log(`Notifying ${user.friends.length} friends about new post`);
        
        for (const friend of user.friends) {
          try {
            const notification = await createNotification(
              'POST_CREATED',
              req.user._id,
              friend._id,
              `${req.user.username} a publié un nouveau post`,
              post._id
            );
            console.log('Created notification:', notification);
          } catch (error) {
            console.error('Error creating notification for friend:', friend._id, error);
          }
        }
      }

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

  // Like/Unlike un post
  likePost: async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user._id;

      const post = await Post.findById(postId).populate('user');
      if (!post) {
        return res.status(404).json({ message: 'Post non trouvé' });
      }

      const isLiked = post.likes.includes(userId);
      const update = isLiked 
        ? { $pull: { likes: userId } }
        : { $addToSet: { likes: userId } };

      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        update,
        { new: true }
      ).populate('user', 'username avatar');

      // Créer une notification si l'utilisateur aime le post
      if (!isLiked && post.user._id.toString() !== userId.toString()) {
        try {
          const notification = await createNotification(
            'POST_LIKE',
            userId,
            post.user._id,
            `${req.user.username} a aimé votre publication`,
            postId
          );
          console.log('Created like notification:', notification);
        } catch (error) {
          console.error('Error creating like notification:', error);
        }
      }

      res.json(updatedPost);
    } catch (error) {
      console.error('Error in likePost:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Ajouter un commentaire
  commentPost: async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user._id;
      const { content } = req.body;

      const post = await Post.findById(postId).populate('user');
      if (!post) {
        return res.status(404).json({ message: 'Post non trouvé' });
      }

      const comment = {
        user: userId,
        content,
        createdAt: new Date()
      };

      post.comments.push(comment);
      await post.save();

      // Créer une notification pour le propriétaire du post
      if (post.user._id.toString() !== userId.toString()) {
        try {
          const notification = await createNotification(
            'POST_COMMENT',
            userId,
            post.user._id,
            `${req.user.username} a commenté votre publication`,
            postId
          );
          console.log('Created comment notification:', notification);
        } catch (error) {
          console.error('Error creating comment notification:', error);
        }
      }

      // Récupérer le commentaire ajouté (le dernier de la liste)
      const addedComment = post.comments[post.comments.length - 1];

      // Récupérer l'utilisateur qui a commenté
      const commentUser = await User.findById(userId)
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
      const postId = req.params.id;
      const post = await Post.findById(postId)
        .populate('user', 'username avatar')
        .populate({
          path: 'comments',
          populate: {
            path: 'user',
            select: 'username avatar'
          },
          options: { sort: { createdAt: -1 } }
        })
        .lean();

      if (!post) {
        return res.status(404).json({ message: 'Post non trouvé' });
      }

      // Ajouter les informations de likes
      post.likes = post.likes || [];
      
      res.json(post);
    } catch (error) {
      console.error('Error getting post:', error);
      res.status(500).json({ message: error.message });
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