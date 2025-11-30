// =============================================
// CONFIGURATION GLOBALE
// =============================================
const CONFIG = {
    GITHUB_REPO: 'ivanipote/premium_search',
    FILES_FOLDER: 'files',
    RAW_BASE_URL: 'https://raw.githubusercontent.com/ivanipote/premium_search/main/files/'
};

// =============================================
// NAVIGATION GLOBALE
// =============================================
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const header = document.querySelector('.header');
const searchBar = document.getElementById('searchBar');
const pageTitle = document.querySelector('.page-title');
const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
const navItems = document.querySelectorAll('.nav-item');

// Initialisation de la navigation
function initNavigation() {
    // Ouvrir/fermer le sidebar
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            toggleHeaderElements();
        });
    }

    // Fermer le sidebar en cliquant sur l'overlay
    if (overlay) {
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            showHeaderElements();
        });
    }

    // Navigation du sidebar
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPage = this.getAttribute('href');
            if (targetPage && !targetPage.startsWith('#')) {
                window.location.href = targetPage;
            }
        });
    });

    // Navigation du bas
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

function toggleHeaderElements() {
    const elementsToHide = [header, searchBar, pageTitle];
    elementsToHide.forEach(element => {
        if (element) {
            if (sidebar.classList.contains('active')) {
                element.style.opacity = '0';
                element.style.visibility = 'hidden';
            } else {
                element.style.opacity = '1';
                element.style.visibility = 'visible';
            }
        }
    });
}

function showHeaderElements() {
    const elementsToShow = [header, searchBar, pageTitle];
    elementsToShow.forEach(element => {
        if (element) {
            element.style.opacity = '1';
            element.style.visibility = 'visible';
        }
    });
}

// =============================================
// GESTIONNAIRE DE FICHIERS
// =============================================
class FileManager {
    constructor() {
        this.files = [];
        this.init();
    }

    async init() {
        await this.scanGitHubFiles();
        this.detectPageAndInit();
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
                    lastModified: new Date(file.name).toLocaleDateString('fr-FR')
                }));
            
            console.log(`${this.files.length} fichiers chargés`);
        } catch (error) {
            console.error('Erreur scan GitHub:', error);
            // Fallback: fichiers de test
            this.files = this.getTestFiles();
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

    searchFiles(query) {
        if (!query) return [];
        return this.files.filter(file => 
            file.name.toLowerCase().includes(query.toLowerCase())
        );
    }

    getTestFiles() {
        return [
            {
                name: "document.pdf",
                type: "PDF",
                size: 1024000,
                rawUrl: "#",
                lastModified: "30/11/2024"
            },
            {
                name: "image.jpg",
                type: "Image", 
                size: 512000,
                rawUrl: "#",
                lastModified: "29/11/2024"
            },
            {
                name: "musique.mp3",
                type: "Audio",
                size: 2048000,
                rawUrl: "#", 
                lastModified: "28/11/2024"
            }
        ];
    }
}

// =============================================
// SYSTÈME DE RECHERCHE (index.html)
// =============================================
class SearchSystem {
    constructor(fileManager) {
        this.fileManager = fileManager;
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.init();
    }

    init() {
        if (this.searchInput && this.resultsContainer) {
            this.searchInput.addEventListener('input', (e) => {
                this.performSearch(e.target.value);
            });
        }
    }

    performSearch(query) {
        const results = this.fileManager.searchFiles(query);
        this.displayResults(results, query);
    }

    displayResults(files, query) {
        if (!query) {
            this.resultsContainer.innerHTML = '<p class="no-results">Tapez quelque chose pour rechercher...</p>';
            return;
        }

        if (files.length === 0) {
            this.resultsContainer.innerHTML = `<p class="no-results">Aucun résultat pour "${query}"</p>`;
            return;
        }

        this.resultsContainer.innerHTML = files.map(file => `
            <div class="file-card">
                <div class="file-header">
                    <div class="file-icon">${this.fileManager.getFileIcon(file.type)}</div>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-type">${file.type} • ${this.formatSize(file.size)}</div>
                        <div class="file-date">Ajouté le ${file.lastModified}</div>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn btn-primary" onclick="fileManager.previewFile('${file.rawUrl}', '${file.type}')">
                        Ouvrir
                    </button>
                    <button class="btn btn-secondary" onclick="fileManager.downloadFile('${file.rawUrl}', '${file.name}')">
                        Télécharger
                    </button>
                </div>
            </div>
        `).join('');
    }

    formatSize(bytes) {
        if (!bytes) return 'Taille inconnue';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// =============================================
// SYSTÈME DOSSIER (dossier.html)
// =============================================
class DossierSystem {
    constructor(fileManager) {
        this.fileManager = fileManager;
        this.filesGrid = document.getElementById('filesGrid');
        this.init();
    }

    init() {
        if (this.filesGrid) {
            this.displayAllFiles();
        }
    }

    displayAllFiles() {
        if (this.fileManager.files.length === 0) {
            this.filesGrid.innerHTML = '<p class="no-results">Aucun fichier trouvé</p>';
            return;
        }

        this.filesGrid.innerHTML = this.fileManager.files.map(file => `
            <div class="file-card">
                <div class="file-header">
                    <div class="file-icon">${this.fileManager.getFileIcon(file.type)}</div>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-type">${file.type} • ${this.formatSize(file.size)}</div>
                        <div class="file-date">Ajouté le ${file.lastModified}</div>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn btn-primary" onclick="fileManager.previewFile('${file.rawUrl}', '${file.type}')">
                        Ouvrir
                    </button>
                </div>
            </div>
        `).join('');
    }

    formatSize(bytes) {
        if (!bytes) return 'Taille inconnue';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// =============================================
// PRÉVISUALISATION DES FICHIERS
// =============================================
FileManager.prototype.previewFile = function(url, type) {
    switch(type) {
        case 'PDF':
            this.previewPDF(url);
            break;
        case 'Image':
            this.previewImage(url);
            break;
        case 'Audio':
            this.previewAudio(url);
            break;
        default:
            this.downloadFile(url, 'fichier');
    }
};

FileManager.prototype.previewPDF = function(url) {
    // Ouvrir dans un nouvel onglet pour l'instant
    window.open(url, '_blank');
};

FileManager.prototype.previewImage = function(url) {
    const modal = this.createModal();
    modal.innerHTML = `
        <div class="preview-content">
            <img src="${url}" alt="Preview" style="max-width: 90vw; max-height: 80vh; border-radius: 10px;">
            <button class="btn btn-primary" onclick="this.closest('.preview-modal').remove()">Fermer</button>
            <button class="btn btn-secondary" onclick="fileManager.downloadFile('${url}', 'image')">Télécharger</button>
        </div>
    `;
    document.body.appendChild(modal);
};

FileManager.prototype.previewAudio = function(url) {
    const modal = this.createModal();
    modal.innerHTML = `
        <div class="preview-content">
            <audio controls style="width: 300px; margin: 20px 0;">
                <source src="${url}" type="audio/mpeg">
                Votre navigateur ne supporte pas l'audio.
            </audio>
            <br>
            <button class="btn btn-primary" onclick="this.closest('.preview-modal').remove()">Fermer</button>
            <button class="btn btn-secondary" onclick="fileManager.downloadFile('${url}', 'audio')">Télécharger</button>
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
        z-index: 10000;
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