const Notification = require('../models/Notification');
const User = require('../models/User');
const Post = require('../models/Post');

// Créer une notification
const createNotification = async (type, senderId, recipientId, text, postId = null, options = {}) => {
  try {
    // Vérifier si le destinataire existe
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      console.log('Recipient not found:', recipientId);
      return null;
    }

    // Vérifier si l'expéditeur existe
    const sender = await User.findById(senderId);
    if (!sender) {
      console.log('Sender not found:', senderId);
      return null;
    }

    let notification = new Notification({
      type,
      sender: senderId,
      recipient: recipientId,
      text,
      postId,
      additionalData: options.additionalData
    });

    switch (type) {
      case 'FRIEND_REQUEST':
        notification.type = type;
        notification.sender = senderId;
        notification.recipient = recipientId;
        break;
      case 'FRIEND_REQUEST_ACCEPTED':
        notification.type = type;
        notification.sender = senderId;
        notification.recipient = recipientId;
        break;
      case 'POST_LIKE':
        notification.type = type;
        notification.sender = senderId;
        notification.recipient = recipientId;
        notification.postId = postId;
        break;
      case 'POST_COMMENT':
        notification.type = type;
        notification.sender = senderId;
        notification.recipient = recipientId;
        notification.postId = postId;
        notification.commentContent = options.commentContent;
        break;
      case 'POST_TAG':
        notification.type = type;
        notification.sender = senderId;
        notification.recipient = recipientId;
        notification.postId = postId;
        break;
      default:
        throw new Error('Type de notification invalide');
    }

    await notification.save();
    
    // Populate the notification before returning
    notification = await Notification.findById(notification._id)
      .populate('sender', 'username avatar')
      .populate('postId');

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Récupérer les notifications d'un utilisateur
const getNotifications = async (req, res) => {
  try {
    console.log('Fetching notifications for user:', req.user._id);

    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'username avatar')
      .populate('reference')
      .populate({
        path: 'postId',
        select: 'content image user comments',
        populate: {
          path: 'user',
          select: 'username avatar'
        }
      })
      .sort({ createdAt: -1 });

    console.log('Found notifications:', notifications);

    // Enrichir les notifications avec des informations supplémentaires
    const enrichedNotifications = await Promise.all(notifications.map(async (notification) => {
      const enriched = notification.toObject();

      // Pour les notifications de type POST
      if (['POST_LIKE', 'POST_COMMENT', 'POST_TAG'].includes(notification.type)) {
        if (notification.postId) {
          enriched.previewImage = notification.postId.image;
          enriched.postContent = notification.postId.content;
        }
      }
      
      // Pour les notifications de type POST_CREATED
      if (notification.type === 'POST_CREATED' && notification.reference) {
        enriched.previewImage = notification.reference.image;
        enriched.postContent = notification.reference.content;
      }

      // Pour les notifications de photos de profil/couverture
      if (['PROFILE_PHOTO_UPDATED', 'COVER_PHOTO_UPDATED'].includes(notification.type)) {
        enriched.previewImage = notification.additionalData?.get('image');
      }

      // Pour les notifications de commentaires
      if (['COMMENT_LIKE', 'COMMENT_MENTION'].includes(notification.type)) {
        if (notification.postId && notification.commentId) {
          const comment = notification.postId.comments.id(notification.commentId);
          if (comment) {
            enriched.commentContent = comment.content;
            // Si le post a une image, on l'ajoute aussi
            enriched.previewImage = notification.postId.image;
          }
        }
      }

      return enriched;
    }));

    console.log('Enriched notifications:', enrichedNotifications);
    res.json(enrichedNotifications);
  } catch (error) {
    console.error('Error in getNotifications:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des notifications' });
  }
};

// Obtenir le nombre de notifications non lues
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    res.json({ count });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({ message: 'Erreur lors du comptage des notifications' });
  }
};

// Marquer une notification comme lue
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.notificationId,
        recipient: req.user._id
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Error in markAsRead:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la notification' });
  }
};

// Marquer toutes les notifications comme lues
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );

    res.json({ message: 'Toutes les notifications ont été marquées comme lues' });
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour des notifications' });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};
