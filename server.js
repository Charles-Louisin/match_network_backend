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
const notificationRoutes = require('./routes/notificationRoutes')

const app = express()

// CORS configuration
const allowedOrigins = [
  'https://match-network.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://www.match-network.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    // Permettre les requêtes sans origine (comme les applications mobiles ou postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}))

// Enable pre-flight requests
app.options('*', cors())

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
mongoose.set('debug', false) // Désactiver les logs de débogage
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  keepAlive: true,
  keepAliveInitialDelay: 300000
})
.then(() => console.log('Connecté à MongoDB'))
.catch((err) => console.error('Erreur de connexion MongoDB:', err))

// Gérer les événements de connexion MongoDB
mongoose.connection.on('connected', () => {
  console.log('Mongoose connecté à MongoDB')
})

mongoose.connection.on('error', (err) => {
  console.error('Erreur de connexion Mongoose:', err)
})

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose déconnecté de MongoDB')
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/stories', storyRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)

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