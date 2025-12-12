// exercices.js - VERSION AVEC API GITHUB
// mathX_searcher - Utilise l'API GitHub pour scanner les fichiers

// ================= CONFIGURATION GITHUB =================
const GITHUB_CONFIG = {
    USER: 'ivanipote',
    REPO: 'MathX_searcher',
    BRANCH: 'main',
    DOSSIER_EXERCICES: 'exercices',
    TOKEN: '' // Optionnel: token pour plus de requêtes
};

const API_BASE = `https://api.github.com/repos/${GITHUB_CONFIG.USER}/${GITHUB_CONFIG.REPO}/contents`;
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_CONFIG.USER}/${GITHUB_CONFIG.REPO}/${GITHUB_CONFIG.BRANCH}/`;

// ================= ÉTATS GLOBAUX =================
let fileIndex = [];
let searchTimeout = null;
let activeFilters = { pdf: true, txt: true, image: true };

// ================= API GITHUB =================
async function scanGitHubFolder(folderPath = '') {
    console.log(`🔍 Scan GitHub: ${folderPath || 'racine'}`);
    
    try {
        const apiUrl = `${API_BASE}/${GITHUB_CONFIG.DOSSIER_EXERCICES}${folderPath ? '/' + folderPath : ''}`;
        console.log('📡 URL API:', apiUrl);
        
        const headers = {};
        if (GITHUB_CONFIG.TOKEN) {
            headers['Authorization'] = `token ${GITHUB_CONFIG.TOKEN}`;
        }
        
        const response = await fetch(apiUrl, { headers });
        
        if (!response.ok) {
            if (response.status === 403) {
                console.warn('⚠️ Rate limit GitHub, fallback JSON');
                return await loadFallbackJSON();
            }
            throw new Error(`GitHub API: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`📊 Réponse API: ${data.length} items`);
        
        const fichiers = [];
        
        for (const item of data) {
            if (item.type === 'file') {
                const fichier = await processGitHubFile(item, folderPath);
                if (fichier) fichiers.push(fichier);
            } else if (item.type === 'dir') {
                // Scanner les sous-dossiers récursivement
                const sousFichiers = await scanGitHubFolder(
                    folderPath ? `${folderPath}/${item.name}` : item.name
                );
                fichiers.push(...sousFichiers);
            }
        }
        
        return fichiers;
        
    } catch (error) {
        console.error('❌ Erreur scan GitHub:', error);
        return await loadFallbackJSON();
    }
}

async function processGitHubFile(item, folderPath) {
    const extension = item.name.split('.').pop().toLowerCase();
    const type = getFileType(extension);
    
    if (!['pdf', 'txt', 'image'].includes(type)) {
        return null; // Ignorer les fichiers non supportés
    }
    
    const cheminRelatif = folderPath ? `${folderPath}/${item.name}` : item.name;
    const rawUrl = `${RAW_BASE}${GITHUB_CONFIG.DOSSIER_EXERCICES}/${cheminRelatif}`;
    
    // Pour les fichiers TXT, lire le contenu
    let extrait = '';
    if (type === 'txt' && item.size < 100000) { // Max 100KB
        try {
            const response = await fetch(rawUrl);
            if (response.ok) {
                const texte = await response.text();
                extrait = texte.substring(0, 300).replace(/\n/g, ' ');
            }
        } catch (e) {
            // Ignorer si erreur lecture
        }
    }
    
    return {
        id: `gh-${item.sha.substring(0, 8)}`,
        nom: item.name,
        chemin: `${GITHUB_CONFIG.DOSSIER_EXERCICES}/${cheminRelatif}`,
        url: rawUrl,
        type: type,
        titre: formatFileName(item.name),
        description: getFileDescription(type),
        icon: getFileIcon(type),
        color: getFileColor(type),
        humanSize: formatFileSize(item.size || 0),
        taille: item.size || 0,
        extrait: extrait,
        motsCles: extractKeywords(item.name),
        date: new Date().toISOString(),
        source: 'github',
        sha: item.sha
    };
}

