const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Routes protégées par authentification
router.use(protect);

// Récupérer toutes les notifications
router.get('/', notificationController.getNotifications);

// Obtenir le nombre de notifications non lues
router.get('/unread/count', notificationController.getUnreadCount);

// Marquer une notification comme lue
router.post('/:notificationId/read', notificationController.markAsRead);

// Marquer toutes les notifications comme lues
router.post('/read/all', notificationController.markAllAsRead);

module.exports = router;
