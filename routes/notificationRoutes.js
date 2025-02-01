const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Routes protégées par authentification
router.use(protect);

// Créer une notification
router.post('/', async (req, res) => {
  try {
    const { type, recipientId, content, reference, postId, commentId, additionalData } = req.body;
    const senderId = req.user._id;

    console.log('Creating notification:', {
      type,
      senderId,
      recipientId,
      content,
      reference,
      postId,
      commentId,
      additionalData
    });

    const notification = await notificationController.createNotification(
      type,
      senderId,
      recipientId,
      content,
      reference,
      {
        postId,
        commentId,
        additionalData
      }
    );

    if (!notification) {
      console.log('No notification created - might be self-notification or error');
      return res.status(400).json({ message: 'Impossible de créer la notification' });
    }

    console.log('Notification created successfully:', notification);
    res.status(201).json(notification);
  } catch (error) {
    console.error('Error in notification creation route:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la notification', error: error.message });
  }
});

// Récupérer toutes les notifications
router.get('/', notificationController.getNotifications);

// Obtenir le nombre de notifications non lues
router.get('/unread/count', notificationController.getUnreadCount);

// Marquer une notification comme lue
router.post('/:notificationId/read', notificationController.markAsRead);

// Marquer toutes les notifications comme lues
router.post('/read/all', notificationController.markAllAsRead);

module.exports = router;