async function loadFallbackJSON() {
    try {
        const response = await fetch('fichiers.json');
        if (response.ok) {
            const data = await response.json();
            console.log(`📄 Fallback: ${data.fichiers?.length || 0} fichiers`);
            
            return (data.fichiers || []).map(fichier => {
                const type = getFileType(fichier.extension);
                const rawUrl = `${RAW_BASE}${fichier.chemin}`;
                
                return {
                    id: `json-${Date.now()}-${Math.random().toString(36).substr(2)}`,
                    nom: fichier.nom,
                    chemin: fichier.chemin,
                    url: rawUrl,
                    type: type,
                    titre: formatFileName(fichier.nom),
                    description: getFileDescription(type),
                    icon: getFileIcon(type),
                    color: getFileColor(type),
                    humanSize: formatFileSize(fichier.taille || 0),
                    taille: fichier.taille || 0,
                    motsCles: extractKeywords(fichier.nom),
                    date: fichier.date || new Date().toISOString(),
                    source: 'json'
                };
            });
        }
    } catch (e) {
        console.warn('⚠️ Fallback JSON non disponible');
    }
    
    return createSampleFiles();
}

function createSampleFiles() {
    return [
        {
            id: 'sample-1',
            nom: 'exemple_theoreme.pdf',
            chemin: 'exercices/exemple_theoreme.pdf',
            url: `${RAW_BASE}exercices/exemple_theoreme.pdf`,
            type: 'pdf',
            titre: 'Théorème de Pythagore',
            description: 'Document PDF sur le théorème',
            icon: '📄',
            color: 'file-pdf',
            humanSize: '1.8 MB',
            motsCles: ['théorème', 'pythagore', 'géométrie', 'triangle']
        },
        {
            id: 'sample-2',
            nom: 'exercices_derive.txt',
            chemin: 'exercices/exercices_derive.txt',
            url: `${RAW_BASE}exercices/exercices_derive.txt`,
            type: 'txt',
            titre: 'Exercices sur les Dérivées',
            description: 'Série d\'exercices de calcul différentiel',
            icon: '📃',
            color: 'file-text',
            humanSize: '5.2 KB',
            motsCles: ['dérivée', 'exercice', 'calcul', 'math']
        }
    ];
}

// ================= INITIALISATION =================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 mathX_searcher - GitHub Edition');
    
    try {
        // 1. Vérifier authentification
        if (!await checkAuthentication()) return;
        
        // 2. Initialiser filtres
        initFilters();
        
        // 3. Scanner GitHub
        showMessage('Connexion à GitHub...', 'info');
        fileIndex = await scanGitHubFolder();
        
        // 4. Initialiser interface
        initInterface();
        
        // 5. Afficher état initial
        showHomeContent();
        
        console.log(`✅ ${fileIndex.length} fichiers chargés depuis GitHub`);
        showMessage(`${fileIndex.length} fichiers disponibles`, 'success');
        
    } catch (error) {
        console.error('❌ Erreur initialisation:', error);
        showError('Erreur de chargement');
    }
});

// ================= FONCTIONS UTILITAIRES =================
function getFileType(extension) {
    if (['pdf'].includes(extension)) return 'pdf';
    if (['txt', 'md', 'rtf'].includes(extension)) return 'txt';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) return 'image';
    return 'other';
}

