const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const mongoose = require('mongoose');
const Notification = require('../models/Notification'); // Ajouter cette ligne

// Vérifier le statut d'une demande d'ami
router.get('/pending/:userId/status', auth, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId;

        // Vérifier si une demande existe déjà
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { sender: currentUserId, recipient: targetUserId },
                { sender: targetUserId, recipient: currentUserId }
            ],
            status: 'pending'
        });

        res.json({
            hasPendingRequest: !!existingRequest,
            requestDetails: existingRequest ? {
                sender: existingRequest.sender,
                recipient: existingRequest.recipient,
                createdAt: existingRequest.createdAt
            } : null
        });
    } catch (error) {
        console.error('Erreur lors de la vérification du statut de la demande:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir la liste des amis
router.get('/list', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('friends', 'username email avatar');
        res.json(user.friends);
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir les demandes d'ami en attente
router.get('/pending', auth, async (req, res) => {
    try {
        const requests = await FriendRequest.find({
            $or: [
                { recipient: req.user.id },
                { sender: req.user.id }
            ],
            status: 'pending'
        })
        .populate('sender', 'username email profilePicture')
        .populate('recipient', 'username email profilePicture');
        
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Récupérer les demandes d'ami en attente
router.get('/requests/pending', auth, async (req, res) => {
    try {
        const pendingRequests = await FriendRequest.find({
            $or: [
                { recipient: req.user.id },
                { sender: req.user.id }
            ],
            status: 'pending'
        })
        .populate('sender', 'username avatar _id')
        .populate('recipient', 'username avatar _id');

        // Formater les données pour inclure l'URL complète de l'avatar
        const formattedRequests = pendingRequests.map(request => ({
            _id: request._id,
            sender: {
                _id: request.sender._id,
                username: request.sender.username,
                avatar: request.sender.avatar,
            },
            recipient: {
                _id: request.recipient._id,
                username: request.recipient.username,
                avatar: request.recipient.avatar,
            },
            status: request.status,
            createdAt: request.createdAt,
            // Ajouter un champ pour indiquer si l'utilisateur actuel est l'expéditeur
            isCurrentUserSender: request.sender._id.toString() === req.user.id
        }));

        res.json(formattedRequests);
    } catch (error) {
        console.error('Erreur lors de la récupération des demandes en attente:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Envoyer une demande d'ami
router.post('/request/:userId', auth, async (req, res) => {
    try {
        const senderId = req.user.id;
        const recipientId = req.params.userId;

        // Vérifier que l'utilisateur n'envoie pas une demande à lui-même
        if (senderId === recipientId || senderId.toString() === recipientId) {
            return res.status(400).json({ message: 'Vous ne pouvez pas vous envoyer une demande d\'ami' });
        }

        // Vérifier si le destinataire existe
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Vérifier si les utilisateurs sont déjà amis
        const sender = await User.findById(senderId);
        if (sender.friends.includes(recipientId)) {
            return res.status(400).json({ message: 'Vous êtes déjà amis avec cet utilisateur' });
        }

        // Vérifier si une demande existe déjà
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { sender: senderId, recipient: recipientId },
                { sender: recipientId, recipient: senderId }
            ],
            status: 'pending'
        });

        if (existingRequest) {
            if (existingRequest.sender.toString() === senderId) {
                return res.status(400).json({ message: 'Vous avez déjà envoyé une demande à cet utilisateur' });
            } else {
                return res.status(400).json({ message: 'Cet utilisateur vous a déjà envoyé une demande' });
            }
        }

        // Créer la nouvelle demande
        await FriendRequest.create({
            sender: senderId,
            recipient: recipientId,
            status: 'pending'
        });

        // Envoyer une réponse de succès
        return res.status(200).json({ message: 'Invitation envoyée avec succès' });

    } catch (error) {
        console.error('Erreur lors de l\'envoi de la demande:', error);
        // En cas d'erreur de type, on renvoie un message plus clair
        if (error.name === 'CastError') {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        // Pour toute autre erreur, on renvoie un message générique
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Accepter une demande d'ami
router.post('/accept/:requestId', auth, async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const currentUserId = req.user.id;

        // Trouver la demande d'ami
        const friendRequest = await FriendRequest.findById(requestId);
        
        // Si la demande n'existe pas, vérifier si les utilisateurs sont déjà amis
        if (!friendRequest) {
            const currentUser = await User.findById(currentUserId);
            const otherUserId = req.body.senderId; // L'ID de l'autre utilisateur devrait être fourni dans le corps
            
            if (currentUser.friends.includes(otherUserId)) {
                return res.json({ message: 'Vous êtes déjà amis' });
            }
            
            return res.json({ message: 'Demande acceptée avec succès' });
        }

        // Vérifier que l'utilisateur actuel est bien le destinataire
        if (friendRequest.recipient.toString() !== currentUserId) {
            return res.status(403).json({ message: 'Non autorisé à accepter cette demande' });
        }

        // Ajouter les utilisateurs comme amis
        const sender = await User.findById(friendRequest.sender);
        const recipient = await User.findById(friendRequest.recipient);

        if (!sender.friends.includes(recipient._id)) {
            sender.friends.push(recipient._id);
            await sender.save();
        }

        if (!recipient.friends.includes(sender._id)) {
            recipient.friends.push(sender._id);
            await recipient.save();
        }

        // Supprimer la demande d'ami
        await FriendRequest.findByIdAndDelete(requestId);

        res.json({ message: 'Demande acceptée avec succès' });
    } catch (error) {
        console.error('Erreur lors de l\'acceptation de la demande:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'acceptation de la demande' });
    }
});

// Rejeter une demande d'ami
router.post('/reject/:requestId', auth, async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const currentUserId = req.user.id;

        // Trouver la demande d'ami
        const friendRequest = await FriendRequest.findById(requestId);
        if (!friendRequest) {
            // Si la demande n'existe pas, on considère que c'est un succès
            return res.json({ message: 'Demande d\'ami rejetée avec succès' });
        }

        // Vérifier que l'utilisateur actuel est bien le destinataire
        if (friendRequest.recipient.toString() !== currentUserId) {
            return res.status(403).json({ message: 'Non autorisé à rejeter cette demande' });
        }

        // Supprimer la demande au lieu de la marquer comme rejetée
        await FriendRequest.findByIdAndDelete(requestId);

        res.json({ message: 'Demande d\'ami rejetée avec succès' });
    } catch (error) {
        console.error('Erreur lors du rejet de la demande:', error);
        res.status(500).json({ message: 'Erreur serveur lors du rejet de la demande' });
    }
});

// Supprimer un ami et toutes les demandes associées
router.delete('/:friendId', auth, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const friendId = req.params.friendId;

        // 1. Supprimer l'ami des deux côtés
        await User.findByIdAndUpdate(currentUserId, {
            $pull: { friends: friendId }
        });
        await User.findByIdAndUpdate(friendId, {
            $pull: { friends: currentUserId }
        });

        // 2. Supprimer TOUTES les demandes d'ami entre ces utilisateurs (peu importe le statut)
        await FriendRequest.deleteMany({
            $or: [
                { sender: currentUserId, recipient: friendId },
                { sender: friendId, recipient: currentUserId }
            ]
        });

        res.json({ message: 'Ami et toutes les demandes associées supprimés avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression' });
    }
});

// Supprimer une demande d'ami
router.delete('/request/:userId', auth, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId;

        await FriendRequest.deleteMany({
            $or: [
                { sender: currentUserId, recipient: targetUserId },
                { sender: targetUserId, recipient: currentUserId }
            ],
            status: 'pending'
        });

        res.json({ message: 'Demande(s) supprimée(s)' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la demande:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Annuler une demande d'ami
router.post('/request/:userId/cancel', auth, async (req, res) => {
    try {
        const senderId = req.user.id;
        const recipientId = req.params.userId;

        // Trouver et supprimer la demande
        const request = await FriendRequest.findOneAndDelete({
            sender: senderId,
            recipient: recipientId,
            status: 'pending'
        });

        if (!request) {
            return res.status(404).json({ message: 'Demande non trouvée' });
        }

        res.json({ message: 'Demande annulée avec succès' });
    } catch (error) {
        console.error('Erreur lors de l\'annulation de la demande:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Vérifier le statut d'amitié avec un utilisateur
router.get('/status/:userId', auth, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId;

        // Vérifier si c'est le même utilisateur
        if (currentUserId === targetUserId) {
            return res.json({
                status: 'self',
                isFriend: false
            });
        }

        // Vérifier s'ils sont amis
        const currentUser = await User.findById(currentUserId);
        const isFriend = currentUser.friends.includes(targetUserId);

        if (isFriend) {
            return res.json({
                status: 'friends',
                isFriend: true
            });
        }

        // Vérifier s'il y a une demande en attente
        const pendingRequest = await FriendRequest.findOne({
            $or: [
                { sender: currentUserId, recipient: targetUserId },
                { sender: targetUserId, recipient: currentUserId }
            ],
            status: 'pending'
        });

        if (pendingRequest) {
            const status = pendingRequest.sender.toString() === currentUserId 
                ? 'pending_sent' 
                : 'pending_received';
            return res.json({
                status: status,
                isFriend: false
            });
        }

        // Aucune relation trouvée
        return res.json({
            status: 'none',
            isFriend: false
        });
    } catch (error) {
        console.error('Erreur lors de la vérification du statut d\'ami:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;