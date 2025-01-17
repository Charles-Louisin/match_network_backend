require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

// Routes
const authRoutes = require('./routes/authRoutes')
const postRoutes = require('./routes/postRoutes')
const storyRoutes = require('./routes/storyRoutes')
const friendRoutes = require('./routes/friendRoutes')
const userRoutes = require('./routes/userRoutes')

const app = express()

// Middleware
app.use(cors({
  origin: ['https://match-network.vercel.app', 'http://localhost:3000', 'https://www.match-network.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

// Configuration des fichiers statiques
const uploadsPath = path.join(__dirname, 'uploads')
const imagesPath = path.join(__dirname, 'public', 'images')

// Créer les dossiers s'ils n'existent pas
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true })
}
if (!fs.existsSync(imagesPath)) {
  fs.mkdirSync(imagesPath, { recursive: true })
}

app.use('/uploads', express.static(uploadsPath))
app.use('/images', express.static(imagesPath))

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connecté à MongoDB'))
.catch((err) => console.error('Erreur de connexion MongoDB:', err))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/stories', storyRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/users', userRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: 'Une erreur est survenue sur le serveur' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`)
})

module.exports = app