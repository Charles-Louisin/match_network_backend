const mongoose = require('mongoose')

const storySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'text'],
    required: true
  },
  media: {
    type: String,
    required: function() {
      return this.type === 'image' || this.type === 'video'
    }
  },
  textContent: {
    type: {
      text: {
        type: String,
        required: function() {
          return this.parent().parent().type === 'text'
        }
      },
      background: {
        type: String,
        required: function() {
          return this.parent().parent().type === 'text'
        }
      },
      color: {
        type: String,
        default: '#FFFFFF'
      },
      fontFamily: {
        type: String,
        default: 'Arial'
      }
    },
    required: function() {
      return this.type === 'text'
    }
  },
  caption: {
    type: String,
    trim: true
  },
  viewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  expiresAt: {
    type: Date,
    default: function() {
      const date = new Date()
      date.setHours(date.getHours() + 24)
      return date
    }
  }
}, {
  timestamps: true
})

const Story = mongoose.model('Story', storySchema)
module.exports = Story