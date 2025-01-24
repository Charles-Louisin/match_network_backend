const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Timeout augmenté à 30 secondes
      socketTimeoutMS: 45000, // Timeout pour les opérations
      connectTimeoutMS: 30000,
      // Options de reconnexion
      autoReconnect: true,
      reconnectTries: Number.MAX_VALUE,
      reconnectInterval: 500, // Reconnexion toutes les 500ms
    })
    
    // Gestion des événements de connexion
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connecté à MongoDB')
    })

    mongoose.connection.on('error', (err) => {
      console.error('Erreur de connexion Mongoose:', err)
    })

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose déconnecté de MongoDB')
    })

    console.log(`MongoDB connecté: ${conn.connection.host}`)
  } catch (error) {
    console.error(`Erreur: ${error.message}`)
    process.exit(1)
  }
}

module.exports = connectDB