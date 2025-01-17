const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Notification = require('../models/Notification');

const friendController = {
  // Envoyer une demande d'ami
  sendFriendRequest: async (req, res) => {
    try {
      const { targetUserId } = req.params;
      const senderId = req.user._id;

      console.log('Sending friend request:', { targetUserId, senderId });

      // Vérifier que l'utilisateur n'essaie pas de s'envoyer une demande à lui-même
      if (targetUserId === senderId.toString()) {
        console.log('User trying to send friend request to themselves');
        return res.status(400).json({ message: 'Vous ne pouvez pas vous envoyer une demande d\'ami à vous-même' });
      }

      // Vérifier si l'utilisateur existe
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        console.log('Target user not found:', targetUserId);
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      // Vérifier si une demande existe déjà
      const existingRequest = await FriendRequest.findOne({
        $or: [
          { sender: senderId, recipient: targetUserId },
          { sender: targetUserId, recipient: senderId }
        ],
        status: 'pending'
      });

      if (existingRequest) {
        console.log('Friend request already exists');
        return res.status(400).json({ message: 'Une demande d\'ami est déjà en attente' });
      }

      // Vérifier s'ils sont déjà amis
      const areFriends = targetUser.friends.includes(senderId);
      if (areFriends) {
        console.log('Users are already friends');
        return res.status(400).json({ message: 'Vous êtes déjà amis' });
      }

      // Créer la demande d'ami
      const friendRequest = new FriendRequest({
        sender: senderId,
        recipient: targetUserId
      });
      await friendRequest.save();
      console.log('Friend request created:', friendRequest);

      // Créer une notification pour le destinataire uniquement
      const notification = new Notification({
        recipient: targetUserId,
        type: 'FRIEND_REQUEST',
        content: 'vous a envoyé une demande d\'ami',
        reference: friendRequest._id,
        sender: senderId
      });
      await notification.save();
      console.log('Notification created:', notification);

      res.status(201).json({ message: 'Demande d\'ami envoyée' });
    } catch (error) {
      console.error('Error in sendFriendRequest:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Accepter une demande d'ami
  acceptFriendRequest: async (req, res) => {
    try {
      const { requestId } = req.params;
      const userId = req.user._id;

      console.log('Accepting friend request:', { requestId, userId });

      const friendRequest = await FriendRequest.findById(requestId);

      if (!friendRequest) {
        console.log('Friend request not found');
        return res.status(404).json({ message: 'Demande non trouvée' });
      }

      console.log('Found friend request:', friendRequest);

      if (friendRequest.recipient.toString() !== userId.toString()) {
        console.log('Unauthorized: recipient ID does not match user ID');
        return res.status(403).json({ message: 'Non autorisé' });
      }

      if (friendRequest.status !== 'pending') {
        console.log('Request already processed');
        return res.status(400).json({ message: 'Cette demande a déjà été traitée' });
      }

      // Mettre à jour le statut de la demande
      friendRequest.status = 'accepted';
      await friendRequest.save();
      console.log('Updated friend request status to accepted');

      // Ajouter aux amis mutuellement
      const [sender, recipient] = await Promise.all([
        User.findByIdAndUpdate(
          friendRequest.sender,
          { $addToSet: { friends: friendRequest.recipient } },
          { new: true }
        ),
        User.findByIdAndUpdate(
          friendRequest.recipient,
          { $addToSet: { friends: friendRequest.sender } },
          { new: true }
        )
      ]);

      console.log('Updated users friends lists');

      // Créer une notification pour l'expéditeur uniquement
      const notification = await Notification.create({
        recipient: friendRequest.sender,
        sender: friendRequest.recipient,
        type: 'FRIEND_ACCEPT',
        content: 'a accepté votre demande d\'ami',
        reference: friendRequest._id
      });

      console.log('Created acceptance notification:', notification);

      // Supprimer toutes les notifications liées à cette demande d'ami
      await Notification.deleteMany({
        $or: [
          {
            recipient: userId,
            reference: friendRequest._id,
            type: 'FRIEND_REQUEST'
          },
          {
            recipient: friendRequest.sender,
            reference: friendRequest._id,
            type: 'FRIEND_REQUEST'
          }
        ]
      });

      console.log('Deleted all friend request notifications');

      res.json({
        message: 'Demande d\'ami acceptée',
        friend: sender
      });
    } catch (error) {
      console.error('Error in acceptFriendRequest:', error);
      res.status(500).json({ message: 'Erreur lors de l\'acceptation de la demande' });
    }
  },

  // Refuser une demande d'ami
  rejectFriendRequest: async (req, res) => {
    try {
      const { requestId } = req.params;
      const userId = req.user._id;

      const friendRequest = await FriendRequest.findById(requestId);

      if (!friendRequest) {
        return res.status(404).json({ message: 'Demande non trouvée' });
      }

      if (friendRequest.recipient.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'Non autorisé' });
      }

      if (friendRequest.status !== 'pending') {
        return res.status(400).json({ message: 'Cette demande a déjà été traitée' });
      }

      friendRequest.status = 'rejected';
      await friendRequest.save();

      res.json({ message: 'Demande d\'ami refusée' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Supprimer un ami
  removeFriend: async (req, res) => {
    try {
      const { friendId } = req.params;
      const userId = req.user._id;

      // Vérifier si l'ami existe
      const friend = await User.findById(friendId);
      if (!friend) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      // Vérifier s'ils sont bien amis
      const user = await User.findById(userId);
      const areFriends = user.friends.includes(friendId) && friend.friends.includes(userId);
      
      if (!areFriends) {
        return res.status(400).json({ message: 'Vous n\'êtes pas amis avec cet utilisateur' });
      }

      // Supprimer l'ami des deux côtés
      await Promise.all([
        User.findByIdAndUpdate(userId, {
          $pull: { friends: friendId }
        }),
        User.findByIdAndUpdate(friendId, {
          $pull: { friends: userId }
        })
      ]);

      res.json({ message: 'Ami supprimé avec succès' });
    } catch (error) {
      console.error('Error in removeFriend:', error);
      res.status(500).json({ message: 'Erreur lors de la suppression de l\'ami' });
    }
  },

  // Obtenir les suggestions d'amis
  getFriendSuggestions: async (req, res) => {
    try {
      const userId = req.user._id;

      // Récupérer l'utilisateur avec ses amis
      const currentUser = await User.findById(userId).populate('friends');

      // Récupérer toutes les demandes d'amitié en attente
      const pendingRequests = await FriendRequest.find({
        $or: [
          { sender: userId, status: 'pending' },
          { recipient: userId, status: 'pending' }
        ]
      });

      // Créer une liste d'IDs à exclure
      const excludedIds = [
        userId,
        ...currentUser.friends.map(friend => friend._id),
        ...pendingRequests.map(request => request.sender),
        ...pendingRequests.map(request => request.recipient)
      ];

      // Trouver des suggestions
      const suggestions = await User.find({
        _id: { $nin: excludedIds }
      })
        .select('username avatar bio')
        .limit(5);

      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Obtenir la liste des amis
  getFriendsList: async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId)
        .populate('friends', 'username avatar bio');

      res.json(user.friends);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Obtenir les demandes d'amitié en attente
  getPendingRequests: async (req, res) => {
    try {
      const userId = req.user._id;
      console.log('Getting pending requests for user:', userId);

      // Trouver toutes les demandes où l'utilisateur est soit l'expéditeur soit le destinataire
      const requests = await FriendRequest.find({
        $or: [
          { sender: userId },
          { recipient: userId }
        ],
        status: 'pending'
      })
      .populate('sender', 'username avatar')
      .populate('recipient', 'username avatar')
      .sort('-createdAt');

      console.log('Found pending requests:', requests);
      res.json(requests);
    } catch (error) {
      console.error('Error in getPendingRequests:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Vérifier le statut d'amitié
  getFriendshipStatus: async (req, res) => {
    try {
      const { targetId } = req.params;
      const userId = req.user._id;

      // Vérifier si c'est le profil de l'utilisateur courant
      const isCurrentUser = targetId === userId.toString();
      
      if (isCurrentUser) {
        return res.json({ isCurrentUser: true, isFriend: false });
      }

      // Vérifier s'ils sont amis
      const user = await User.findById(userId);
      const isFriend = user.friends.includes(targetId);

      res.json({ isCurrentUser: false, isFriend });
    } catch (error) {
      console.error('Error in getFriendshipStatus:', error);
      res.status(500).json({ message: 'Erreur lors de la vérification du statut d\'amitié' });
    }
  },
};

module.exports = friendController;