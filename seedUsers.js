require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const users = [
  {
    username: 'alice',
    email: 'alice@example.com',
    password: 'password123',
    gender: 'female',
    avatar: '/images/default-avatar.jpg',
    coverPhoto: '/images/default-cover.jpg',
    bio: 'Salut, je suis Alice !',
    location: 'Paris'
  },
  {
    username: 'bob',
    email: 'bob@example.com',
    password: 'password123',
    gender: 'male',
    avatar: '/images/default-avatar.jpg',
    coverPhoto: '/images/default-cover.jpg',
    bio: 'Salut, je suis Bob !',
    location: 'Lyon'
  },
  {
    username: 'charlie',
    email: 'charlie@example.com',
    password: 'password123',
    gender: 'male',
    avatar: '/images/default-avatar.jpg',
    coverPhoto: '/images/default-cover.jpg',
    bio: 'Salut, je suis Charlie !',
    location: 'Marseille'
  }
];

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Supprimer les utilisateurs existants
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Hasher les mots de passe et créer les utilisateurs
    const hashedUsers = await Promise.all(users.map(async user => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      return { ...user, password: hashedPassword };
    }));

    // Insérer les nouveaux utilisateurs
    const createdUsers = await User.insertMany(hashedUsers);
    console.log('Created users:', createdUsers.map(u => u.username));

    mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();
