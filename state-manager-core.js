/**
 * state-manager-core.js - Système de persistance universel
 * À inclure sur TOUTES les pages HTML
 */

// Classe principale - Doit être identique sur toutes les pages
class UniversalStateManager {
    constructor() {
        this.currentPage = this.getPageName();
        this.states = new Map();
        this.saveTimeout = null;
        this.storageSaveTimeout = null;
        this.isRestoring = false;
        this.initialized = false;
        
        this.init();
    }
    
    init() {
        if (this.initialized) return;
        
        console.log(`💾 UniversalStateManager - ${this.currentPage}`);
        
        // Charger les états
        this.loadFromStorage();
        
        // Configurer les écouteurs génériques
        this.setupUniversalListeners();
        
        // Détection de page spécifique
        this.setupPageSpecificListeners();
        
        // Gestion de visibilité
        this.setupVisibilityHandler();
        
        // Gestion historique
        this.setupHistoryHandler();
        
        // Sauvegarde avant déchargement
        this.setupBeforeUnload();
        
        // Auto-sauvegarde
        this.startAutoSave();
        
        this.initialized = true;
        
        // Restaurer après un court délai
        setTimeout(() => this.restoreState(), 200);
    }
    
    // ================= IDENTIFICATION DE PAGE =================
    
    getPageName() {
        const path = window.location.pathname;
        const pageMap = {
            '/': 'index',
            '/index.html': 'index',
            '/profil.html': 'profil',
            '/auth.html': 'auth',
            '/exercise.html': 'exercise',
            '/contact.html': 'contact',
            '/apropos.html': 'apropos',
            '/confidentialite.html': 'confidentialite',
            '/fav.html': 'favorites',
            '/his.html': 'history',
            '/para.html': 'settings'
        };
        
        // Détection automatique si non dans la map
        if (pageMap[path]) {
            return pageMap[path];
        }
        
        // Extraction du nom de fichier
        const filename = path.split('/').pop().replace('.html', '');
        return filename || 'index';
    }
    
    getPageType() {
        const page = this.currentPage;
        if (page === 'index') return 'search';
        if (page === 'profil') return 'profile';
        if (page === 'auth') return 'auth';
        if (page === 'exercise') return 'exercises';
        return 'generic';
    }
    
    // ================= ÉCOUTEURS UNIVERSELS =================
    
