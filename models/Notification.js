const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'FRIEND_REQUEST',
        'FRIEND_REQUEST_ACCEPTED',
        'POST_LIKE',
        'POST_COMMENT',
        'POST_CREATED',
        'PROFILE_PHOTO_UPDATED',
        'COVER_PHOTO_UPDATED',
        'COMMENT_LIKE',
        'COMMENT_MENTION',
        'POST_TAG'
      ],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
    additionalData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map(),
    },
  },
  { timestamps: true }
);

// Index pour améliorer les performances des requêtes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
