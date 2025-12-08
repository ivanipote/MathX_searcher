/**
 * page-navigation.js - Navigation SPA avec persistance d'état
 * Remplace les rechargements de page par des transitions fluides
 */

class PageNavigation {
    constructor() {
        this.currentPage = window.location.pathname;
        this.history = [];
        this.cache = new Map();
        this.isNavigating = false;
        this.transitionDuration = 300;
        
        this.init();
    }
    
    init() {
        console.log('🧭 Initialisation PageNavigation...');
        
        // Intercepter les clics sur les liens
        this.setupLinkInterception();
        
        // Gérer le bouton retour/avant
        window.addEventListener('popstate', (e) => this.handlePopState(e));
        
        // Sauvegarder l'état initial
        this.saveInitialState();
        
        // Restaurer l'état si on revient sur la page
        if (performance.navigation.type === performance.navigation.TYPE_BACK_FORWARD) {
            setTimeout(() => this.restorePageState(), 100);
        }
    }
    
    // ================= INTERCEPTION DES LIENS =================
    
    setupLinkInterception() {
        document.addEventListener('click', (e) => {
            const link = this.findNavigableLink(e.target);
            if (link && !this.isNavigating) {
                e.preventDefault();
                e.stopPropagation();
                this.navigateTo(link.href, link);
            }
        }, true); // Capture phase pour intercepter tôt
    }
    
    findNavigableLink(element) {
        // Rechercher un lien dans l'arbre
        const link = element.closest('a');
        if (!link) return null;
        
        const href = link.getAttribute('href');
        
        // Vérifier si c'est un lien navigable
        return this.isNavigableLink(link, href) ? link : null;
    }
    
    isNavigableLink(link, href) {
        // Ne pas intercepter :
        // - Liens externes
        // - Liens avec target="_blank"
        // - Liens de téléchargement
        // - Liens d'ancres (#)
        // - Liens spéciaux (mailto:, tel:, javascript:)
        
        if (!href) return false;
        if (link.target === '_blank') return false;
        if (link.hasAttribute('download')) return false;
        if (href.startsWith('http') && !href.includes(window.location.hostname)) return false;
        if (href.startsWith('//')) return false;
        if (href.startsWith('mailto:')) return false;
        if (href.startsWith('tel:')) return false;
        if (href.startsWith('javascript:')) return false;
        if (href.startsWith('#')) return false;
        
        return true;
    }
    
    // ================= NAVIGATION =================
    
    async navigateTo(url, linkElement) {
        if (this.isNavigating) return;
        
        this.isNavigating = true;
        console.log('🧭 Navigation vers:', url);
        
        // Sauvegarder l'état actuel AVANT de naviguer
        if (window.StateManager) {
            window.StateManager.forceSave();
        }
        
        const targetUrl = new URL(url, window.location.origin);
        const currentUrl = new URL(window.location.href);
        
        // Si c'est la même page avec un hash différent, gérer le scroll
        if (targetUrl.pathname === currentUrl.pathname && targetUrl.hash) {
            this.handleSamePageNavigation(targetUrl);
            this.isNavigating = false;
            return;
        }
        
        // Afficher l'indicateur de chargement
        this.showLoading();
        
        try {
            // 1. Récupérer le contenu (depuis cache ou fetch)
            const html = await this.fetchPageContent(targetUrl);
            
            // 2. Mettre à jour l'URL sans recharger
            window.history.pushState({ 
                url: targetUrl.href,
                timestamp: Date.now(),
                from: currentUrl.href 
            }, '', targetUrl.href);
            
            // 3. Mettre à jour le contenu
            await this.updatePageContent(html, targetUrl);
            
            // 4. Mettre à jour l'état interne
            this.currentPage = targetUrl.pathname;
            this.history.push({
                url: targetUrl.href,
                timestamp: Date.now(),
                from: currentUrl.href
            });
            
            // 5. Restaurer l'état sauvegardé si disponible
            if (window.StateManager) {
                setTimeout(() => {
                    window.StateManager.setCurrentPage(this.getPageName(targetUrl.pathname));
                    window.StateManager.restoreCurrentPageState();
                }, 100);
            }
            
            console.log('✅ Navigation réussie vers:', targetUrl.pathname);
            
        } catch (error) {
            console.error('❌ Erreur navigation:', error);
            // Fallback : navigation traditionnelle
            window.location.href = url;
        } finally {
            this.hideLoading();
            this.isNavigating = false;
        }
    }
    
