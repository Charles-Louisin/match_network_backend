const Story = require('../models/Story')
const User = require('../models/User')

const storyController = {
  // Créer une story
  createStory: async (req, res) => {
    try {
      console.log('=== DÉBUT CRÉATION STORY (BACKEND) ===');
      console.log('Headers reçus:', {
        contentType: req.headers['content-type'],
        authorization: req.headers['authorization'] ? 'Present' : 'Missing'
      });
      console.log('Body reçu:', req.body);
      console.log('Fichier reçu:', req.file);

      const { type, textContent } = req.body;
      console.log('Type de story:', type);

      // Story texte
      if (type === 'text') {
        console.log('Traitement story texte');
        if (!textContent || typeof textContent !== 'object') {
          console.error('Erreur: textContent invalide');
          return res.status(400).json({ 
            message: 'Le contenu texte est requis et doit être un objet' 
          });
        }

        if (!textContent.text || !textContent.background) {
          console.error('Erreur: champs requis manquants');
          return res.status(400).json({ 
            message: 'Le texte et la couleur de fond sont requis' 
          });
        }

        try {
          console.log('Création story texte dans la base de données');
          const story = await Story.create({
            user: req.user._id,
            type: 'text',
            textContent: {
              text: textContent.text,
              background: textContent.background,
              color: textContent.color || '#FFFFFF',
              fontFamily: textContent.fontFamily || 'Arial'
            }
          });

          console.log('Story créée, récupération avec populate');
          const populatedStory = await Story.findById(story._id)
            .populate('user', 'username avatar');

          console.log('Story créée avec succès:', populatedStory);
          console.log('=== FIN CRÉATION STORY (BACKEND) ===');
          return res.status(201).json(populatedStory);
        } catch (error) {
          console.error('Erreur lors de la création de la story:', error);
          return res.status(400).json({ 
            message: 'Erreur lors de la création de la story',
            error: error.message
          });
        }
      }

      // Story média (image/vidéo)
      console.log('Traitement story média');
      if (!req.file) {
        console.error('Erreur: fichier manquant');
        return res.status(400).json({ 
          message: 'Un média est requis pour une story image ou vidéo' 
        });
      }

      console.log('Création story média dans la base de données');
      const story = await Story.create({
        user: req.user._id,
        type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
        media: `/uploads/${req.file.filename}`,
        caption: req.body.caption
      });

      console.log('Story créée, récupération avec populate');
      const populatedStory = await Story.findById(story._id)
        .populate('user', 'username avatar');

      console.log('Story créée avec succès:', populatedStory);
      console.log('=== FIN CRÉATION STORY (BACKEND) ===');
      res.status(201).json(populatedStory);
    } catch (error) {
      console.error('Erreur création story:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ 
        message: 'Erreur lors de la création de la story',
        error: error.message,
        stack: error.stack
      });
    }
  },

  // Récupérer les stories
  getStories: async (req, res) => {
    try {
      console.log('=== DÉBUT RÉCUPÉRATION STORIES (BACKEND) ===');
      const user = await User.findById(req.user._id)
      const userIds = [...user.friends, req.user._id]

      console.log('Récupération des stories non expirées');
      // Récupérer les stories non expirées
      const stories = await Story.find({
        user: { $in: userIds },
        expiresAt: { $gt: new Date() }
      })
        .populate('user', 'username avatar')
        .populate('viewers', 'username avatar')
        .populate('likes', 'username avatar')
        .sort('-createdAt')

      console.log('Grouper les stories par utilisateur');
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

      console.log('Stories récupérées avec succès:', Object.values(groupedStories));
      console.log('=== FIN RÉCUPÉRATION STORIES (BACKEND) ===');
      res.json(Object.values(groupedStories))
    } catch (error) {
      console.error('Erreur récupération stories:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ 
        message: 'Erreur lors de la récupération des stories',
        error: error.message,
        stack: error.stack
      });
    }
  },

  // Voir une story
  viewStory: async (req, res) => {
    try {
      console.log('\n=== DÉBUT VISUALISATION STORY ===');
      console.log('ID Story:', req.params.id);
      console.log('ID Utilisateur:', req.user._id);

      const story = await Story.findById(req.params.id);
      if (!story) {
        console.log('Story non trouvée');
        return res.status(404).json({ message: 'Story non trouvée' });
      }

      // Vérifier si l'utilisateur a déjà vu la story
      const alreadyViewed = story.viewers.includes(req.user._id);
      console.log('Déjà vue ?', alreadyViewed);

      if (!alreadyViewed) {
        console.log('Ajout de la vue');
        story.viewers.push(req.user._id);
        await story.save();
        console.log('Vue ajoutée avec succès');
      }

      const populatedStory = await Story.findById(story._id)
        .populate('user', 'username avatar')
        .populate('viewers', 'username avatar')
        .populate('likes', 'username avatar');

      console.log('Nombre de vues total:', story.viewers.length);
      console.log('=== FIN VISUALISATION STORY ===\n');
      
      res.json(populatedStory);
    } catch (error) {
      console.error('Erreur lors de la visualisation:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Liker une story
  likeStory: async (req, res) => {
    try {
      console.log('\n=== DÉBUT LIKE/UNLIKE STORY ===');
      console.log('ID Story:', req.params.id);
      console.log('ID Utilisateur:', req.user._id);

      const story = await Story.findById(req.params.id);
      if (!story) {
        console.log('Story non trouvée');
        return res.status(404).json({ message: 'Story non trouvée' });
      }

      const likeIndex = story.likes.indexOf(req.user._id);
      const action = likeIndex === -1 ? 'like' : 'unlike';
      console.log('Action:', action);

      if (action === 'like') {
        story.likes.push(req.user._id);
      } else {
        story.likes.splice(likeIndex, 1);
      }

      await story.save();
      console.log(`${action} effectué avec succès`);

      const populatedStory = await Story.findById(story._id)
        .populate('user', 'username avatar')
        .populate('viewers', 'username avatar')
        .populate('likes', 'username avatar');

      console.log('Nombre de likes total:', story.likes.length);
      console.log('=== FIN LIKE/UNLIKE STORY ===\n');

      res.json(populatedStory);
    } catch (error) {
      console.error('Erreur lors du like/unlike:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Supprimer une story
  deleteStory: async (req, res) => {
    try {
      console.log('=== DÉBUT SUPPRESSION STORY (BACKEND) ===');
      const story = await Story.findById(req.params.id)
      
      if (!story) {
        console.error('Erreur: story non trouvée');
        return res.status(404).json({ message: 'Story non trouvée' })
      }

      console.log('Vérification des autorisations');
      if (story.user.toString() !== req.user._id.toString()) {
        console.error('Erreur: non autorisé');
        return res.status(403).json({ message: 'Non autorisé' })
      }

      console.log('Suppression de la story');
      await story.deleteOne()
      console.log('Story supprimée avec succès');
      console.log('=== FIN SUPPRESSION STORY (BACKEND) ===');
      res.json({ message: 'Story supprimée' })
    } catch (error) {
      console.error('Erreur suppression story:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ 
        message: 'Erreur lors de la suppression de la story',
        error: error.message,
        stack: error.stack
      });
    }
  }
}

module.exports = storyController;