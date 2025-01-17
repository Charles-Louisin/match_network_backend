const jwt = require('jsonwebtoken')
const User = require('../models/User')
const sendEmail = require('../utils/sendEmail')

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  })
}

const authController = {
  // Inscription
  register: async (req, res) => {
    try {
      const { username, email, password, gender } = req.body

      const userExists = await User.findOne({ $or: [{ email }, { username }] })
      if (userExists) {
        return res.status(400).json({ message: "L'utilisateur existe déjà" })
      }

      const user = await User.create({
        username,
        email,
        password,
        gender
      })

      res.status(201).json({
        token: generateToken(user._id),
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar
        }
      })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  // Connexion
  login: async (req, res) => {
    try {
      const { email, password } = req.body

      const user = await User.findOne({ email })
      if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' })
      }

      // Ajout de logs pour le débogage
      console.log('User found:', { id: user._id, username: user.username })
      
      const response = {
        token: generateToken(user._id),
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar
        }
      }

      console.log('Response being sent:', response)
      res.json(response)
    } catch (error) {
      console.error('Login error:', error)
      res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message })
    }
  },

  // Mot de passe oublié
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body
      const user = await User.findOne({ email })
      
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' })
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      user.resetPasswordOtp = otp
      user.resetPasswordExpires = Date.now() + 10 * 60 * 1000 // 10 minutes
      await user.save()

      await sendEmail({
        to: email,
        subject: 'Réinitialisation de mot de passe',
        text: `Votre code de réinitialisation est : ${otp}`
      })

      res.json({ message: 'Code de réinitialisation envoyé par email' })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  // Vérifier OTP
  verifyOTP: async (req, res) => {
    try {
      const { email, otp } = req.body
      const user = await User.findOne({
        email,
        resetPasswordOtp: otp,
        resetPasswordExpires: { $gt: Date.now() }
      })

      if (!user) {
        return res.status(400).json({ message: 'Code invalide ou expiré' })
      }

      res.json({ message: 'Code vérifié avec succès' })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  // Réinitialiser le mot de passe
  resetPassword: async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body
      const user = await User.findOne({
        email,
        resetPasswordOtp: otp,
        resetPasswordExpires: { $gt: Date.now() }
      })

      if (!user) {
        return res.status(400).json({ message: 'Code invalide ou expiré' })
      }

      user.password = newPassword
      user.resetPasswordOtp = undefined
      user.resetPasswordExpires = undefined
      await user.save()

      res.json({ message: 'Mot de passe réinitialisé avec succès' })
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  }
}

module.exports = authController