    // ================= GESTION DU CONTENU =================
    
    async fetchPageContent(url) {
        // Vérifier le cache
        const cacheKey = url.pathname;
        if (this.cache.has(cacheKey)) {
            console.log('📦 Contenu récupéré du cache:', cacheKey);
            return this.cache.get(cacheKey);
        }
        
        // Fetch depuis le serveur
        try {
            console.log('🌐 Fetch contenu:', url.href);
            const response = await fetch(url.href, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                cache: 'force-cache'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const html = await response.text();
            
            // Mettre en cache
            this.cache.set(cacheKey, html);
            
            // Limiter la taille du cache
            if (this.cache.size > 10) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            
            return html;
            
        } catch (error) {
            console.error('❌ Erreur fetch:', error);
            throw error;
        }
    }
    
    async updatePageContent(html, targetUrl) {
        // Parser le HTML
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');
        
        // Extraire le contenu principal
        const newMain = newDoc.querySelector('main');
        const newTitle = newDoc.querySelector('title');
        
        if (!newMain) {
            throw new Error('Pas de contenu principal trouvé');
        }
        
        // Animation de transition
        await this.animateTransition();
        
        // Mettre à jour le titre
        if (newTitle) {
            document.title = newTitle.textContent;
        }
        
        // Mettre à jour le contenu principal
        const currentMain = document.querySelector('main');
        currentMain.innerHTML = newMain.innerHTML;
        
        // Mettre à jour les scripts
        this.updateScripts(newDoc);
        
        // Mettre à jour les styles
        this.updateStyles(newDoc);
        
        // Déclencher les événements de mise à jour
        this.triggerPageUpdate();
        
        // Scroll vers le haut
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    updateScripts(newDoc) {
        // Supprimer les anciens scripts dynamiques
        document.querySelectorAll('script[data-dynamic="true"]').forEach(script => {
            script.remove();
        });
        
        // Ajouter les nouveaux scripts
        newDoc.querySelectorAll('script').forEach(script => {
            if (script.src && !document.querySelector(`script[src="${script.src}"]`)) {
                const newScript = document.createElement('script');
                newScript.src = script.src;
                newScript.defer = script.defer;
                newScript.async = script.async;
                newScript.setAttribute('data-dynamic', 'true');
                document.body.appendChild(newScript);
            } else if (script.textContent) {
                // Script inline
                try {
                    const executeScript = new Function(script.textContent);
                    setTimeout(executeScript, 0);
                } catch (error) {
                    console.warn('⚠️ Erreur exécution script inline:', error);
                }
            }
        });
    }
    
    updateStyles(newDoc) {
        // Ajouter les nouveaux styles
        newDoc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            if (!document.querySelector(`link[href="${link.href}"]`)) {
                document.head.appendChild(link.cloneNode(true));
            }
        });
        
        // Styles inline
        newDoc.querySelectorAll('style').forEach(style => {
            if (!document.querySelector(`style[data-content="${style.textContent.slice(0, 50)}"]`)) {
                const newStyle = document.createElement('style');
                newStyle.textContent = style.textContent;
                newStyle.setAttribute('data-dynamic', 'true');
                document.head.appendChild(newStyle);
            }
        });
    }
    
    // ================= GESTION ÉTAT =================
    
    saveInitialState() {
        // Capturer l'état initial de la page
        const initialState = {
            url: window.location.href,
            scrollY: window.scrollY,
            timestamp: Date.now(),
            searchInput: document.getElementById('mainSearchInput')?.value || '',
            filters: this.captureFilters()
        };
        
        // Sauvegarder dans history state
        window.history.replaceState({
            ...window.history.state,
            initialState: initialState
        }, '');
        
        // Sauvegarder dans StateManager si disponible
        if (window.StateManager) {
            window.StateManager.savePageState();
            window.StateManager.saveToStorage();
        }
    }
    