function formatFileName(filename) {
    const sansExtension = filename.replace(/\.[^/.]+$/, '');
    const avecEspaces = sansExtension.replace(/[_-]/g, ' ');
    
    return avecEspaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function extractKeywords(filename) {
    const title = formatFileName(filename);
    const words = title.toLowerCase().split(/\s+/);
    const ignoreWords = ['de', 'des', 'du', 'et', 'ou', 'les', 'la', 'le'];
    return words.filter(word => word.length > 2 && !ignoreWords.includes(word));
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(fileType) {
    const icons = {'pdf': '📄', 'txt': '📃', 'image': '🖼️', 'other': '📁'};
    return icons[fileType] || '📁';
}

function getFileColor(fileType) {
    const colors = {'pdf': 'file-pdf', 'txt': 'file-text', 'image': 'file-image', 'other': 'file-other'};
    return colors[fileType] || 'file-other';
}

function getFileDescription(fileType) {
    const descriptions = {
        'pdf': 'Document PDF',
        'txt': 'Fichier texte ou exercice', 
        'image': 'Image ou schéma',
        'other': 'Fichier'
    };
    return descriptions[fileType] || 'Fichier';
}

function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================= AUTHENTIFICATION SIMPLIFIÉE =================
async function checkAuthentication() {
    // Pour GitHub Pages, vérifier simplement si l'utilisateur a accès
    const userEmail = localStorage.getItem('mathx_user_email');
    if (userEmail) {
        console.log('✅ Utilisateur:', userEmail);
        return true;
    }
    
    // Fallback: autoriser l'accès avec avertissement
    console.log('⚠️ Accès en mode visite');
    return true;
}

// ================= CRÉATION DES CARTES =================
function createFileCard(file) {
    const div = document.createElement('div');
    div.className = `result-card ${file.type}-card visible`;
    div.setAttribute('data-type', file.type);
    
    let previewHTML = '';
    if (file.type === 'txt' && file.extrait) {
        previewHTML = `<div class="exercise-preview">${escapeHTML(file.extrait)}...</div>`;
    } else if (file.type === 'image') {
        previewHTML = `
            <div class="image-container">
                <img src="${escapeHTML(file.url)}" 
                     alt="${escapeHTML(file.titre)}" 
                     class="image-preview"
                     loading="lazy"
                     onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"200\"><rect width=\"300\" height=\"200\" fill=\"%23f1f5f9\"/><text x=\"50%\" y=\"50%\" font-family=\"Arial\" font-size=\"14\" fill=\"%2364748b\" text-anchor=\"middle\" dy=\".3em\">Image non disponible</text></svg>'">
            </div>
        `;
    } else {
        previewHTML = `<div class="file-description">${escapeHTML(file.description)}</div>`;
    }
    
    let buttonsHTML = '';
    if (file.type === 'pdf') {
        buttonsHTML = `
            <a href="${escapeHTML(file.url)}" class="action-download" download="${escapeHTML(file.nom)}">
                <i class="fas fa-download"></i> Télécharger
            </a>
            <a href="https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true" 
               target="_blank" class="action-open">
                <i class="fas fa-external-link-alt"></i> Ouvrir
            </a>
        `;
    } else if (file.type === 'txt') {
        buttonsHTML = `
            <a href="${escapeHTML(file.url)}" class="action-download" download="${escapeHTML(file.nom)}">
                <i class="fas fa-download"></i> Télécharger
            </a>
            <a href="${escapeHTML(file.url)}" target="_blank" class="action-open">
                <i class="fas fa-external-link-alt"></i> Ouvrir
            </a>
        `;
    } else if (file.type === 'image') {
        buttonsHTML = `
            <a href="${escapeHTML(file.url)}" class="action-download" download="${escapeHTML(file.nom)}">
                <i class="fas fa-download"></i> Télécharger
            </a>
            <button class="action-open" onclick="openImagePreview('${escapeHTML(file.url)}', '${escapeHTML(file.nom)}')">
                <i class="fas fa-eye"></i> Voir
            </button>
        `;
    } else {
        buttonsHTML = `
            <a href="${escapeHTML(file.url)}" class="action-download" download="${escapeHTML(file.nom)}">
                <i class="fas fa-download"></i> Télécharger
            </a>
        `;
    }
    
    const shortName = file.nom.length > 25 ? file.nom.substring(0, 22) + '...' : file.nom;
    
    div.innerHTML = `
        <div class="card-header">
            <h3 class="file-title" title="${escapeHTML(file.titre)}">
                ${escapeHTML(file.titre)}
            </h3>
            <span class="file-type">${file.type.toUpperCase()}</span>
        </div>
        
        ${previewHTML}
        
        <div class="file-info">
            <div class="info-item">
                <i class="fas fa-${file.type === 'pdf' ? 'file-pdf' : file.type === 'txt' ? 'file-alt' : 'image'}"></i>
                <span>${file.type.toUpperCase()}</span>
            </div>
            <div class="info-item">
                <i class="fas fa-weight-hanging"></i>
                <span>${file.humanSize}</span>
            </div>
            <div class="info-item">
                <i class="fas fa-database"></i>
                <span title="${escapeHTML(file.nom)}">${escapeHTML(shortName)}</span>
            </div>
        </div>
        
        <div class="card-actions">
            ${buttonsHTML}
        </div>
    `;
    
    return div;
}

// ================= MESSAGES =================
function showMessage(text, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'github-message';
    messageDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                           type === 'error' ? 'exclamation-triangle' : 
                           type === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${text}</span>
    `;
    
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#ef4444' : 
                     type === 'success' ? '#10b981' : 
                     type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: messageSlideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'messageSlideOut 0.3s ease';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

function showError(message) {
    showMessage(message, 'error');
}

// ================= VISIONNEUSE D'IMAGES =================
function openImagePreview(imageUrl, fileName) {
    const overlay = document.createElement('div');
    overlay.className = 'image-overlay';
    overlay.innerHTML = `
        <div class="image-modal">
            <div class="image-header">
                <h3><i class="fab fa-github"></i> ${escapeHTML(fileName)}</h3>
                <button class="close-btn" onclick="closeImagePreview()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="image-container">
                <img src="${escapeHTML(imageUrl)}" 
                     alt="${escapeHTML(fileName)}" 
                     onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"300\"><rect width=\"400\" height=\"300\" fill=\"%23f1f5f9\"/><text x=\"50%\" y=\"50%\" font-family=\"Arial\" font-size=\"16\" fill=\"%2364748b\" text-anchor=\"middle\" dy=\".3em\">Image GitHub non disponible</text></svg>'">
            </div>
            <div class="image-footer">
                <a href="${escapeHTML(imageUrl)}" class="btn-download" download="${escapeHTML(fileName)}">
                    <i class="fas fa-download"></i> Télécharger depuis GitHub
                </a>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
}

function closeImagePreview() {
    const overlay = document.querySelector('.image-overlay');
    if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
    }
}

// ================= INTERFACE =================
function initInterface() {
    const searchInput = document.getElementById('exercicesSearchInput');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value;
            
            if (query.length >= CONFIG.MIN_CHARS) {
                performSearch(query);
            } else if (query.length === 0) {
                showHomeContent();
            }
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                performSearch(this.value);
            }
        });
    }
    
    const scanBtn = document.getElementById('scanNewFilesBtn');
    if (scanBtn) {
        scanBtn.addEventListener('click', async function() {
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scan GitHub...';
            this.disabled = true;
            
            fileIndex = await scanGitHubFolder();
            
            const searchInput = document.getElementById('exercicesSearchInput');
            if (searchInput && searchInput.value.trim()) {
                performSearch(searchInput.value.trim());
            }
            
            this.innerHTML = '<i class="fab fa-github"></i> Re-scan GitHub';
            this.disabled = false;
        });
    }
}

function showHomeContent() {
    document.getElementById('welcomeState').style.display = 'block';
    document.getElementById('noResultsState').style.display = 'none';
    document.getElementById('resultsContainer').style.display = 'none';
}

function showResultsContent() {
    document.getElementById('welcomeState').style.display = 'none';
}

// ================= EXPORT =================
window.ExercicesManager = {
    scan: scanGitHubFolder,
    search: performSearch,
    getFiles: () => fileIndex,
    getFilters: () => activeFilters,
    rescan: () => location.reload()
};

// Console styling
console.log('%c✨ mathX_searcher - GitHub Edition ✨', 'color: #6e40c9; font-size: 18px; font-weight: bold;');
console.log('%c📚 Repo: ivanipote/MathX_searcher', 'color: #4078c0; font-size: 14px;');
console.log('%c📁 Dossier: exercices/', 'color: #4078c0; font-size: 14px;');
console.log('%c🚀 API GitHub activée', 'color: #6cc644; font-size: 14px;');
console.log('='.repeat(60));