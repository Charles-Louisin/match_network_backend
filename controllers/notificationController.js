const Notification = require('../models/Notification');
const User = require('../models/User');

const notificationController = {
  // Récupérer toutes les notifications d'un utilisateur
  getNotifications: async (req, res) => {
    try {
      const userId = req.user._id;
      console.log('Getting notifications for user:', userId);

      // Récupérer toutes les notifications pertinentes
      const notifications = await Notification.find({ 
        recipient: userId,
        sender: { $ne: userId }, // Exclure les notifications où l'utilisateur est à la fois expéditeur et destinataire
        $or: [
          { type: 'FRIEND_REQUEST', status: { $ne: 'accepted' } },
          { type: 'FRIEND_ACCEPT', read: false }
        ]
      })
      .populate('sender', 'username avatar')
      .populate('reference')
      .sort('-createdAt');

      console.log('Found notifications:', notifications);
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Envoyer une demande d'ami
  sendFriendRequest: async (req, res) => {
    try {
      const { recipientId } = req.body;
      
      // Vérifier si une demande existe déjà
      const existingRequest = await Notification.findOne({
        sender: req.user._id,
        recipient: recipientId,
        type: 'FRIEND_REQUEST'
      });

      if (existingRequest) {
        return res.status(400).json({ message: 'Une demande est déjà en cours' });
      }

      // Créer la notification
      const notification = await Notification.create({
        sender: req.user._id,
        recipient: recipientId,
        type: 'FRIEND_REQUEST'
      });

      await notification.populate('sender', 'username avatar');
      
      res.status(201).json(notification);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Accepter une demande d'ami
  acceptFriendRequest: async (req, res) => {
    try {
      const notification = await Notification.findById(req.params.id);
      
      if (!notification) {
        return res.status(404).json({ message: 'Demande non trouvée' });
      }

      // Vérifier que l'utilisateur est bien le destinataire
      if (notification.recipient.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Non autorisé' });
      }

      // Ajouter les utilisateurs à leurs listes d'amis respectives
      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { friends: notification.sender }
      });

      await User.findByIdAndUpdate(notification.sender, {
        $addToSet: { friends: req.user._id }
      });

      // Marquer la notification comme lue
      notification.read = true;
      await notification.save();

      // Créer une notification d'acceptation pour l'expéditeur
      await Notification.create({
        sender: req.user._id,
        recipient: notification.sender,
        type: 'FRIEND_ACCEPT',
        read: false
      });

      res.json({ message: 'Demande acceptée' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Refuser une demande d'ami
  rejectFriendRequest: async (req, res) => {
    try {
      const notification = await Notification.findById(req.params.id);
      
      if (!notification) {
        return res.status(404).json({ message: 'Demande non trouvée' });
      }

      // Vérifier que l'utilisateur est bien le destinataire
      if (notification.recipient.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Non autorisé' });
      }

      // Supprimer la notification
      await notification.deleteOne();

      res.json({ message: 'Demande refusée' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Récupérer la liste des amis
  getFriends: async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .populate('friends', 'username avatar');

      res.json(user.friends);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Marquer une notification comme lue
  markAsRead: async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user._id;
      
      const notification = await Notification.findOneAndUpdate(
        { 
          _id: notificationId,
          recipient: userId 
        },
        { read: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ message: 'Notification non trouvée' });
      }

      res.json(notification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Supprimer une notification
  deleteNotification: async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user._id;

      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {
        return res.status(404).json({ message: 'Notification non trouvée' });
      }

      res.json({ message: 'Notification supprimée' });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = notificationController;