    async restorePageState() {
        console.log('🔄 Restauration état page...');
        
        // Restaurer depuis StateManager
        if (window.StateManager) {
            return window.StateManager.restoreCurrentPageState();
        }
        
        return false;
    }
    
    captureFilters() {
        const filters = {};
        document.querySelectorAll('.filter-input:checked').forEach(input => {
            const filterName = input.closest('.filter-checkbox').dataset.filter;
            filters[filterName] = true;
        });
        return filters;
    }
    
    // ================= ANIMATIONS & UI =================
    
    async animateTransition() {
        return new Promise(resolve => {
            // Ajouter une classe de transition
            document.documentElement.classList.add('page-transition');
            
            setTimeout(() => {
                document.documentElement.classList.remove('page-transition');
                resolve();
            }, this.transitionDuration);
        });
    }
    
    showLoading() {
        let loader = document.getElementById('page-navigation-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'page-navigation-loader';
            loader.className = 'page-navigation-loader';
            loader.innerHTML = `
                <div class="navigation-spinner"></div>
                <div class="navigation-text">Chargement...</div>
            `;
            document.body.appendChild(loader);
            
            // Styles inline
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(5px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            const spinner = loader.querySelector('.navigation-spinner');
            spinner.style.cssText = `
                width: 50px;
                height: 50px;
                border: 4px solid #e2e8f0;
                border-top: 4px solid #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 1rem;
            `;
        }
        
        loader.style.display = 'flex';
        setTimeout(() => {
            loader.style.opacity = '1';
        }, 10);
    }
    
    hideLoading() {
        const loader = document.getElementById('page-navigation-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 300);
        }
    }
    
    // ================= GESTION POPSTATE =================
    
    handlePopState(e) {
        console.log('↩️ Popstate détecté:', e.state);
        
        // Si on a un état sauvegardé, restaurer
        if (e.state && e.state.initialState && window.StateManager) {
            setTimeout(() => {
                window.StateManager.restoreCurrentPageState();
            }, 50);
        }
        
        // Mettre à jour la page courante
        this.currentPage = window.location.pathname;
        
        // Déclencher l'événement de restauration
        document.dispatchEvent(new CustomEvent('pageRestored', {
            detail: { url: window.location.href }
        }));
    }
    
    handleSamePageNavigation(targetUrl) {
        // Juste mettre à jour l'URL et scroll vers l'ancre
        window.history.pushState({}, '', targetUrl.href);
        
        const targetElement = document.querySelector(targetUrl.hash);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // ================= UTILITAIRES =================
    
    getPageName(pathname) {
        const pageMap = {
            '/': 'index',
            '/index.html': 'index',
            '/profil.html': 'profil',
            '/auth.html': 'auth',
            '/exercise.html': 'exercise',
            '/contact.html': 'contact',
            '/apropos.html': 'apropos',
            '/confidentialite.html': 'confidentialite'
        };
        
        return pageMap[pathname] || 'unknown';
    }
    
    triggerPageUpdate() {
        // Déclencher un événement pour notifier les autres scripts
        const event = new CustomEvent('pageContentUpdated', {
            detail: {
                page: this.currentPage,
                timestamp: Date.now(),
                url: window.location.href
            }
        });
        document.dispatchEvent(event);
        
        // Déclencher DOMContentLoaded pour les nouveaux scripts
        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    }
    
    // ================= API PUBLIQUE =================
    
    goBack() {
        window.history.back();
    }
    
    goForward() {
        window.history.forward();
    }
    
    refresh() {
        this.cache.delete(this.currentPage);
        this.navigateTo(window.location.href);
    }
    
    clearCache() {
        this.cache.clear();
        console.log('🧹 Cache vidé');
    }
    
    getCurrentPage() {
        return this.currentPage;
    }
    
    getHistory() {
        return [...this.history];
    }
}

// Singleton global
let pageNavigation = null;

function initPageNavigation() {
    if (!pageNavigation) {
        pageNavigation = new PageNavigation();
        window.PageNavigation = pageNavigation;
        console.log('✅ PageNavigation initialisé');
    }
    return pageNavigation;
}

// Auto-initialisation
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initPageNavigation, 1000);
    });
} else {
    setTimeout(initPageNavigation, 1000);
}

// Export
window.initPageNavigation = initPageNavigation;