const mongoose = require('mongoose')

const storySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: {
    type: String,
    required: true
  },
  viewers: [{
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