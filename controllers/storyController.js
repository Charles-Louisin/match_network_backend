const Story = require('../models/Story')
const User = require('../models/User')

const storyController = {
  // Créer une story
  createStory: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Une image est requise' })
      }

      const story = await Story.create({
        user: req.user._id,
        image: `/uploads/${req.file.filename}`
      })

      const populatedStory = await Story.findById(story._id)
        .populate('user', 'username avatar')

      res.status(201).json(populatedStory)
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  // Récupérer les stories
  getStories: async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
      const userIds = [...user.friends, req.user._id]

      // Récupérer les stories non expirées
      const stories = await Story.find({
        user: { $in: userIds },
        expiresAt: { $gt: new Date() }
      })
        .populate('user', 'username avatar')
        .sort('-createdAt')

      // Grouper les stories par utilisateur
      const groupedStories = stories.reduce((acc, story) => {
        const userId = story.user._id.toString()
        if (!acc[userId]) {
          acc[userId] = {
            user: story.user,
            stories: []
          }
        }
        acc[userId].stories.push(story)
        return acc
      }, {})

      res.json(Object.values(groupedStories))
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  // Voir une story
  viewStory: async (req, res) => {
    try {
      const story = await Story.findById(req.params.id)
      
      if (!story) {
        return res.status(404).json({ message: 'Story non trouvée' })
      }

      if (!story.viewers.includes(req.user._id)) {
        story.viewers.push(req.user._id)
        await story.save()
      }

      res.json(story)
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  }
}

module.exports = storyController;