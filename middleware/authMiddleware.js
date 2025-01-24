const jwt = require('jsonwebtoken')
const User = require('../models/User')

const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1]

      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      const user = await User.findById(decoded.id)
        .select('-password')
        .lean() // Utiliser lean() pour de meilleures performances

      if (!user) {
        console.error('No user found with id:', decoded.id)
        return res.status(401).json({ message: 'Utilisateur non trouvé' })
      }

      req.user = user
      next()
    } catch (error) {
      console.error('Auth error:', error.message)
      return res.status(401).json({ message: 'Non autorisé, token invalide' })
    }
  } else if (!token) {
    return res.status(401).json({ message: 'Non autorisé, pas de token' })
  }
}

module.exports = { protect }