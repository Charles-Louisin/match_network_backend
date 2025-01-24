const User = require('../models/User')
const Post = require('../models/Post')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const mongoose = require('mongoose') // Ajout de mongoose pour utiliser Types.ObjectId
const { createNotification } = require('./notificationController')

// Créer le dossier uploads s'il n'existe pas
const uploadDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configuration de multer pour le stockage des images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // limite de 5MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/
    const mimetype = filetypes.test(file.mimetype)
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase())

    if (mimetype && extname) {
      return cb(null, true)
    }
    cb(new Error('Only image files are allowed!'))
  }
}).single('image')

const userController = {
  // Inscription
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body
      
      // Vérifier si l'utilisateur existe déjà
      const userExists = await User.findOne({ $or: [{ email }, { username }] })
      if (userExists) {
        return res.status(400).json({ message: 'User already exists' })
      }

      // Créer le nouvel utilisateur
      const user = await User.create({
        username,
        email,
        password
      })

      // Générer le token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
      })

      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        token
      })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  // Connexion
  login: async (req, res) => {
    try {
      const { email, password } = req.body
      
      // Vérifier si l'utilisateur existe
      const user = await User.findOne({ email })
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      // Vérifier le mot de passe
      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      // Générer le token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
      })

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        token
      })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  // Rechercher des utilisateurs
  searchUsers: async (req, res) => {
    try {
      const { query } = req.query
      let users;

      if (query) {
        // Si un terme de recherche est fourni
        users = await User.find({
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ],
          _id: { $ne: req.user._id }
        })
          .select('username email avatar')
          .limit(10)
      } else {
        // Si aucun terme de recherche, retourner tous les utilisateurs sauf l'utilisateur actuel
        users = await User.find({ _id: { $ne: req.user._id } })
          .select('username email avatar')
          .sort('username')
      }

      console.log('Returning users:', users)
      res.json(users)
    } catch (error) {
      console.error('Error in searchUsers:', error)
      res.status(500).json({ message: error.message })
    }
  },

  // Récupérer tous les utilisateurs
  getAllUsers: async (req, res) => {
    try {
      console.log('Getting all users, current user id:', req.user._id)
      
      const users = await User.find({ _id: { $ne: req.user._id } })
        .select('username email avatar')
        .sort('username')
      
      console.log('Found users:', users.length)
      console.log('Users:', users)

      res.json(users)
    } catch (error) {
      console.error('Error in getAllUsers:', error)
      res.status(500).json({ message: error.message })
    }
  },

  // Obtenir le profil d'un utilisateur
  getProfile: async (req, res) => {
    try {
      console.log('Getting profile for ID:', req.params.id)
      console.log('Request headers:', req.headers)
      console.log('Requesting user:', req.user)
      
      const userId = req.params.id
      const requestingUserId = req.user._id

      // Vérifier si l'ID est un ObjectId valide
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.log('Invalid ObjectId format')
        return res.status(400).json({ message: 'ID utilisateur invalide' })
      }

      const user = await User.findById(userId)
        .select('-password')
        .populate('friends', 'username avatar')
        .lean()

      if (!user) {
        console.log('User not found for ID:', userId)
        return res.status(404).json({ message: 'Utilisateur non trouvé' })
      }

      console.log('User found:', user)

      // Ajouter le flag isCurrentUser
      user.isCurrentUser = userId === requestingUserId.toString()
      console.log('isCurrentUser:', user.isCurrentUser)

      // Vérifier si l'utilisateur est déjà ami
      user.isFriend = user.friends.some(friend => 
        friend._id.toString() === requestingUserId
      )

      // Vérifier si une demande d'ami est en attente
      user.hasPendingRequest = user.friendRequests.some(requestId => 
        requestId.toString() === requestingUserId
      )

      // Récupérer les posts avec les commentaires peuplés
      const posts = await Post.find({ user: user._id })
        .populate('user', 'username avatar')
        .populate({
          path: 'comments.user',
          model: 'User',
          select: 'username avatar _id'
        })
        .sort({ createdAt: -1 })
        .lean();

      // Transformer les posts pour s'assurer que les données utilisateur sont présentes
      const transformedPosts = posts.map(post => {
        return {
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
        };
      });

      // Log pour vérifier la structure
      if (transformedPosts[0]?.comments[0]) {
        console.log('Sample comment structure:', 
          JSON.stringify(transformedPosts[0].comments[0], null, 2)
        );
      }

      res.json({
        ...user,
        posts: transformedPosts
      })
    } catch (error) {
      console.error('Error in getProfile:', error)
      res.status(500).json({ message: 'Server error' })
    }
  },

  // Obtenir les suggestions d'amis
  getSuggestions: async (req, res) => {
    try {
      console.log('Getting suggestions for user:', req.user._id);
      
      // Récupérer la liste des amis actuels et des demandes en attente
      const user = await User.findById(req.user._id)
        .populate('friends')
        .populate('friendRequests.sender')
        .populate('friendRequests.receiver');
      
      if (!user) {
        console.log('User not found');
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      // Créer un tableau des IDs à exclure (amis actuels et demandes en attente)
      const excludeIds = [
        req.user._id,
        ...user.friends.map(friend => friend._id),
        ...user.friendRequests.map(request => request.sender._id),
        ...user.friendRequests.map(request => request.receiver._id)
      ];

      console.log('Excluding IDs:', excludeIds);

      // Trouver des utilisateurs qui ne sont pas amis
      const suggestions = await User.find({
        _id: { $nin: excludeIds },
        isActive: true
      })
      .select('username email avatar bio')
      .limit(10);

      console.log('Found suggestions:', suggestions.length);

      res.json(suggestions);
    } catch (error) {
      console.error('Error in getSuggestions:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des suggestions',
        error: error.message 
      });
    }
  },

  // Mettre à jour le profil
  updateProfile: async (req, res) => {
    try {
      const updates = req.body
      const userId = req.user.id

      // Vérifier que l'utilisateur ne modifie que son propre profil
      if (updates._id && updates._id !== userId) {
        return res.status(403).json({ message: 'Not authorized to update this profile' })
      }

      // Champs autorisés à être modifiés
      const allowedUpdates = ['username', 'bio', 'location', 'birthDate', 'birthPlace']
      const updateData = {}
      
      // Vérifier si le nom d'utilisateur est déjà pris
      if (updates.username) {
        const existingUser = await User.findOne({ 
          username: updates.username,
          _id: { $ne: userId }
        })
        if (existingUser) {
          return res.status(400).json({ message: 'Ce nom d\'utilisateur est déjà pris' })
        }
      }

      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updateData[key] = updates[key]
        }
      })

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      ).select('-password')

      res.json(user)
    } catch (error) {
      console.error('Error in updateProfile:', error)
      res.status(500).json({ message: 'Server error' })
    }
  },

  // Upload d'avatar
  uploadAvatar: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Aucun fichier uploadé' });
      }

      // Vérifier la taille du fichier (10MB max)
      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ message: 'La taille du fichier doit être inférieure à 10MB' });
      }

      const userId = req.user._id;
      const avatarPath = `/uploads/${req.file.filename}`;

      const user = await User.findByIdAndUpdate(
        userId,
        { avatar: avatarPath },
        { new: true }
      );

      // Notifier les amis de l'utilisateur
      const friends = user.friends || [];
      for (const friendId of friends) {
        await createNotification(
          'PROFILE_PHOTO_UPDATED',
          userId,
          friendId,
          `${req.user.username} a mis à jour sa photo de profil`,
          userId
        );
      }

      res.json({
        message: 'Photo de profil mise à jour avec succès',
        avatar: avatarPath
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour de la photo de profil' });
    }
  },

  // Upload de photo de couverture
  uploadCoverPhoto: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Aucun fichier uploadé' });
      }

      // Vérifier la taille du fichier (10MB max)
      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ message: 'La taille du fichier doit être inférieure à 10MB' });
      }

      const userId = req.user._id;
      const coverPhotoPath = `/uploads/${req.file.filename}`;

      const user = await User.findByIdAndUpdate(
        userId,
        { coverPhoto: coverPhotoPath },
        { new: true }
      );

      // Notifier les amis de l'utilisateur
      const friends = user.friends || [];
      for (const friendId of friends) {
        await createNotification(
          'COVER_PHOTO_UPDATED',
          userId,
          friendId,
          `${req.user.username} a mis à jour sa photo de couverture`,
          userId
        );
      }

      res.json({
        message: 'Photo de couverture mise à jour avec succès',
        coverPhoto: coverPhotoPath
      });
    } catch (error) {
      console.error('Error uploading cover photo:', error);
      res.status(500).json({ message: 'Erreur lors de la mise à jour de la photo de couverture' });
    }
  },

  // Envoyer une demande d'ami
  sendFriendRequest: async (req, res) => {
    try {
      console.log('sendFriendRequest called with params:', req.params);
      console.log('Current user:', req.user);
      
      const { id } = req.params
      const user = await User.findById(id)
      
      if (!user) {
        console.log('User not found with id:', id);
        return res.status(404).json({ message: 'User not found' })
      }

      if (user.friendRequests.includes(req.user._id)) {
        console.log('Friend request already sent to user:', id);
        return res.status(400).json({ message: 'Friend request already sent' })
      }

      user.friendRequests.push(req.user._id)
      await user.save()

      res.json({ message: 'Friend request sent' })
    } catch (error) {
      console.error('Error in sendFriendRequest:', error);
      res.status(500).json({ message: error.message })
    }
  },

  // Accepter une demande d'ami
  acceptFriendRequest: async (req, res) => {
    try {
      const { id } = req.params
      const currentUser = await User.findById(req.user._id)
      const requestingUser = await User.findById(id)

      if (!requestingUser) {
        return res.status(404).json({ message: 'User not found' })
      }

      currentUser.friends.push(id)
      requestingUser.friends.push(req.user._id)
      currentUser.friendRequests = currentUser.friendRequests.filter(
        reqId => reqId.toString() !== id
      )

      await currentUser.save()
      await requestingUser.save()

      res.json({ message: 'Friend request accepted' })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  // Rejeter une demande d'ami
  rejectFriendRequest: async (req, res) => {
    try {
      const { id } = req.params
      const user = await User.findById(req.user._id)

      user.friendRequests = user.friendRequests.filter(
        reqId => reqId.toString() !== id
      )
      await user.save()

      res.json({ message: 'Friend request rejected' })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  // Supprimer un ami
  removeFriend: async (req, res) => {
    try {
      const { id } = req.params
      const currentUser = await User.findById(req.user._id)
      const friendUser = await User.findById(id)

      if (!friendUser) {
        return res.status(404).json({ message: 'User not found' })
      }

      currentUser.friends = currentUser.friends.filter(
        friendId => friendId.toString() !== id
      )
      friendUser.friends = friendUser.friends.filter(
        friendId => friendId.toString() !== req.user._id
      )

      await currentUser.save()
      await friendUser.save()

      res.json({ message: 'Friend removed' })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  }
}

module.exports = userController