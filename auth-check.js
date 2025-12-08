/**
 * auth-check.js - Vérification d'authentification et mise à jour des liens
 */

// Fonction pour afficher un message temporaire
function showAuthMessage(message, isConnected) {
    // Supprimer les anciens messages
    const oldMessages = document.querySelectorAll('.auth-message');
    oldMessages.forEach(msg => msg.remove());
    
    // Créer le message
    const messageDiv = document.createElement('div');
    messageDiv.className = `auth-message ${isConnected ? 'connected' : 'disconnected'}`;
    messageDiv.innerHTML = `
        <i class="fas ${isConnected ? 'fa-check-circle' : 'fa-user-slash'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(messageDiv);
    
    // Auto-suppression après 5 secondes
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Fonction pour mettre à jour le lien Profil
function updateProfileLink(user) {
    const profileTab = document.getElementById('profileTab');
    if (!profileTab) return;
    
    if (user) {
        // Utilisateur connecté
        profileTab.href = 'profil.html';
        profileTab.innerHTML = '<i class="fas fa-user"></i><span class="tab-label">Profil</span>';
        console.log('✅ Lien Profil mis à jour vers profil.html');
    } else {
        // Utilisateur non connecté
        profileTab.href = 'auth.html';
        profileTab.innerHTML = '<i class="fas fa-user"></i><span class="tab-label">Profil</span>';
        console.log('✅ Lien Profil mis à jour vers auth.html');
    }
}

// Vérifier l'authentification
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔐 Vérification de l\'authentification...');
    
    // Attendre que Firebase soit chargé
    const checkFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            clearInterval(checkFirebase);
            
            // Surveiller les changements d'état
            firebase.auth().onAuthStateChanged(function(user) {
                console.log('👤 État auth changé:', user ? user.email : 'null');
                
                // Mettre à jour le lien
                updateProfileLink(user);
                
                // Afficher message
                if (user) {
                    showAuthMessage(`Connecté en tant que ${user.email}`, true);
                } else {
                    showAuthMessage('Non connecté. Cliquez sur "Profil" pour vous connecter', false);
                }
                
                // Sauvegarder l'état après changement d'auth
                if (window.PageStateManager) {
                    setTimeout(() => {
                        window.PageStateManager.saveCurrentState();
                    }, 500);
                }
            });
            
            // Vérifier l'état actuel
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
                console.log('✅ Utilisateur déjà connecté:', currentUser.email);
                updateProfileLink(currentUser);
                showAuthMessage(`Bienvenue ${currentUser.email} !`, true);
            } else {
                console.log('👤 Aucun utilisateur connecté');
                updateProfileLink(null);
                showAuthMessage('Non connecté. Cliquez sur "Profil" pour vous connecter', false);
            }
        }
    }, 100);
    
    // Timeout de sécurité
    setTimeout(() => {
        clearInterval(checkFirebase);
    }, 5000);
});

// Exporter les fonctions
window.showAuthMessage = showAuthMessage;
window.updateProfileLink = updateProfileLink;