    setupUniversalListeners() {
        // Tous les inputs textuels
        document.addEventListener('input', (e) => {
            if (e.target.matches('input[type="text"], input[type="search"], input[type="email"], textarea')) {
                this.debouncedSave();
                this.showSavingIndicator();
            }
        }, true);
        
        // Tous les checkboxes et radios
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="checkbox"], input[type="radio"], select')) {
                this.debouncedSave();
                this.showSavingIndicator();
            }
        }, true);
        
        // Scroll avec debounce
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.saveScrollPosition();
            }, 300);
        });
        
        // Focus pour sauvegarder l'élément actif
        document.addEventListener('focusin', (e) => {
            if (e.target.id || e.target.name) {
                this.debouncedSave();
            }
        }, true);
        
        // Clics sur les éléments interactifs
        document.addEventListener('click', (e) => {
            const interactiveSelectors = [
                '.tab-active', '.active', '[data-selected="true"]',
                '.accordion-open', 'details[open] summary',
                '.modal-open', '.sidebar-open'
            ].join(', ');
            
            if (e.target.matches(interactiveSelectors) || e.target.closest(interactiveSelectors)) {
                setTimeout(() => this.saveCurrentState(), 150);
            }
        }, true);
    }
    
    setupPageSpecificListeners() {
        // Configuration par type de page
        switch(this.getPageType()) {
            case 'search':
                this.setupSearchPageListeners();
                break;
            case 'profile':
                this.setupProfilePageListeners();
                break;
            case 'auth':
                this.setupAuthPageListeners();
                break;
            case 'exercises':
                this.setupExercisesPageListeners();
                break;
            default:
                this.setupGenericPageListeners();
        }
    }
    
    setupSearchPageListeners() {
        // Recherche principale
        const mainSearch = document.getElementById('mainSearchInput');
        if (mainSearch) {
            mainSearch.addEventListener('input', () => this.debouncedSave());
        }
        
        // Filtres
        document.querySelectorAll('.filter-input').forEach(input => {
            input.addEventListener('change', () => this.debouncedSave());
        });
        
        // Suggestions
        document.addEventListener('click', (e) => {
            if (e.target.matches('.suggestion-tag, .search-suggestion')) {
                setTimeout(() => this.saveCurrentState(), 300);
            }
        });
    }
    
    setupProfilePageListeners() {
        // Données profil
        document.querySelectorAll('#userName, #userLevel, #userEmail').forEach(input => {
            if (input) input.addEventListener('input', () => this.debouncedSave());
        });
        
        // Sidebar profil
        const sidebar = document.getElementById('profileSidebar');
        if (sidebar) {
            const observer = new MutationObserver(() => this.debouncedSave());
            observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
        }
    }
    
    setupAuthPageListeners() {
        // Tous les champs d'authentification
        document.querySelectorAll('#loginEmail, #loginPassword, #signupFirstName, #signupLastName, #signupEmail, #signupPassword').forEach(input => {
            if (input) input.addEventListener('input', () => this.debouncedSave());
        });
        
        // Onglets auth
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                setTimeout(() => this.saveCurrentState(), 100);
            });
        });
    }
    
    setupExercisesPageListeners() {
        // Exercices - à adapter selon votre structure
        document.addEventListener('change', (e) => {
            if (e.target.matches('.exercise-checkbox, .answer-input, .difficulty-select')) {
                this.debouncedSave();
            }
        });
    }
    
    setupGenericPageListeners() {
        // Pour les pages génériques (contact, about, etc.)
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('input', () => this.debouncedSave());
        });
    }
    
    // ================= SAUVEGARDE =================
    
    saveCurrentState(immediate = false) {
        if (this.isRestoring) return;
        
        try {
            const state = {
                timestamp: Date.now(),
                pageType: this.getPageType(),
                url: window.location.href,
                scroll: window.scrollY,
                formData: this.captureFormData(),
                uiState: this.captureUIState(),
                pageSpecific: this.capturePageSpecificState(),
                focusedElement: this.captureFocusedElement(),
                activeTabs: this.captureActiveTabs()
            };
            
            this.states.set(this.currentPage, state);
            
            if (immediate) {
                this.saveToStorage();
            } else {
                this.debouncedStorageSave();
            }
            
            console.log(`💾 ${this.currentPage} sauvegardé`);
            
            return state;
            
        } catch (error) {
            console.warn(`⚠️ Erreur sauvegarde ${this.currentPage}:`, error);
            return null;
        }
    }
    
    captureFormData() {
        const formData = {};
        
        // Tous les inputs avec valeur
        document.querySelectorAll('input, textarea, select').forEach(element => {
            const name = element.id || element.name || `element_${Math.random().toString(36).substr(2, 9)}`;
            
            if (element.type === 'checkbox' || element.type === 'radio') {
                formData[name] = element.checked;
            } else if (element.type === 'file') {
                // Ignorer les fichiers
            } else if (element.value && element.value.trim() !== '') {
                formData[name] = element.value;
            }
        });
        
        return formData;
    }
    
    captureUIState() {
        const uiState = {
            activeClasses: [],
            hiddenElements: [],
            expandedElements: []
        };
        
        // Éléments avec classe active
        document.querySelectorAll('.active, .selected, [data-active="true"]').forEach(el => {
            if (el.id) uiState.activeClasses.push(el.id);
        });
        
        // Éléments cachés
        document.querySelectorAll('[style*="display: none"], [hidden]').forEach(el => {
            if (el.id && getComputedStyle(el).display === 'none') {
                uiState.hiddenElements.push(el.id);
            }
        });
        
        // Détails ouverts
        document.querySelectorAll('details[open]').forEach(details => {
            if (details.id) uiState.expandedElements.push(details.id);
        });
        
        return uiState;
    }
    
    capturePageSpecificState() {
        const pageType = this.getPageType();
        const state = {};
        
        switch(pageType) {
            case 'search':
                state.searchValue = document.getElementById('mainSearchInput')?.value || '';
                state.filters = this.captureFilters();
                state.resultsVisible = document.getElementById('resultsContainer')?.style.display !== 'none';
                break;
                
            case 'auth':
                state.activeTab = document.querySelector('.auth-tab.active')?.dataset.tab || 'login';
                break;
                
            case 'profile':
                state.sidebarOpen = document.getElementById('profileSidebar')?.classList.contains('active') || false;
                break;
        }
        
        return state;
    }
    
    captureFilters() {
        const filters = {};
        document.querySelectorAll('.filter-input').forEach(input => {
            const filterName = input.closest('.filter-checkbox')?.dataset.filter || 
                              input.name || 
                              input.id;
            if (filterName) {
                filters[filterName] = input.checked;
            }
        });
        return filters;
    }
    
    captureFocusedElement() {
        const active = document.activeElement;
        if (!active) return null;
        
        return {
            id: active.id,
            name: active.name,
            tagName: active.tagName,
            type: active.type
        };
    }
    
    captureActiveTabs() {
        const tabs = {};
        document.querySelectorAll('.nav-tab.active, .tab-active').forEach(tab => {
            const tabName = tab.textContent?.trim() || tab.dataset.tab || tab.id;
            if (tabName) tabs[tabName] = true;
        });
        return tabs;
    }
    
    saveScrollPosition() {
        const state = this.states.get(this.currentPage);
        if (state) {
            state.scroll = window.scrollY;
            state.timestamp = Date.now();
        }
    }
    
    debouncedSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveCurrentState();
        }, 1000);
    }
    
    debouncedStorageSave() {
        clearTimeout(this.storageSaveTimeout);
        this.storageSaveTimeout = setTimeout(() => {
            this.saveToStorage();
        }, 3000);
    }
    
    // ================= RESTAURATION =================
    
    restoreState() {
        if (this.isRestoring) return false;
        
        try {
            this.isRestoring = true;
            
            const state = this.states.get(this.currentPage);
            if (!state) {
                console.log(`ℹ️ Aucun état pour ${this.currentPage}`);
                this.isRestoring = false;
                return false;
            }
            
            console.log(`🔄 Restauration ${this.currentPage}...`);
            
            // Restaurer dans l'ordre avec délais
            setTimeout(() => this.restoreFormData(state.formData), 50);
            setTimeout(() => this.restoreUIState(state.uiState), 100);
            setTimeout(() => this.restorePageSpecificState(state.pageSpecific), 150);
            setTimeout(() => this.restoreScrollPosition(state.scroll), 200);
            setTimeout(() => this.restoreActiveTabs(state.activeTabs), 250);
            setTimeout(() => {
                this.restoreFocusedElement(state.focusedElement);
                this.isRestoring = false;
                this.showRestoredIndicator();
            }, 300);
            
            return true;
            
        } catch (error) {
            console.warn(`⚠️ Erreur restauration ${this.currentPage}:`, error);
            this.isRestoring = false;
            return false;
        }
    }
    
    restoreFormData(formData) {
        if (!formData) return;
        
        Object.entries(formData).forEach(([name, value]) => {
            // Essayer plusieurs sélecteurs
            const selectors = [
                `#${name}`,
                `[name="${name}"]`,
                `[data-id="${name}"]`
            ];
            
            let element = null;
            for (const selector of selectors) {
                element = document.querySelector(selector);
                if (element) break;
            }
            
            if (element) {
                if (element.type === 'checkbox' || element.type === 'radio') {
                    element.checked = Boolean(value);
                } else if (element.tagName === 'SELECT') {
                    element.value = value;
                } else {
                    element.value = value;
                }
                
                // Déclencher les événements
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    
    restoreUIState(uiState) {
        if (!uiState) return;
        
        // Restaurer les éléments cachés
        if (uiState.hiddenElements) {
            uiState.hiddenElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.style.display = 'none';
                }
            });
        }
        
        // Restaurer les détails ouverts
        if (uiState.expandedElements) {
            uiState.expandedElements.forEach(id => {
                const details = document.getElementById(id);
                if (details && details.tagName === 'DETAILS') {
                    details.open = true;
                }
            });
        }
    }
    
    restorePageSpecificState(pageSpecific) {
        if (!pageSpecific) return;
        
        const pageType = this.getPageType();
        
        switch(pageType) {
            case 'search':
                this.restoreSearchState(pageSpecific);
                break;
            case 'auth':
                this.restoreAuthState(pageSpecific);
                break;
        }
    }
    
    restoreSearchState(state) {
        // Restaurer la recherche
        const searchInput = document.getElementById('mainSearchInput');
        if (searchInput && state.searchValue) {
            searchInput.value = state.searchValue;
            
            // Déclencher la recherche après délai
            if (state.searchValue.trim() && window.RechercheEngine) {
                setTimeout(() => {
                    if (typeof window.RechercheEngine.rechercher === 'function') {
                        window.RechercheEngine.rechercher(state.searchValue);
                    }
                }, 500);
            }
        }
        
        // Restaurer les filtres
        if (state.filters) {
            setTimeout(() => {
                Object.entries(state.filters).forEach(([filterName, isChecked]) => {
                    const selectors = [
                        `[data-filter="${filterName}"] input`,
                        `#${filterName}`,
                        `[name="${filterName}"]`
                    ];
                    
                    for (const selector of selectors) {
                        const input = document.querySelector(selector);
                        if (input && input.type === 'checkbox') {
                            input.checked = isChecked;
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            break;
                        }
                    }
                });
            }, 300);
        }
        
        // Restaurer la visibilité des résultats
        if (state.resultsVisible !== undefined) {
            const results = document.getElementById('resultsContainer');
            const welcome = document.getElementById('welcomeState');
            
            if (results && welcome) {
                results.style.display = state.resultsVisible ? 'block' : 'none';
                welcome.style.display = state.resultsVisible ? 'none' : 'block';
            }
        }
    }
    
    restoreAuthState(state) {
        // Restaurer l'onglet actif
        if (state.activeTab && state.activeTab !== 'login') {
            const tab = document.querySelector(`.auth-tab[data-tab="${state.activeTab}"]`);
            if (tab) {
                setTimeout(() => tab.click(), 200);
            }
        }
    }
    
    restoreScrollPosition(scrollY) {
        if (!scrollY || scrollY <= 0) return;
        
        document.documentElement.classList.add('scroll-restoring');
        
        window.scrollTo({
            top: scrollY,
            behavior: 'auto'
        });
        
        setTimeout(() => {
            document.documentElement.classList.remove('scroll-restoring');
        }, 100);
    }
    
    restoreActiveTabs(activeTabs) {
        if (!activeTabs) return;
        
        Object.keys(activeTabs).forEach(tabName => {
            const selectors = [
                `.nav-tab[href*="${tabName}"]`,
                `[data-tab="${tabName}"]`,
                `#${tabName}`,
                `.tab-${tabName}`
            ];
            
            for (const selector of selectors) {
                const tab = document.querySelector(selector);
                if (tab && !tab.classList.contains('active')) {
                    tab.classList.add('active');
                    break;
                }
            }
        });
    }
    
    restoreFocusedElement(focusedElement) {
        if (!focusedElement || !focusedElement.id) return;
        
        const element = document.getElementById(focusedElement.id);
        if (element && element.focus) {
            setTimeout(() => element.focus(), 400);
        }
    }
    
    // ================= GESTION STORAGE =================
    
  // ================= GESTION STORAGE =================
    
    saveToStorage() {
        try {
            const data = {
                pageStates: Object.fromEntries(this.states),
                currentPage: this.currentPage,
                timestamp: Date.now(),
                appVersion: '1.0'
            };
            
            localStorage.setItem('mathx_universal_states', JSON.stringify(data));
            
        } catch (error) {
            console.warn('⚠️ Erreur sauvegarde storage:', error);
        }
    }
    
    loadFromStorage() {
        try {
            const dataStr = localStorage.getItem('mathx_universal_states');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                this.states = new Map(Object.entries(data.pageStates || {}));
                this.currentPage = data.currentPage || this.currentPage;
                
                console.log('📂 États chargés:', this.states.size, 'pages');
                
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Erreur chargement storage:', error);
        }
        return false;
    }
    
    clearStorage() {
        try {
            localStorage.removeItem('mathx_universal_states');
            this.states.clear();
            console.log('🧹 États effacés');
        } catch (error) {
            console.warn('⚠️ Erreur effacement storage:', error);
        }
    }
    
    // ================= GESTION VISIBILITÉ =================
    
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('👁️ Page redevenue visible');
                setTimeout(() => this.restoreState(), 150);
            } else {
                this.saveCurrentState();
            }
        });
    }
    
    setupHistoryHandler() {
        window.addEventListener('popstate', () => {
            console.log('↩️ Navigation historique');
            setTimeout(() => {
                this.currentPage = this.getPageName();
                this.restoreState();
            }, 100);
        });
        
        // Restaurer au retour arrière
        if (performance.navigation.type === performance.navigation.TYPE_BACK_FORWARD) {
            console.log('🔙 Retour navigation détecté');
            setTimeout(() => this.restoreState(), 250);
        }
    }
    
    setupBeforeUnload() {
        window.addEventListener('beforeunload', () => {
            this.saveCurrentState(true);
        });
    }
    
    startAutoSave() {
        setInterval(() => {
            if (!this.isRestoring) {
                this.saveCurrentState();
            }
        }, 45000); // 45 secondes
    }
    
    // ================= UTILITAIRES UI =================
    
    showSavingIndicator() {
        let indicator = document.getElementById('universalSavingIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'universalSavingIndicator';
            indicator.className = 'state-saving-indicator';
            indicator.innerHTML = '<i class="fas fa-save"></i> Sauvegarde...';
            document.body.appendChild(indicator);
        }
        
        indicator.classList.add('show');
        
        clearTimeout(this.indicatorTimeout);
        this.indicatorTimeout = setTimeout(() => {
            indicator.classList.remove('show');
        }, 1200);
    }
    
    showRestoredIndicator() {
        document.documentElement.classList.add('state-restored');
        
        setTimeout(() => {
            document.documentElement.classList.remove('state-restored');
        }, 1200);
        
        console.log(`✅ ${this.currentPage} restauré`);
    }
    
    // ================= API PUBLIQUE =================
    
    getCurrentState() {
        return this.states.get(this.currentPage) || {};
    }
    
    forceSave() {
        this.saveCurrentState(true);
    }
    
    forceRestore() {
        return this.restoreState();
    }
    
    hasState(pageName = this.currentPage) {
        return this.states.has(pageName);
    }
    
    clearPageState(pageName = this.currentPage) {
        this.states.delete(pageName);
        this.saveToStorage();
        console.log(`🗑️ État effacé pour ${pageName}`);
    }
    
    getAllStates() {
        return Object.fromEntries(this.states);
    }
    
    exportStates() {
        return JSON.stringify(this.getAllStates(), null, 2);
    }
    
    importStates(jsonString) {
        try {
            const states = JSON.parse(jsonString);
            this.states = new Map(Object.entries(states));
            this.saveToStorage();
            console.log('📥 États importés:', this.states.size);
            return true;
        } catch (error) {
            console.error('❌ Erreur import états:', error);
            return false;
        }
    }
}

// ================= INITIALISATION UNIVERSELLE =================

let universalStateManager = null;

function initUniversalStateManager() {
    if (!universalStateManager) {
        universalStateManager = new UniversalStateManager();
        window.UniversalStateManager = universalStateManager;
        console.log('🌍 UniversalStateManager initialisé');
    }
    return universalStateManager;
}

// Initialisation automatique
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initUniversalStateManager, 500);
    });
} else {
    setTimeout(initUniversalStateManager, 500);
}

// Export pour usage global
window.initUniversalStateManager = initUniversalStateManager;
window.getUniversalStateManager = () => universalStateManager;