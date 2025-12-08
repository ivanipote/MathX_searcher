/**
 * state-manager.js - Système de persistance d'état pour mathX_searcher
 * Mémorise l'état exact de chaque page (recherche, scroll, filtres, etc.)
 */

class StateManager {
    constructor() {
        this.currentPage = 'index';
        this.pageStates = new Map();
        this.scrollPositions = new Map();
        this.formStates = new Map();
        this.lastUpdate = Date.now();
        this.autoSaveInterval = null;
        
        this.init();
    }
    
    init() {
        console.log('💾 Initialisation StateManager...');
        
        // Charger les états sauvegardés
        this.loadFromStorage();
        
        // Écouter les changements de page
        this.setupPageListeners();
        
        // Sauvegarde automatique toutes les 30 secondes
        this.autoSaveInterval = setInterval(() => this.saveToStorage(), 30000);
        
        // Sauvegarder avant déchargement
        window.addEventListener('beforeunload', () => this.saveToStorage());
        
        // Restaurer l'état au retour sur l'onglet
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('👁️ Onglet redevenu visible, restauration de l\'état...');
                this.restoreCurrentPageState();
            }
        });
    }
    
    // ================= GESTION DES PAGES =================
    
    setCurrentPage(pageName) {
        if (this.currentPage !== pageName) {
            // Sauvegarder l'état de la page actuelle avant de changer
            this.savePageState(this.currentPage);
            this.currentPage = pageName;
            console.log(`📄 Changement vers page: ${pageName}`);
        }
    }
    
    // ================= SAUVEGARDE D'ÉTAT =================
    
    savePageState(pageName = this.currentPage) {
        try {
            const state = {
                timestamp: Date.now(),
                url: window.location.href,
                searchInput: this.captureSearchInput(),
                filters: this.captureFilters(),
                scrollPosition: window.scrollY,
                activeElements: this.captureActiveElements(),
                formData: this.captureFormData()
            };
            
            this.pageStates.set(pageName, state);
            this.scrollPositions.set(pageName, window.scrollY);
            
            console.log(`💾 État sauvegardé pour ${pageName}:`, {
                search: state.searchInput,
                scroll: state.scrollPosition
            });
            
            return state;
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde état:', error);
            return null;
        }
    }
    
    restorePageState(pageName = this.currentPage) {
        try {
            const state = this.pageStates.get(pageName);
            if (!state) {
                console.log(`ℹ️ Aucun état sauvegardé pour ${pageName}`);
                return false;
            }
            
            console.log(`🔄 Restauration état pour ${pageName}:`, {
                search: state.searchInput,
                scroll: state.scrollPosition
            });
            
            // Restaurer la recherche
            if (state.searchInput && pageName === 'index') {
                this.restoreSearchInput(state.searchInput);
            }
            
            // Restaurer les filtres
            if (state.filters) {
                this.restoreFilters(state.filters);
            }
            
            // Restaurer les données de formulaire
            if (state.formData) {
                this.restoreFormData(state.formData);
            }
            
            // Restaurer la position de scroll (après un délai)
            setTimeout(() => {
                const savedScroll = this.scrollPositions.get(pageName) || 0;
                window.scrollTo({
                    top: savedScroll,
                    behavior: 'instant'
                });
                console.log(`📜 Scroll restauré à: ${savedScroll}px`);
            }, 100);
            
            // Restaurer les éléments actifs
            if (state.activeElements) {
                this.restoreActiveElements(state.activeElements);
            }
            
            this.lastUpdate = Date.now();
            return true;
            
        } catch (error) {
            console.error('❌ Erreur restauration état:', error);
            return false;
        }
    }
    
    restoreCurrentPageState() {
        return this.restorePageState(this.currentPage);
    }
    
    // ================= CAPTURE DES DONNÉES =================
    
    captureSearchInput() {
        try {
            const searchInput = document.getElementById('mainSearchInput');
            if (searchInput) {
                return {
                    value: searchInput.value,
                    placeholder: searchInput.placeholder,
                    selectionStart: searchInput.selectionStart,
                    selectionEnd: searchInput.selectionEnd
                };
            }
            return null;
        } catch {
            return null;
        }
    }
    
    captureFilters() {
        try {
            const filters = {};
            document.querySelectorAll('.filter-input:checked').forEach(input => {
                const filterName = input.closest('.filter-checkbox').dataset.filter;
                filters[filterName] = true;
            });
            return filters;
        } catch {
            return {};
        }
    }
    
    captureFormData() {
        try {
            const formData = {};
            document.querySelectorAll('input, textarea, select').forEach(input => {
                if (input.id && input.value) {
                    formData[input.id] = input.value;
                }
            });
            return formData;
        } catch {
            return {};
        }
    }
    
    captureActiveElements() {
        try {
            const active = {
                focused: document.activeElement?.id || null,
                expanded: []
            };
            
            // Capturer les éléments dépliés (details, accordions)
            document.querySelectorAll('details[open]').forEach(details => {
                active.expanded.push(details.id || details.querySelector('summary')?.textContent);
            });
            
            return active;
        } catch {
            return {};
        }
    }
    
    // ================= RESTAURATION DES DONNÉES =================
    
    restoreSearchInput(searchState) {
        try {
            const searchInput = document.getElementById('mainSearchInput');
            if (searchInput && searchState.value) {
                searchInput.value = searchState.value;
                
                // Restaurer la sélection du texte
                setTimeout(() => {
                    if (searchInput.setSelectionRange) {
                        searchInput.setSelectionRange(
                            searchState.selectionStart || 0,
                            searchState.selectionEnd || 0
                        );
                    }
                }, 10);
                
                console.log('🔍 Recherche restaurée:', searchState.value);
                
                // Déclencher la recherche si nécessaire
                if (searchState.value.trim() && window.RechercheEngine) {
                    setTimeout(() => {
                        if (typeof window.RechercheEngine.rechercher === 'function') {
                            window.RechercheEngine.rechercher(searchState.value);
                        }
                    }, 200);
                }
            }
        } catch (error) {
            console.warn('⚠️ Erreur restauration recherche:', error);
        }
    }
    
    restoreFilters(filters) {
        try {
            document.querySelectorAll('.filter-input').forEach(input => {
                const filterName = input.closest('.filter-checkbox').dataset.filter;
                input.checked = filters[filterName] || false;
                
                // Déclencher l'événement change
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
            console.log('🎛️ Filtres restaurés:', filters);
        } catch (error) {
            console.warn('⚠️ Erreur restauration filtres:', error);
        }
    }
    
    restoreFormData(formData) {
        try {
            Object.entries(formData).forEach(([id, value]) => {
                const input = document.getElementById(id);
                if (input) {
                    input.value = value;
                }
            });
        } catch (error) {
            console.warn('⚠️ Erreur restauration formulaire:', error);
        }
    }
    
    restoreActiveElements(active) {
        try {
            // Restaurer le focus
            if (active.focused) {
                const element = document.getElementById(active.focused);
                if (element) {
                    setTimeout(() => element.focus(), 100);
                }
            }
            
            // Restaurer les éléments dépliés
            if (active.expanded && active.expanded.length > 0) {
                active.expanded.forEach(id => {
                    const details = document.getElementById(id) || 
                                   document.querySelector(`details:has(summary:contains("${id}"))`);
                    if (details) {
                        details.open = true;
                    }
                });
            }
        } catch (error) {
            console.warn('⚠️ Erreur restauration éléments actifs:', error);
        }
    }
    
    // ================= STORAGE LOCAL =================
    
    saveToStorage() {
        try {
            const data = {
                pageStates: Object.fromEntries(this.pageStates),
                scrollPositions: Object.fromEntries(this.scrollPositions),
                currentPage: this.currentPage,
                timestamp: Date.now()
            };
            
            localStorage.setItem('mathx_page_states', JSON.stringify(data));
            console.log('💾 États sauvegardés dans localStorage');
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde storage:', error);
        }
    }
    
    loadFromStorage() {
        try {
            const dataStr = localStorage.getItem('mathx_page_states');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                
                // Restaurer les maps
                this.pageStates = new Map(Object.entries(data.pageStates || {}));
                this.scrollPositions = new Map(Object.entries(data.scrollPositions || {}));
                this.currentPage = data.currentPage || 'index';
                
                console.log('📂 États chargés depuis localStorage:', {
                    pages: this.pageStates.size,
                    current: this.currentPage
                });
                
                return true;
            }
        } catch (error) {
            console.error('❌ Erreur chargement storage:', error);
        }
        return false;
    }
    
    clearStorage() {
        try {
            localStorage.removeItem('mathx_page_states');
            this.pageStates.clear();
            this.scrollPositions.clear();
            console.log('🧹 États effacés');
        } catch (error) {
            console.error('❌ Erreur effacement storage:', error);
        }
    }
    
    // ================= ÉCOUTEURS =================
    
    setupPageListeners() {
        // Écouter les changements dans la recherche
        const searchInput = document.getElementById('mainSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.savePageState();
            });
        }
        
        // Écouter les changements de filtres
        document.querySelectorAll('.filter-input').forEach(input => {
            input.addEventListener('change', () => {
                this.savePageState();
            });
        });
        
        // Écouter le scroll (debounced)
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.scrollPositions.set(this.currentPage, window.scrollY);
            }, 200);
        });
        
        // Écouter les changements de focus
        document.addEventListener('focusin', (e) => {
            if (e.target.id) {
                this.savePageState();
            }
        }, true);
        
        // Écouter les soumissions de formulaire
        document.addEventListener('submit', () => {
            this.savePageState();
        });
    }
    
    // ================= API PUBLIQUE =================
    
    getCurrentState() {
        return this.pageStates.get(this.currentPage) || {};
    }
    
    hasSavedState(pageName) {
        return this.pageStates.has(pageName);
    }
    
    forceSave() {
        this.savePageState();
        this.saveToStorage();
        console.log('💾 Sauvegarde forcée effectuée');
    }
    
    forceRestore() {
        return this.restoreCurrentPageState();
    }
    
    // Destruction propre
    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        this.saveToStorage();
    }
}

// Singleton global
let stateManager = null;

function initStateManager() {
    if (!stateManager) {
        stateManager = new StateManager();
        window.StateManager = stateManager;
        console.log('✅ StateManager initialisé');
    }
    return stateManager;
}

// Auto-initialisation
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initStateManager, 500);
    });
} else {
    setTimeout(initStateManager, 500);
}

// Export
window.initStateManager = initStateManager;