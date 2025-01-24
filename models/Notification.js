const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['POST_CREATED', 'PROFILE_PHOTO_UPDATED', 'COVER_PHOTO_UPDATED', 'POST_COMMENT', 'POST_LIKE', 'FRIEND_REQUEST', 'FRIEND_ACCEPT'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
