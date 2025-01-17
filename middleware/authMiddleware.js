const jwt = require('jsonwebtoken')
const User = require('../models/User')

const protect = async (req, res, next) => {
  let token

  console.log('Auth Headers:', req.headers.authorization)

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1]
      console.log('Token extracted:', token)

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log('Decoded token:', decoded)

      const user = await User.findById(decoded.id).select('-password')
      console.log('Found user:', user)

      if (!user) {
        console.log('No user found with id:', decoded.id)
        return res.status(401).json({ message: 'Utilisateur non trouvé' })
      }

      req.user = user
      next()
    } catch (error) {
      console.error('Auth error:', error)
      return res.status(401).json({ message: 'Non autorisé, token invalide', error: error.message })
    }
  }

  if (!token) {
    console.log('No token provided in request')
    return res.status(401).json({ message: 'Non autorisé, pas de token' })
  }
}

module.exports = { protect }