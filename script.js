/**
 * script.js - Logique UI générale de mathX_searcher
 * Responsabilités : Sidebar, overlay, interactions basiques
 * NE PAS mettre la logique de recherche/filtres ici
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 script.js - Initialisation UI');
    
    // Éléments DOM
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    // Vérification que les éléments existent
    if (!sidebarToggle || !sidebarClose || !sidebar || !overlay) {
        console.error('❌ Éléments UI manquants dans le DOM');
        return;
    }
    
    /**
     * OUVERTURE de la sidebar
     */
    sidebarToggle.addEventListener('click', function() {
        console.log('📱 Ouverture sidebar');
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    /**
     * FERMETURE de la sidebar
     */
    function closeSidebar() {
        console.log('📱 Fermeture sidebar');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Fermer avec le bouton
    sidebarClose.addEventListener('click', closeSidebar);
    
    // Fermer en cliquant sur l'overlay
    overlay.addEventListener('click', closeSidebar);
    
    /**
     * Fermer avec la touche ÉCHAP
     */
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
    
    /**
     * Gestion des états actifs dans la navigation bas
     * Marque l'onglet correspondant à la page actuelle
     */
    function marquerOngletActif() {
        const pageActuelle = window.location.pathname.split('/').pop() || 'index.html';
        const navTabs = document.querySelectorAll('.nav-tab');
        
        navTabs.forEach(tab => {
            const href = tab.getAttribute('href');
            if (href === pageActuelle) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }
    
    // Appeler au chargement
    marquerOngletActif();
    
    /**
     * Feedback visuel sur les interactions
     */
    function ajouterFeedbackInteractions() {
        // Feedback sur les checkbox de filtres
        const filterCheckboxes = document.querySelectorAll('.filter-checkbox');
        filterCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('click', function() {
                const customCheckbox = this.querySelector('.filter-custom-checkbox');
                if (customCheckbox) {
                    customCheckbox.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        customCheckbox.style.transform = 'scale(1)';
                    }, 150);
                }
            });
        });
    }
    
    ajouterFeedbackInteractions();
    
    console.log('✅ script.js - UI initialisée avec succès');
});
