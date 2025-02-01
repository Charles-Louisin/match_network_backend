const Post = require('../models/Post')
const User = require('../models/User')
const path = require('path')
const { createNotification } = require('./notificationController')

const postController = {
  // Créer un post
  createPost: async (req, res) => {
    try {
      const { content } = req.body;
      let image = null;
      let taggedUsers = [];

      // Vérifier si une image a été uploadée
      if (req.file) {
        image = path.join('/uploads', req.file.filename).replace(/\\/g, '/');
      }

      // Vérifier si des utilisateurs sont tagués
      if (req.body.taggedUsers) {
        try {
          taggedUsers = JSON.parse(req.body.taggedUsers);
        } catch (error) {
          console.error('Error parsing taggedUsers:', error);
        }
      }

      // Vérifier si au moins un contenu ou une image est présent
      if (!content && !image) {
        return res.status(400).json({ 
          message: 'Le post doit contenir du texte ou une image' 
        });
      }

      // Créer le post
      const post = await Post.create({
        user: req.user._id,
        content: content || '',
        image,
        taggedUsers
      });

      // Créer des notifications pour les utilisateurs tagués
      if (taggedUsers.length > 0) {
        for (const userId of taggedUsers) {
          try {
            await createNotification(
              'POST_TAG',
              req.user._id,
              userId,
              `${req.user.username} vous a mentionné dans une publication`,
              post._id
            );
          } catch (error) {
            console.error('Error creating tag notification:', error);
          }
        }
      }

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

      // Récupérer le post avec les informations de l'utilisateur et des utilisateurs tagués
      const populatedPost = await Post.findById(post._id)
        .populate('user', 'username avatar')
        .populate('taggedUsers', 'username avatar')
        .lean();

      res.status(201).json(populatedPost);
    } catch (error) {
      console.error('Erreur création post:', error);
      res.status(500).json({ 
        message: 'Une erreur est survenue lors de la création du post',
        error: error.message 
      });
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

  // Modifier un commentaire
  editComment: async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const { content } = req.body;

      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ message: 'Post non trouvé' });
      }

      const comment = post.comments.id(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Commentaire non trouvé' });
      }

      // Vérifier que l'utilisateur est l'auteur du commentaire
      if (comment.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Non autorisé à modifier ce commentaire' });
      }

      comment.content = content;
      await post.save();

      res.json(comment);
    } catch (error) {
      console.error('Erreur lors de la modification du commentaire:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  // Supprimer un commentaire
  deleteComment: async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ message: 'Post non trouvé' });
      }

      const comment = post.comments.id(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Commentaire non trouvé' });
      }

      // Vérifier que l'utilisateur est l'auteur du commentaire ou du post
      if (comment.user.toString() !== req.user._id.toString() && 
          post.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Non autorisé à supprimer ce commentaire' });
      }

      comment.remove();
      await post.save();

      res.json({ message: 'Commentaire supprimé' });
    } catch (error) {
      console.error('Erreur lors de la suppression du commentaire:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  // Liker/Unliker un commentaire
  likeComment: async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ message: 'Post non trouvé' });
      }

      const comment = post.comments.id(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Commentaire non trouvé' });
      }

      const likeIndex = comment.likes.indexOf(req.user._id);
      if (likeIndex === -1) {
        // Ajouter le like
        comment.likes.push(req.user._id);

        // Créer une notification pour l'auteur du commentaire
        if (comment.user.toString() !== req.user._id.toString()) {
          await createNotification(
            'COMMENT_LIKE',
            req.user._id,
            comment.user,
            `${req.user.username} a aimé votre commentaire`,
            postId,
            { commentId }
          );
        }
      } else {
        // Retirer le like
        comment.likes.splice(likeIndex, 1);
      }

      await post.save();
      res.json(comment);
    } catch (error) {
      console.error('Erreur lors du like/unlike du commentaire:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  // Répondre à un commentaire
  replyToComment: async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const { content } = req.body;

      // Vérifier et récupérer le post
      let post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ message: 'Post non trouvé' });
      }

      // Vérifier et récupérer le commentaire
      const comment = post.comments.id(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Commentaire non trouvé' });
      }

      // Récupérer l'utilisateur du commentaire original
      const originalUser = await User.findById(comment.user).select('username');
      if (!originalUser) {
        return res.status(404).json({ message: 'Utilisateur du commentaire non trouvé' });
      }

      // Ajouter le tag de l'utilisateur au début du contenu
      const contentWithTag = `@${originalUser.username} ${content}`;

      // Créer la nouvelle réponse
      if (!comment.replies) {
        comment.replies = [];
      }

      // Ajouter la réponse au commentaire
      comment.replies.push({
        user: req.user._id,
        content: contentWithTag,
        likes: [],
        createdAt: new Date()
      });

      // Sauvegarder le post
      await post.save();

      // Récupérer le post mis à jour avec toutes les informations utilisateur
      post = await Post.findById(postId)
        .populate('user', 'username avatar')
        .populate('comments.user', 'username avatar')
        .populate('comments.replies.user', 'username avatar')
        .populate('comments.likes', 'username avatar')
        .populate('comments.replies.likes', 'username avatar');

      // Créer une notification pour l'auteur du commentaire
      if (comment.user.toString() !== req.user._id.toString()) {
        await createNotification(
          'COMMENT_REPLY',
          req.user._id,
          comment.user,
          `${req.user.username} a répondu à votre commentaire`,
          postId,
          { commentId }
        );
      }

      res.json(post);
    } catch (error) {
      console.error('Erreur lors de la réponse au commentaire:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  // Récupérer un post spécifique
  getPost: async (req, res) => {
    try {
      const postId = req.params.id;
      const post = await Post.findById(postId)
        .populate('user', 'username avatar')
        .populate('taggedUsers', 'username avatar')
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
      res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  // Récupérer les posts pour le fil d'actualité
  getFeedPosts: async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      const friendIds = user.friends || [];
      
      const posts = await Post.find({
        $or: [
          { user: userId },
          { user: { $in: friendIds } }
        ]
      })
      .populate('user', 'username avatar')
      .populate('taggedUsers', 'username avatar')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'username avatar'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

      res.json(posts);
    } catch (error) {
      console.error('Error getting feed posts:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  // Récupérer les posts d'un utilisateur
  getUserPosts: async (req, res) => {
    try {
      const userId = req.params.userId;

      // Récupérer à la fois les posts créés par l'utilisateur et ceux où il est tagué
      const posts = await Post.find({
        $or: [
          { user: userId },
          { taggedUsers: userId }
        ]
      })
        .populate('user', 'username avatar')
        .populate('taggedUsers', 'username avatar')
        .populate({
          path: 'comments',
          populate: {
            path: 'user',
            select: 'username avatar'
          }
        })
        .sort({ createdAt: -1 })
        .lean();

      res.json(posts);
    } catch (error) {
      console.error('Error getting user posts:', error);
      res.status(500).json({ message: 'Erreur serveur' });
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