/**
 * page-configs.js - Configurations spécifiques par page
 */

const PageConfigs = {
    // Configuration pour index.html
    index: {
        elementsToPersist: [
            '#mainSearchInput',
            '.filter-input',
            '#resultsContainer',
            '#welcomeState'
        ],
        eventsToCapture: ['input', 'change', 'scroll'],
        autoRestoreDelay: 200,
        saveDebounceTime: 800
    },
    
    // Configuration pour auth.html
    auth: {
        elementsToPersist: [
            '#loginEmail',
            '#loginPassword',
            '#signupFirstName',
            '#signupLastName',
            '#signupEmail',
            '#signupPassword',
            '.auth-tab'
        ],
        eventsToCapture: ['input', 'click'],
        autoRestoreDelay: 300,
        saveDebounceTime: 1000
    },
    
    // Configuration pour profil.html
    profil: {
        elementsToPersist: [
            '#profileSidebar',
            '.user-info',
            '.nav-link.active'
        ],
        eventsToCapture: ['click', 'input'],
        autoRestoreDelay: 250,
        saveDebounceTime: 600
    },
    
    // Configuration pour exercise.html
    exercise: {
        elementsToPersist: [
            '.exercise-item',
            '.answer-input',
            '.difficulty-select',
            '.progress-bar'
        ],
        eventsToCapture: ['input', 'change', 'click'],
        autoRestoreDelay: 350,
        saveDebounceTime: 1200
    },
    
    // Configuration par défaut pour les autres pages
    default: {
        elementsToPersist: [
            'input',
            'textarea',
            'select',
            '.active',
            '.selected'
        ],
        eventsToCapture: ['input', 'change', 'click'],
        autoRestoreDelay: 150,
        saveDebounceTime: 500
    }
};

// Fonction pour obtenir la configuration de la page courante
function getPageConfig() {
    const path = window.location.pathname;
    
    if (path.includes('index.html') || path === '/' || path === '/index.html') {
        return PageConfigs.index;
    } else if (path.includes('auth.html')) {
        return PageConfigs.auth;
    } else if (path.includes('profil.html')) {
        return PageConfigs.profil;
    } else if (path.includes('exercise.html')) {
        return PageConfigs.exercise;
    } else {
        return PageConfigs.default;
    }
}

// Exporter
window.PageConfigs = PageConfigs;
window.getPageConfig = getPageConfig;