// =============================================
// CONFIGURATION GLOBALE
// =============================================
const CONFIG = {
    GITHUB_REPO: 'ivanipote/premium_search',
    FILES_FOLDER: 'files',
    RAW_BASE_URL: 'https://raw.githubusercontent.com/ivanipote/premium_search/main/files/'
};

// =============================================
// NAVIGATION GLOBALE SIMPLIFIÉE
// =============================================
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const sidebarClose = document.getElementById('sidebarClose');

// Initialisation de la navigation
function initNavigation() {
    // Ouvrir le sidebar
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }

    // Fermer le sidebar avec le bouton croix
    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }

    // Fermer le sidebar en cliquant sur l'overlay
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Navigation du sidebar
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPage = this.getAttribute('href');
            if (targetPage && !targetPage.startsWith('#')) {
                closeSidebar();
                setTimeout(() => {
                    window.location.href = targetPage;
                }, 300);
            }
        });
    });

    // Navigation du bas
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPage = this.getAttribute('href');
            if (targetPage && !targetPage.startsWith('#')) {
                window.location.href = targetPage;
            }
        });
    });
}

// Fonction pour fermer le sidebar
function closeSidebar() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}
// =============================================
// GESTIONNAIRE DE FICHIERS AVEC RECHERCHE AVANCÉE
// =============================================
class FileManager {
    constructor() {
        this.files = [];
        this.selectedFile = null;
        this.fileContents = new Map(); // Cache pour le contenu des fichiers
        this.init();
    }

    async init() {
        await this.scanGitHubFiles();
        this.detectPageAndInit();
        this.initFileSelection();
    }

