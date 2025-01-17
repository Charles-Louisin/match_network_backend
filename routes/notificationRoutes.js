const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

// Routes protégées par authentification
router.use(auth);

// Récupérer toutes les notifications
router.get('/', notificationController.getNotifications);

// Marquer une notification comme lue
router.post('/:notificationId/read', notificationController.markAsRead);

module.exports = router;
