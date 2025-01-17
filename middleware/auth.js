const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
    try {
        // Vérifier le header Authorization
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'Authentification requise' });
        }

        // Vérifier le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);
        
        // Récupérer l'utilisateur
        const user = await User.findById(decoded.id); 
        console.log('Found user:', user);
        
        if (!user) {
            return res.status(401).json({ message: 'Utilisateur non trouvé' });
        }

        // Ajouter l'utilisateur à la requête
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ message: 'Token invalide' });
    }
}; 