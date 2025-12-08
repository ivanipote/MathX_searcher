/**
 * persistence.js - Système de persistance d'état pour mathX_searcher
 * Sauvegarde et restaure l'état exact de la page
 */

// Gestionnaire d'état principal
class PageStateManager {
    constructor() {
        this.currentPage = 'index';
        this.states = new Map();
        this.saveTimeout = null;
        this.isRestoring = false;
        this.init();
    }
    
    init() {
        console.log('💾 Initialisation PageStateManager...');
        
        // Charger les états sauvegardés
        this.loadFromStorage();
        
        // Configurer les écouteurs
        this.setupListeners();
        
        // Sauvegarde périodique
        this.startAutoSave();
        
        // Restaurer l'état au retour sur l'onglet
        this.setupVisibilityHandler();
        
        // Gérer le bouton retour/avant
        this.setupHistoryHandler();
        
        // Sauvegarder avant déchargement
        this.setupBeforeUnload();
    }
    
    // ================= CONFIGURATION ÉCOUTEURS =================
    
    setupListeners() {
        // Recherche
        const searchInput = document.getElementById('mainSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.debouncedSave();
                this.showSavingIndicator();
            });
            
            searchInput.addEventListener('focus', () => {
                this.saveCurrentState();
            });
        }
        
        // Filtres
        document.querySelectorAll('.filter-input').forEach(input => {
            input.addEventListener('change', () => {
                this.debouncedSave();
                this.showSavingIndicator();
            });
        });
        
        // Scroll (avec debounce)
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.saveScrollPosition();
            }, 250);
        });
        
        // Clics sur les résultats
        document.addEventListener('click', (e) => {
            if (e.target.closest('.formula-card, .result-item')) {
                setTimeout(() => this.saveCurrentState(), 100);
            }
        });
    }
    
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('👁️ Onglet redevenu visible, restauration...');
                setTimeout(() => this.restoreState(), 100);
            }
        });
    }
    
    setupHistoryHandler() {
        window.addEventListener('popstate', () => {
            console.log('↩️ Navigation historique détectée');
            setTimeout(() => this.restoreState(), 150);
        });
        
        // Vérifier si on revient avec le bouton retour
        if (performance.navigation.type === performance.navigation.TYPE_BACK_FORWARD) {
            console.log('🔙 Retour depuis historique');
            setTimeout(() => this.restoreState(), 200);
        }
    }
    
    setupBeforeUnload() {
        window.addEventListener('beforeunload', () => {
            this.saveCurrentState(true); // Sauvegarde synchrone
        });
    }
    
    // ================= SAUVEGARDE =================
    
    saveCurrentState(immediate = false) {
        if (this.isRestoring) return;
        
        try {
            const state = {
                timestamp: Date.now(),
                search: this.getSearchState(),
                filters: this.getFiltersState(),
                scroll: window.scrollY,
                results: this.getResultsState(),
                welcomeVisible: this.isWelcomeVisible(),
                activeElements: this.getActiveElements(),
                url: window.location.href
            };
            
            this.states.set(this.currentPage, state);
            
            if (immediate) {
                this.saveToStorage();
            } else {
                this.debouncedStorageSave();
            }
            
            console.log('💾 État sauvegardé:', {
                page: this.currentPage,
                search: state.search?.value?.substring(0, 30) || 'vide',
                scroll: state.scroll
            });
            
            return state;
            
        } catch (error) {
            console.warn('⚠️ Erreur sauvegarde état:', error);
            return null;
        }
    }
    
    debouncedSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveCurrentState();
        }, 800);
    }
    
    debouncedStorageSave() {
        clearTimeout(this.storageSaveTimeout);
        this.storageSaveTimeout = setTimeout(() => {
            this.saveToStorage();
        }, 2000);
    }
    
    saveScrollPosition() {
        const state = this.states.get(this.currentPage);
        if (state) {
            state.scroll = window.scrollY;
            state.timestamp = Date.now();
        }
    }
    
    // ================= RESTAURATION =================
    
    restoreState() {
        if (this.isRestoring) return false;
        
        try {
            this.isRestoring = true;
            
            const state = this.states.get(this.currentPage);
            if (!state) {
                console.log('ℹ️ Aucun état sauvegardé pour', this.currentPage);
                this.isRestoring = false;
                return false;
            }
            
            console.log('🔄 Restauration état pour:', this.currentPage, state);
            
            // Appliquer les restaurations avec délais
            setTimeout(() => {
                if (state.search) {
                    this.restoreSearchState(state.search);
                }
            }, 50);
            
            setTimeout(() => {
                if (state.filters) {
                    this.restoreFiltersState(state.filters);
                }
            }, 100);
            
            setTimeout(() => {
                if (state.scroll > 0) {
                    this.restoreScrollPosition(state.scroll);
                }
            }, 150);
            
            setTimeout(() => {
                this.restoreUIState(state);
                this.isRestoring = false;
                this.showRestoredIndicator();
            }, 200);
            
            return true;
            
        } catch (error) {
            console.warn('⚠️ Erreur restauration état:', error);
            this.isRestoring = false;
            return false;
        }
    }
    
    // ================= CAPTURE D'ÉTAT =================
    
    getSearchState() {
        const input = document.getElementById('mainSearchInput');
        if (!input) return null;
        
        return {
            value: input.value,
            selectionStart: input.selectionStart,
            selectionEnd: input.selectionEnd,
            hasFocus: document.activeElement === input
        };
    }
    
    getFiltersState() {
        const filters = {};
        document.querySelectorAll('.filter-input').forEach(input => {
            const filterName = input.closest('.filter-checkbox').dataset.filter;
            filters[filterName] = input.checked;
        });
        return filters;
    }
    
    getResultsState() {
        const resultsContainer = document.getElementById('resultsContainer');
        if (!resultsContainer) return null;
        
        return {
            count: resultsContainer.children.length,
            html: resultsContainer.children.length > 0 ? resultsContainer.innerHTML : null,
            visible: resultsContainer.style.display !== 'none'
        };
    }
    
    isWelcomeVisible() {
        const welcome = document.getElementById('welcomeState');
        return welcome ? getComputedStyle(welcome).display !== 'none' : true;
    }
    
    getActiveElements() {
        const active = {
            focused: document.activeElement?.id || null,
            expanded: []
        };
        
        // Capturer les détails ouverts
        document.querySelectorAll('details[open]').forEach(details => {
            active.expanded.push(details.id);
        });
        
        return active;
    }
    
    // ================= RESTAURATION D'ÉTAT =================
    
    restoreSearchState(state) {
        const input = document.getElementById('mainSearchInput');
        if (!input || !state.value) return;
        
        // Restaurer la valeur
        input.value = state.value;
        
        // Restaurer la sélection du curseur
        if (state.selectionStart !== undefined) {
            setTimeout(() => {
                input.setSelectionRange(state.selectionStart, state.selectionEnd);
                if (state.hasFocus) {
                    input.focus();
                }
            }, 10);
        }
        
        console.log('🔍 Recherche restaurée:', state.value.substring(0, 50) + (state.value.length > 50 ? '...' : ''));
        
        // Déclencher la recherche si nécessaire
        if (state.value.trim()) {
            setTimeout(() => {
                if (window.RechercheEngine && typeof window.RechercheEngine.rechercher === 'function') {
                    window.RechercheEngine.rechercher(state.value);
                } else if (typeof window.rech === 'function') {
                    window.rech(state.value);
                }
            }, 400);
        }
    }
    
    restoreFiltersState(filters) {
        let changed = false;
        
        document.querySelectorAll('.filter-input').forEach(input => {
            const filterName = input.closest('.filter-checkbox').dataset.filter;
            if (filters.hasOwnProperty(filterName) && input.checked !== filters[filterName]) {
                input.checked = filters[filterName];
                input.dispatchEvent(new Event('change', { bubbles: true }));
                changed = true;
            }
        });
        
        if (changed) {
            console.log('🎛️ Filtres restaurés:', filters);
        }
    }
    
    restoreScrollPosition(scrollY) {
        // Temporairement désactiver le scroll smooth
        document.documentElement.classList.add('scroll-restoring');
        
        window.scrollTo({
            top: scrollY,
            behavior: 'auto'
        });
        
        setTimeout(() => {
            document.documentElement.classList.remove('scroll-restoring');
        }, 100);
        
        console.log('📜 Scroll restauré à:', scrollY);
    }
    
    restoreUIState(state) {
        // Restaurer la visibilité des sections
        if (state.welcomeVisible !== undefined) {
            const welcome = document.getElementById('welcomeState');
            const results = document.getElementById('resultsContainer');
            
            if (welcome && results) {
                welcome.style.display = state.welcomeVisible ? 'block' : 'none';
                results.style.display = state.welcomeVisible ? 'none' : 'block';
            }
        }
        
        // Restaurer les résultats si disponibles
        if (state.results && state.results.html && state.results.count > 0) {
            setTimeout(() => {
                const resultsContainer = document.getElementById('resultsContainer');
                if (resultsContainer && !resultsContainer.hasChildNodes()) {
                    resultsContainer.innerHTML = state.results.html;
                    console.log('📊 Résultats restaurés:', state.results.count, 'éléments');
                }
            }, 500);
        }
        
        // Restaurer les éléments actifs
        if (state.activeElements) {
            this.restoreActiveElements(state.activeElements);
        }
    }
    
    restoreActiveElements(active) {
        // Focus
        if (active.focused) {
            const element = document.getElementById(active.focused);
            if (element && element.focus) {
                setTimeout(() => element.focus(), 300);
            }
        }
        
        // Éléments dépliés
        if (active.expanded && active.expanded.length > 0) {
            active.expanded.forEach(id => {
                const element = document.getElementById(id);
                if (element && element.tagName === 'DETAILS') {
                    element.open = true;
                }
            });
        }
    }
    
    // ================= STORAGE LOCAL =================
    
    saveToStorage() {
        try {
            const data = {
                pageStates: Object.fromEntries(this.states),
                currentPage: this.currentPage,
                lastSave: Date.now()
            };
            
            localStorage.setItem('mathx_page_states', JSON.stringify(data));
            
        } catch (error) {
            console.warn('⚠️ Erreur sauvegarde storage:', error);
        }
    }
    
    loadFromStorage() {
        try {
            const dataStr = localStorage.getItem('mathx_page_states');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                this.states = new Map(Object.entries(data.pageStates || {}));
                this.currentPage = data.currentPage || 'index';
                
                console.log('📂 États chargés depuis storage:', {
                    pages: this.states.size,
                    current: this.currentPage
                });
                
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Erreur chargement storage:', error);
        }
        return false;
    }
    
    clearStorage() {
        try {
            localStorage.removeItem('mathx_page_states');
            this.states.clear();
            console.log('🧹 États effacés');
        } catch (error) {
            console.warn('⚠️ Erreur effacement storage:', error);
        }
    }
    
    // ================= UTILITAIRES UI =================
    
    showSavingIndicator() {
        let indicator = document.getElementById('stateSavingIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'stateSavingIndicator';
            indicator.className = 'state-saving-indicator';
            indicator.innerHTML = '<i class="fas fa-save"></i> Sauvegarde...';
            document.body.appendChild(indicator);
        }
        
        indicator.classList.add('show');
        
        clearTimeout(this.indicatorTimeout);
        this.indicatorTimeout = setTimeout(() => {
            indicator.classList.remove('show');
        }, 1500);
    }
    
    showRestoredIndicator() {
        // Ajouter une classe pour le feedback visuel
        document.documentElement.classList.add('state-restored');
        
        setTimeout(() => {
            document.documentElement.classList.remove('state-restored');
        }, 1500);
        
        console.log('✅ État restauré avec succès');
    }
    
    // ================= GESTION TEMPORISÉE =================
    
    startAutoSave() {
        // Sauvegarde automatique toutes les 30 secondes
        setInterval(() => {
            if (!this.isRestoring) {
                this.saveCurrentState();
            }
        }, 30000);
    }
    
    // ================= API PUBLIQUE =================
    
    setPage(pageName) {
        if (this.currentPage !== pageName) {
            this.saveCurrentState();
            this.currentPage = pageName;
            console.log('📄 Page changée:', pageName);
        }
    }
    
    getCurrentState() {
        return this.states.get(this.currentPage) || {};
    }
    
    forceSave() {
        this.saveCurrentState(true);
    }
    
    forceRestore() {
        return this.restoreState();
    }
    
    hasStateForPage(pageName) {
        return this.states.has(pageName);
    }
    
    getStateAge(pageName = this.currentPage) {
        const state = this.states.get(pageName);
        if (!state || !state.timestamp) return null;
        return Date.now() - state.timestamp;
    }
}

// ================= INITIALISATION =================

let pageStateManager = null;

function initPageStateManager() {
    if (!pageStateManager) {
        pageStateManager = new PageStateManager();
        window.PageStateManager = pageStateManager;
        console.log('✅ PageStateManager initialisé');
    }
    return pageStateManager;
}

// Initialiser quand KaTeX est chargé
document.addEventListener('DOMContentLoaded', function() {
    console.log('🧮 mathX_searcher - Initialisation persistance...');
    
    const checkKaTeX = setInterval(() => {
        if (typeof katex !== 'undefined') {
            clearInterval(checkKaTeX);
            
            // Initialiser le gestionnaire d'état
            initPageStateManager();
            
            // Précharger les données si disponible
            if (window.RechercheEngine && typeof window.RechercheEngine.prechargerDonnees === 'function') {
                window.RechercheEngine.prechargerDonnees();
            }
            
            // Restaurer l'état après un court délai
            setTimeout(() => {
                if (pageStateManager) {
                    pageStateManager.restoreState();
                }
            }, 300);
        }
    }, 100);
});

// Exporter
window.initPageStateManager = initPageStateManager;