    // Scan automatique du dossier GitHub
    async scanGitHubFiles() {
        try {
            const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/${CONFIG.FILES_FOLDER}`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) throw new Error('Erreur GitHub API');
            
            const data = await response.json();
            this.files = data
                .filter(item => item.type === 'file')
                .map(file => ({
                    name: file.name,
                    type: this.getFileType(file.name),
                    size: file.size,
                    downloadUrl: file.download_url,
                    rawUrl: `${CONFIG.RAW_BASE_URL}${file.name}`,
                    lastModified: new Date().toLocaleDateString('fr-FR'),
                    searchableContent: '' // Sera rempli plus tard
                }));
            
            console.log(`${this.files.length} fichiers chargés`);
            
            // Précharger le contenu des fichiers pour la recherche
            await this.preloadFileContents();
        } catch (error) {
            console.error('Erreur scan GitHub:', error);
            // Fallback: fichiers de test
            this.files = this.getTestFiles();
        }
    }

    // Précharger le contenu des fichiers pour la recherche avancée
    async preloadFileContents() {
        const promises = this.files.map(async (file) => {
            try {
                if (file.type === 'PDF') {
                    // Pour les PDF, on récupère le texte
                    const text = await this.extractPDFText(file.rawUrl);
                    file.searchableContent = text;
                } else if (file.type === 'Texte' || file.type === 'Document') {
                    // Pour les fichiers texte, on récupère le contenu
                    const response = await fetch(file.rawUrl);
                    const text = await response.text();
                    file.searchableContent = text;
                } else {
                    // Pour les autres types, on utilise seulement le nom
                    file.searchableContent = file.name;
                }
            } catch (error) {
                console.error(`Erreur chargement ${file.name}:`, error);
                file.searchableContent = file.name; // Fallback sur le nom
            }
        });
        
        await Promise.allSettled(promises);
        console.log('Contenu des fichiers préchargé pour la recherche');
    }

    // Extraction de texte depuis PDF (version simplifiée)
    async extractPDFText(pdfUrl) {
        try {
            // Pour l'instant, on retourne une chaîne vide
            // Dans une vraie implémentation, on utiliserait pdf.js ou un service similaire
            return '';
        } catch (error) {
            console.error('Erreur extraction PDF:', error);
            return '';
        }
    }

    getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const types = {
            'pdf': 'PDF',
            'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 'webp': 'Image',
            'mp3': 'Audio', 'wav': 'Audio', 'ogg': 'Audio',
            'mp4': 'Vidéo', 'avi': 'Vidéo', 'mov': 'Vidéo',
            'apk': 'Application',
            'txt': 'Texte', 'doc': 'Document', 'docx': 'Document'
        };
        return types[ext] || 'Fichier';
    }

    getFileIcon(type) {
        const icons = {
            'PDF': '📄',
            'Image': '🖼️',
            'Audio': '🎵',
            'Vidéo': '🎬',
            'Application': '📱',
            'Document': '📝',
            'Fichier': '📎'
        };
        return icons[type] || '📎';
    }

    // RECHERCHE AVANCÉE : recherche dans le nom ET le contenu
    searchFiles(query) {
        if (!query.trim()) return [];
        
        const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        
        return this.files.filter(file => {
            // Recherche dans le nom du fichier
            const fileNameMatch = searchTerms.some(term => 
                file.name.toLowerCase().includes(term)
            );
            
            if (fileNameMatch) return true;
            
            // Recherche dans le contenu (si disponible)
            if (file.searchableContent && file.searchableContent.length > 0) {
                const contentMatch = searchTerms.some(term =>
                    file.searchableContent.toLowerCase().includes(term)
                );
                return contentMatch;
            }
            
            return false;
        });
    }

    getTestFiles() {
        return [
            {
                name: "document.pdf",
                type: "PDF",
                size: 1024000,
                rawUrl: "#",
                lastModified: "30/11/2024",
                searchableContent: "Ceci est un document PDF de test contenant des informations importantes sur la technologie et l'innovation."
            },
            {
                name: "image.jpg",
                type: "Image", 
                size: 512000,
                rawUrl: "#",
                lastModified: "29/11/2024",
                searchableContent: "image.jpg"
            },
            {
                name: "musique.mp3",
                type: "Audio",
                size: 2048000,
                rawUrl: "#", 
                lastModified: "28/11/2024",
                searchableContent: "musique.mp3"
            },
            {
                name: "rapport.txt",
                type: "Texte",
                size: 1024,
                rawUrl: "#",
                lastModified: "27/11/2024",
                searchableContent: "Rapport annuel 2024. Ce document contient des données financières importantes et des analyses de marché détaillées."
            },
            {
                name: "app.apk",
                type: "Application",
                size: 5120000,
                rawUrl: "#",
                lastModified: "26/11/2024",
                searchableContent: "app.apk"
            }
        ];
    }

    // Sélection de fichier
    initFileSelection() {
        document.addEventListener('click', (e) => {
            const fileCard = e.target.closest('.file-card');
            if (fileCard && !e.target.closest('.file-actions')) {
                this.selectFile(fileCard);
            }
        });
    }

    selectFile(fileCard) {
        // Désélectionner précédent
        if (this.selectedFile) {
            this.selectedFile.classList.remove('selected');
        }
        
        // Sélectionner nouveau
        fileCard.classList.add('selected');
        this.selectedFile = fileCard;
        
        console.log('Fichier sélectionné:', fileCard.querySelector('.file-name').textContent);
    }

    // Méthodes professionnelles
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(45, 48, 71, 0.95);
            backdrop-filter: blur(20px);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            border: 1px solid rgba(101, 78, 163, 0.5);
            z-index: 10000;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// =============================================
// PRÉVISUALISATION AVANCÉE DES FICHIERS
// =============================================
FileManager.prototype.previewFile = function(url, type, filename, searchQuery = '') {
    switch(type) {
        case 'PDF':
            this.openPDF(url, filename, searchQuery);
            break;
        case 'Audio':
            this.previewAudio(url, filename);
            break;
        case 'Image':
            this.previewImage(url, filename);
            break;
        case 'Texte':
        case 'Document':
            this.previewText(url, filename, searchQuery);
            break;
        default:
            this.downloadFile(url, filename);
    }
};

// PDF - Ouverture avec recherche de texte
FileManager.prototype.openPDF = function(url, filename, searchQuery = '') {
    const modal = this.createModal();
    
    modal.innerHTML = `
        <div class="preview-content pdf-preview">
            <div class="pdf-header">
                <h3>📖 ${filename}</h3>
                <div class="pdf-actions-top">
                    <button class="btn btn-primary" onclick="fileManager.downloadFile('${url}', '${filename}')">
                        📥 Télécharger
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.preview-modal').remove()">
                        Fermer
                    </button>
                </div>
            </div>
            <div class="pdf-loading">
                <div class="loading-spinner"></div>
                <p>Chargement du PDF...</p>
                ${searchQuery ? `<p class="search-info">Recherche du terme: "${searchQuery}"</p>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Utiliser Google Viewer avec highlight si recherche
    const googleViewerUrl = searchQuery 
        ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}&hl=fr&q=${encodeURIComponent(searchQuery)}`
        : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

    setTimeout(() => {
        const iframe = document.createElement('iframe');
        iframe.src = googleViewerUrl;
        iframe.width = '100%';
        iframe.height = '600px';
        iframe.frameBorder = '0';
        iframe.style.borderRadius = '10px';
        iframe.onload = () => {
            const loading = modal.querySelector('.pdf-loading');
            if (loading) loading.style.display = 'none';
        };
        iframe.onerror = () => {
            this.fallbackPDF(url, filename, modal, searchQuery);
        };

        const pdfContainer = document.createElement('div');
        pdfContainer.className = 'pdf-container';
        pdfContainer.appendChild(iframe);
        
        modal.querySelector('.preview-content').appendChild(pdfContainer);
    }, 500);
};

// Fallback PDF amélioré
FileManager.prototype.fallbackPDF = function(url, filename, modal, searchQuery = '') {
    const content = modal.querySelector('.preview-content');
    content.innerHTML = `
        <div class="preview-content">
            <div class="pdf-header">
                <h3>📖 ${filename}</h3>
            </div>
            <div class="pdf-alternative">
                <div class="icon">📄</div>
                <h3>PDF non visualisable directement</h3>
                <p>Le PDF ne peut pas être affiché dans cette visionneuse.</p>
                ${searchQuery ? `<p class="search-info">Terme recherché: <strong>"${searchQuery}"</strong></p>` : ''}
                <p>Vous pouvez le télécharger pour le visualiser localement.</p>
            </div>
            <div class="pdf-actions">
                <button class="btn btn-primary" onclick="fileManager.downloadFile('${url}', '${filename}')">
                    📥 Télécharger le PDF
                </button>
                <button class="btn btn-secondary" onclick="window.open('${url}', '_blank')">
                    Ouvrir dans un nouvel onglet
                </button>
                <button class="btn btn-secondary" onclick="this.closest('.preview-modal').remove()">
                    Fermer
                </button>
            </div>
        </div>
    `;
};

// Prévisualisation de texte avec surlignage
FileManager.prototype.previewText = function(url, filename, searchQuery = '') {
    const modal = this.createModal();
    
    modal.innerHTML = `
        <div class="preview-content text-preview">
            <div class="text-header">
                <h3>📝 ${filename}</h3>
                <button class="btn btn-primary" onclick="fileManager.downloadFile('${url}', '${filename}')">
                    📥 Télécharger
                </button>
            </div>
            <div class="text-loading">
                <div class="loading-spinner"></div>
                <p>Chargement du document...</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Charger et afficher le contenu texte
    this.loadAndHighlightText(url, searchQuery, modal);
};

FileManager.prototype.loadAndHighlightText = async function(url, searchQuery, modal) {
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        let highlightedText = text;
        if (searchQuery) {
            const regex = new RegExp(`(${this.escapeRegex(searchQuery)})`, 'gi');
            highlightedText = text.replace(regex, '<mark class="search-highlight">$1</mark>');
        }
        
        const content = modal.querySelector('.preview-content');
        content.innerHTML = `
            <div class="preview-content">
                <div class="text-header">
                    <h3>📝 ${url.split('/').pop()}</h3>
                    <div class="text-actions">
                        <button class="btn btn-primary" onclick="fileManager.downloadFile('${url}', '${url.split('/').pop()}')">
                            📥 Télécharger
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.preview-modal').remove()">
                            Fermer
                        </button>
                    </div>
                </div>
                <div class="text-content">
                    <pre>${highlightedText}</pre>
                </div>
                ${searchQuery ? `
                <div class="search-stats">
                    <p>Terme recherché: <strong>"${searchQuery}"</strong></p>
                </div>
                ` : ''}
            </div>
        `;
    } catch (error) {
        const content = modal.querySelector('.preview-content');
        content.innerHTML = `
            <div class="preview-content">
                <h3>❌ Erreur</h3>
                <p>Impossible de charger le fichier texte.</p>
                <button class="btn btn-secondary" onclick="this.closest('.preview-modal').remove()">
                    Fermer
                </button>
            </div>
        `;
    }
};

FileManager.prototype.escapeRegex = function(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Audio - Prévisualisation avec lecteur
FileManager.prototype.previewAudio = function(url, filename) {
    const modal = this.createModal();
    modal.innerHTML = `
        <div class="preview-content">
            <h3 style="margin-bottom: 20px;">🎵 ${filename}</h3>
            <div class="audio-player">
                <audio controls style="width: 300px;">
                    <source src="${url}" type="audio/mpeg">
                    Votre navigateur ne supporte pas l'audio.
                </audio>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button class="btn btn-primary" onclick="fileManager.downloadFile('${url}', '${filename}')">
                    📥 Télécharger
                </button>
                <button class="btn btn-secondary" onclick="this.closest('.preview-modal').remove()">
                    Fermer
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

// Image - Prévisualisation normale
FileManager.prototype.previewImage = function(url, filename) {
    const modal = this.createModal();
    modal.innerHTML = `
        <div class="preview-content">
            <img src="${url}" alt="Preview" style="max-width: 90vw; max-height: 70vh; border-radius: 10px;">
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button class="btn btn-primary" onclick="fileManager.downloadFile('${url}', '${filename}')">
                    📥 Télécharger
                </button>
                <button class="btn btn-secondary" onclick="this.closest('.preview-modal').remove()">
                    Fermer
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

FileManager.prototype.createModal = function() {
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; padding: 20px;
    `;
    return modal;
};

FileManager.prototype.downloadFile = function(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
};

// =============================================
// SYSTÈME DE RECHERCHE AVANCÉ (index.html)
// =============================================
class SearchSystem {
    constructor(fileManager) {
        this.fileManager = fileManager;
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.welcomeSection = document.querySelector('.welcome-section');
        this.init();
    }

    init() {
        if (this.searchInput && this.resultsContainer) {
            this.searchInput.addEventListener('input', (e) => {
                this.performSearch(e.target.value);
            });
            
            // Recherche à la touche Entrée
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(e.target.value);
                }
            });
        }
    }

    performSearch(query) {
        const results = this.fileManager.searchFiles(query);
        this.displayResults(results, query);
    }

    displayResults(files, query) {
        // Gérer l'affichage de la section de bienvenue
        if (this.welcomeSection) {
            if (!query.trim()) {
                this.welcomeSection.style.display = 'block';
                this.resultsContainer.innerHTML = '<p class="no-results">Tapez quelque chose pour rechercher...</p>';
                return;
            } else {
                this.welcomeSection.style.display = 'none';
            }
        }

        if (files.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="no-results">
                    <h3>🔍 Aucun résultat trouvé</h3>
                    <p>Aucun fichier ne correspond à "<strong>${query}</strong>"</p>
                    <p class="search-tips">
                        <strong>Conseils de recherche :</strong><br>
                        • Vérifiez l'orthographe<br>
                        • Utilisez des termes plus généraux<br>
                        • Recherchez un seul mot à la fois
                    </p>
                </div>
            `;
            return;
        }

        this.resultsContainer.innerHTML = `
            <div class="search-info-bar">
                <p>${files.length} résultat(s) trouvé(s) pour "<strong>${query}</strong>"</p>
            </div>
            ${files.map(file => {
                const isPDF = file.type === 'PDF';
                const isAudio = file.type === 'Audio';
                const isText = file.type === 'Texte' || file.type === 'Document';
                
                return `
                    <div class="file-card" data-type="${file.type}">
                        <div class="file-header">
                            <div class="file-icon">${this.fileManager.getFileIcon(file.type)}</div>
                            <div class="file-info">
                                <div class="file-name">${this.highlightMatch(file.name, query)}</div>
                                <div class="file-type">${file.type} • ${this.formatSize(file.size)}</div>
                                <div class="file-date">Ajouté le ${file.lastModified}</div>
                                ${this.getContentPreview(file, query)}
                            </div>
                        </div>
                        <div class="file-actions ${isAudio ? 'file-actions-compact' : ''}">
                            ${isAudio ? `
                                <button class="btn-play" onclick="fileManager.previewFile('${file.rawUrl}', '${file.type}', '${file.name}', '${query}')">
                                    ▶
                                </button>
                                <button class="btn btn-primary" onclick="fileManager.downloadFile('${file.rawUrl}', '${file.name}')">
                                    📥 Télécharger
                                </button>
                            ` : `
                                <button class="btn btn-primary" onclick="fileManager.previewFile('${file.rawUrl}', '${file.type}', '${file.name}', '${query}')">
                                    ${isPDF ? '📖 Ouvrir' : isText ? '📝 Ouvrir' : '👁️ Ouvrir'}
                                </button>
                                ${!isPDF ? `
                                    <button class="btn btn-secondary" onclick="fileManager.downloadFile('${file.rawUrl}', '${file.name}')">
                                        📥 Télécharger
                                    </button>
                                ` : ''}
                            `}
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    }

    // Surligner les correspondances dans le nom
    highlightMatch(text, query) {
        if (!query.trim()) return text;
        
        const terms = query.toLowerCase().split(/\s+/);
        let highlighted = text;
        
        terms.forEach(term => {
            if (term.length > 0) {
                const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
                highlighted = highlighted.replace(regex, '<mark class="name-highlight">$1</mark>');
            }
        });
        
        return highlighted;
    }

    // Aperçu du contenu avec surlignage
    getContentPreview(file, query) {
        if (!file.searchableContent || file.searchableContent === file.name) return '';
        
        const terms = query.toLowerCase().split(/\s+/);
        let content = file.searchableContent;
        
        // Surligner les correspondances
        terms.forEach(term => {
            if (term.length > 0) {
                const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
                content = content.replace(regex, '<mark class="content-highlight">$1</mark>');
            }
        });
        
        // Prendre un extrait autour de la première correspondance
        const firstMatch = content.indexOf('<mark class="content-highlight">');
        if (firstMatch !== -1) {
            const start = Math.max(0, firstMatch - 50);
            const end = Math.min(content.length, firstMatch + 150);
            let excerpt = content.substring(start, end);
            
            if (start > 0) excerpt = '...' + excerpt;
            if (end < content.length) excerpt = excerpt + '...';
            
            return `<div class="file-content-preview">${excerpt}</div>`;
        }
        
        // Si pas de correspondance, prendre le début
        if (content.length > 150) {
            return `<div class="file-content-preview">${content.substring(0, 150)}...</div>`;
        }
        
        return `<div class="file-content-preview">${content}</div>`;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    formatSize(bytes) {
        if (!bytes) return 'Taille inconnue';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// =============================================
// SYSTÈME DOSSIER (dossier.html) - VERSION SIMPLIFIÉE
// =============================================
class DossierSystem {
    constructor(fileManager) {
        this.fileManager = fileManager;
        this.filesContainer = document.getElementById('filesContainer');
        this.init();
    }

    init() {
        if (this.filesContainer) {
            this.displayAllFiles();
        }
    }

    displayAllFiles() {
        if (this.fileManager.files.length === 0) {
            this.filesContainer.innerHTML = '<p class="no-results">Aucun fichier trouvé</p>';
            return;
        }

        this.filesContainer.innerHTML = `
            <div class="file-row">
                ${this.fileManager.files.map(file => {
                    const isPDF = file.type === 'PDF';
                    const isAudio = file.type === 'Audio';
                    
                    return `
                        <div class="file-card" data-type="${file.type}">
                            <div class="file-header">
                                <div class="file-icon">${this.fileManager.getFileIcon(file.type)}</div>
                                <div class="file-info">
                                    <div class="file-name">${file.name}</div>
                                    <div class="file-type">${file.type} • ${this.formatSize(file.size)}</div>
                                    <div class="file-date">Ajouté le ${file.lastModified}</div>
                                </div>
                            </div>
                            <div class="file-actions ${isAudio ? 'file-actions-compact' : ''}">
                                ${isAudio ? `
                                    <button class="btn-play" onclick="fileManager.previewFile('${file.rawUrl}', '${file.type}', '${file.name}')">
                                        ▶
                                    </button>
                                    <button class="btn btn-primary" onclick="fileManager.downloadFile('${file.rawUrl}', '${file.name}')">
                                        📥 Télécharger
                                    </button>
                                ` : `
                                    <button class="btn btn-primary" onclick="fileManager.previewFile('${file.rawUrl}', '${file.type}', '${file.name}')">
                                        ${isPDF ? '📖 Ouvrir' : '👁️ Ouvrir'}
                                    </button>
                                `}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    formatSize(bytes) {
        if (!bytes) return 'Taille inconnue';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// =============================================
// DÉTECTION DE PAGE ET INITIALISATION
// =============================================
FileManager.prototype.detectPageAndInit = function() {
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage === 'index.html' || currentPage === '') {
        this.searchSystem = new SearchSystem(this);
    } else if (currentPage === 'dossier.html') {
        this.dossierSystem = new DossierSystem(this);
    }
};

// =============================================
// INITIALISATION AU CHARGEMENT
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    // Animation d'entrée
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);

    // Initialisation des systèmes
    initNavigation();
    window.fileManager = new FileManager();
});