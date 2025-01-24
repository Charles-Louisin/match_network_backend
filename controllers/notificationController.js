const Notification = require('../models/Notification');
const User = require('../models/User');
const Post = require('../models/Post');

const notificationController = {
  // Récupérer toutes les notifications d'un utilisateur
  getNotifications: async (req, res) => {
    try {
      const userId = req.user._id;
      console.log('Getting notifications for user:', userId);

      // Récupérer les notifications non lues
      const notifications = await Notification.find({ 
        recipient: userId,
        sender: { $ne: userId }
      })
      .populate('sender', 'username avatar')
      .sort('-createdAt');

      // Récupérer les détails des références
      const populatedNotifications = await Promise.all(
        notifications.map(async (notification) => {
          let populatedNotification = notification.toObject();

          if (['POST_CREATED', 'POST_LIKE', 'POST_COMMENT'].includes(notification.type)) {
            const post = await Post.findById(notification.reference)
              .populate('user', 'username avatar');
            if (post) {
              populatedNotification.reference = {
                _id: post._id,
                image: post.image,
                content: post.content,
                user: post.user
              };
            }
          } else if (notification.type === 'PROFILE_PHOTO_UPDATED') {
            const user = await User.findById(notification.sender);
            if (user) {
              populatedNotification.reference = user.avatar;
            }
          } else if (notification.type === 'COVER_PHOTO_UPDATED') {
            const user = await User.findById(notification.sender);
            if (user) {
              populatedNotification.reference = user.coverPhoto;
            }
          }

          return populatedNotification;
        })
      );

      console.log('Found notifications:', populatedNotifications);
      res.json(populatedNotifications);
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ message: 'Erreur lors de la récupération des notifications' });
    }
  },

  // Obtenir le nombre de notifications non lues
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user._id;
      const count = await Notification.countDocuments({
        recipient: userId,
        read: false,
        sender: { $ne: userId }
      });
      res.json({ count });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Créer une nouvelle notification
  createNotification: async (type, senderId, recipientId, content, referenceId) => {
    try {
      // Ne pas créer de notification si l'expéditeur est le destinataire
      if (senderId.toString() === recipientId.toString()) {
        return null;
      }

      const notification = await Notification.create({
        type,
        sender: senderId,
        recipient: recipientId,
        content,
        reference: referenceId,
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  },

  // Marquer une notification comme lue
  markAsRead: async (req, res) => {
    try {
      const notificationId = req.params.notificationId;
      const userId = req.user._id;

      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
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

  // Marquer toutes les notifications comme lues
  markAllAsRead: async (req, res) => {
    try {
      const userId = req.user._id;
      
      await Notification.updateMany(
        { recipient: userId, read: false },
        { read: true }
      );

      res.json({ message: 'Toutes les notifications ont été marquées comme lues' });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = notificationController;
