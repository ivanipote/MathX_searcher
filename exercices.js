// exercices.js - VERSION COMPLÈTE CORRIGÉE
// mathX_searcher - GitHub Edition

// ================= CONFIGURATION =================
const CONFIG = {
    DEBOUNCE_DELAY: 300,
    MIN_CHARS: 2
};

const GITHUB_CONFIG = {
    USER: 'ivanipote',
    REPO: 'MathX_searcher',
    BRANCH: 'main',
    DOSSIER_EXERCICES: 'exercices'
};

const API_BASE = `https://api.github.com/repos/${GITHUB_CONFIG.USER}/${GITHUB_CONFIG.REPO}/contents`;
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_CONFIG.USER}/${GITHUB_CONFIG.REPO}/${GITHUB_CONFIG.BRANCH}/`;

// ================= ÉTATS GLOBAUX =================
let fileIndex = [];
let searchTimeout = null;
let activeFilters = { pdf: true, txt: true, image: true };

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

// ================= API GITHUB =================
async function scanGitHubFolder(folderPath = '') {
    console.log(`🔍 Scan GitHub: ${folderPath || 'racine'}`);
    
    try {
        const apiUrl = `${API_BASE}/${GITHUB_CONFIG.DOSSIER_EXERCICES}${folderPath ? '/' + folderPath : ''}`;
        console.log('📡 URL API:', apiUrl);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            if (response.status === 403) {
                console.warn('⚠️ Rate limit GitHub');
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
                // Scanner les sous-dossiers
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
        return null;
    }
    
    const cheminRelatif = folderPath ? `${folderPath}/${item.name}` : item.name;
    const rawUrl = `${RAW_BASE}${GITHUB_CONFIG.DOSSIER_EXERCICES}/${cheminRelatif}`;
    
    let extrait = '';
    if (type === 'txt' && item.size < 100000) {
        try {
            const response = await fetch(rawUrl);
            if (response.ok) {
                const texte = await response.text();
                extrait = texte.substring(0, 300).replace(/\n/g, ' ');
            }
        } catch (e) {}
    }
    
    return {
        id: `gh-${item.sha?.substring(0, 8) || Date.now()}`,
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
        source: 'github'
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
            nom: 'exemple_math.pdf',
            chemin: 'exercices/exemple_math.pdf',
            url: `${RAW_BASE}exercices/exemple_math.pdf`,
            type: 'pdf',
            titre: 'Exemple Mathématiques',
            description: 'Document PDF d\'exemple',
            icon: '📄',
            color: 'file-pdf',
            humanSize: '2.1 MB',
            motsCles: ['exemple', 'math', 'pdf']
        },
        {
            id: 'sample-2',
            nom: 'exercice_algebre.txt',
            chemin: 'exercices/exercice_algebre.txt',
            url: `${RAW_BASE}exercices/exercice_algebre.txt`,
            type: 'txt',
            titre: 'Exercice Algèbre',
            description: 'Exercice de mathématiques',
            icon: '📃',
            color: 'file-text',
            humanSize: '4.5 KB',
            motsCles: ['exercice', 'algèbre', 'math']
        }
    ];
}

// ================= GESTION DES FILTRES =================
function initFilters() {
    const savedFilters = localStorage.getItem('mathx_exercices_filtres');
    if (savedFilters) {
        try {
            activeFilters = JSON.parse(savedFilters);
        } catch (e) {
            activeFilters = { pdf: true, txt: true, image: true };
        }
    }
    
    document.querySelectorAll('.filter-input').forEach(input => {
        const type = input.dataset.type;
        const checkbox = input.closest('.filter-checkbox');
        
        input.checked = activeFilters[type] !== false;
        
        if (input.checked) {
            checkbox.classList.add('active');
        }
        
        input.addEventListener('change', function() {
            activeFilters[type] = this.checked;
            
            if (this.checked) {
                checkbox.classList.add('active');
            } else {
                checkbox.classList.remove('active');
            }
            
            localStorage.setItem('mathx_exercices_filtres', JSON.stringify(activeFilters));
            
            const searchInput = document.getElementById('exercicesSearchInput');
            if (searchInput && searchInput.value.trim()) {
                performSearch(searchInput.value.trim());
            }
        });
    });
}

// ================= RECHERCHE INTELLIGENTE =================
function performSearch(query) {
    clearTimeout(searchTimeout);
    
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Recherche...</div>';
    }
    
    showResultsContent();
    
    if (!query.trim()) {
        showHomeContent();
        return;
    }
    
    searchTimeout = setTimeout(() => {
        const searchTerms = query.toLowerCase().split(' ');
        
        // Vérifier filtres actifs
        const hasActiveFilter = activeFilters.pdf || activeFilters.txt || activeFilters.image;
        if (!hasActiveFilter) {
            displayNoActiveFilters(query);
            return;
        }
        
        // Filtrer par types actifs
        let filteredByType = fileIndex.filter(file => activeFilters[file.type]);
        
        if (filteredByType.length === 0) {
            displayNoResultsForFilters(query);
            return;
        }
        
        // Recherche
        const results = filteredByType.filter(file => {
            const searchableText = (
                file.nom.toLowerCase() + ' ' +
                file.titre.toLowerCase() + ' ' +
                file.motsCles.join(' ').toLowerCase()
            );
            
            return searchTerms.some(term => 
                searchableText.includes(term) && term.length > 1
            );
        });
        
        if (results.length === 0) {
            displayNoResultsForSearch(query);
            return;
        }
        
        displaySearchResults(results, query);
    }, CONFIG.DEBOUNCE_DELAY);
}

function displayNoActiveFilters(query) {
    const noResultsState = document.getElementById('noResultsState');
    if (noResultsState) {
        noResultsState.style.display = 'block';
        noResultsState.innerHTML = `
            <i class="fas fa-filter fa-2x"></i>
            <h3>Aucun filtre activé</h3>
            <p>Recherche : <strong>"${escapeHTML(query)}"</strong></p>
            <p>Activez au moins un filtre.</p>
        `;
    }
    document.getElementById('welcomeState').style.display = 'none';
    document.getElementById('resultsContainer').style.display = 'none';
}

function displayNoResultsForFilters(query) {
    const noResultsState = document.getElementById('noResultsState');
    const activeFilterNames = getActiveFilterNames();
    
    if (noResultsState) {
        noResultsState.style.display = 'block';
        noResultsState.innerHTML = `
            <i class="fas fa-search fa-2x"></i>
            <h3>Aucun fichier</h3>
            <p>Recherche : <strong>"${escapeHTML(query)}"</strong></p>
            <p>Filtre(s) : <strong>${activeFilterNames.join(', ')}</strong></p>
            <p>Aucun fichier de ce type.</p>
        `;
    }
    document.getElementById('welcomeState').style.display = 'none';
    document.getElementById('resultsContainer').style.display = 'none';
}

function displayNoResultsForSearch(query) {
    const noResultsState = document.getElementById('noResultsState');
    const activeFilterNames = getActiveFilterNames();
    
    if (noResultsState) {
        noResultsState.style.display = 'block';
        noResultsState.innerHTML = `
            <i class="fas fa-search fa-2x"></i>
            <h3>Aucun résultat</h3>
            <p>Recherche : <strong>"${escapeHTML(query)}"</strong></p>
            <p>Filtre(s) : <strong>${activeFilterNames.join(', ')}</strong></p>
            <p>Essayez d'autres termes.</p>
            <button class="scan-new-files" onclick="rescanGitHub()" style="margin-top: 20px;">
                <i class="fab fa-github"></i> Re-scan GitHub
            </button>
        `;
    }
    document.getElementById('welcomeState').style.display = 'none';
    document.getElementById('resultsContainer').style.display = 'none';
}

function displaySearchResults(results, query) {
    const resultsContainer = document.getElementById('resultsContainer');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '';
    
    const resultsCount = document.createElement('div');
    resultsCount.className = 'results-count';
    resultsCount.innerHTML = `
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); 
                    color: white; border-radius: 15px; margin-bottom: 30px;">
            <h3 style="margin-bottom: 10px;">${results.length} résultat(s)</h3>
            <p style="opacity: 0.9;">Recherche : "${escapeHTML(query)}"</p>
            <small>Filtres : ${getActiveFilterNames().join(', ')}</small>
        </div>
    `;
    resultsContainer.appendChild(resultsCount);
    
    results.forEach(file => {
        const card = createFileCard(file);
        resultsContainer.appendChild(card);
    });
    
    resultsContainer.style.display = 'grid';
    document.getElementById('noResultsState').style.display = 'none';
    document.getElementById('welcomeState').style.display = 'none';
}

function getActiveFilterNames() {
    const filters = [];
    if (activeFilters.pdf) filters.push('PDF');
    if (activeFilters.txt) filters.push('Exercices');
    if (activeFilters.image) filters.push('Images');
    return filters.length === 0 ? ['Aucun'] : filters;
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
                     onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"200\"><rect width=\"300\" height=\"200\" fill=\"%23f1f5f9\"/><text x=\"50%\" y=\"50%\" font-family=\"Arial\" font-size=\"14\" fill=\"%2364748b\" text-anchor=\"middle\" dy=\".3em\">Image GitHub</text></svg>'">
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
                <i class="fab fa-github"></i>
                <span title="${escapeHTML(file.nom)}">${escapeHTML(shortName)}</span>
            </div>
        </div>
        
        <div class="card-actions">
            ${buttonsHTML}
        </div>
    `;
    
    return div;
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
                     onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"300\"><rect width=\"400\" height=\"300\" fill=\"%23f1f5f9\"/><text x=\"50%\" y=\"50%\" font-family=\"Arial\" font-size=\"16\" fill=\"%2364748b\" text-anchor=\"middle\" dy=\".3em\">Image GitHub</text></svg>'">
            </div>
            <div class="image-footer">
                <a href="${escapeHTML(imageUrl)}" class="btn-download" download="${escapeHTML(fileName)}">
                    <i class="fas fa-download"></i> Télécharger
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

// ================= GESTION INTERFACE =================
function showHomeContent() {
    const welcomeState = document.getElementById('welcomeState');
    const noResultsState = document.getElementById('noResultsState');
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (welcomeState) welcomeState.style.display = 'block';
    if (noResultsState) noResultsState.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'none';
}

function showResultsContent() {
    const welcomeState = document.getElementById('welcomeState');
    if (welcomeState) welcomeState.style.display = 'none';
}

async function rescanGitHub() {
    const scanBtn = document.getElementById('scanNewFilesBtn');
    if (scanBtn) {
        scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scan...';
        scanBtn.disabled = true;
    }
    
    fileIndex = await scanGitHubFolder();
    
    const searchInput = document.getElementById('exercicesSearchInput');
    if (searchInput && searchInput.value.trim()) {
        performSearch(searchInput.value.trim());
    }
    
    if (scanBtn) {
        scanBtn.innerHTML = '<i class="fab fa-github"></i> Re-scan GitHub';
        scanBtn.disabled = false;
    }
}

// ================= INITIALISATION =================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 mathX_searcher - GitHub Edition');
    
    try {
        // 1. Initialiser filtres
        initFilters();
        
        // 2. Scanner GitHub
        console.log('🔍 Connexion à GitHub...');
        fileIndex = await scanGitHubFolder();
        
        // 3. Initialiser interface
        initInterface();
        
        // 4. Afficher état initial
        showHomeContent();
        
        console.log(`✅ ${fileIndex.length} fichiers chargés depuis GitHub`);
        
    } catch (error) {
        console.error('❌ Erreur initialisation:', error);
    }
});

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
        scanBtn.addEventListener('click', rescanGitHub);
    }
}

// ================= EXPORT =================
window.ExercicesManager = {
    scan: scanGitHubFolder,
    search: performSearch,
    getFiles: () => fileIndex,
    getFilters: () => activeFilters,
    rescan: rescanGitHub
};

window.openImagePreview = openImagePreview;
window.closeImagePreview = closeImagePreview;
window.rescanGitHub = rescanGitHub;
window.performSearch = performSearch;

// Console styling
console.log('%c✨ mathX_searcher - GitHub Edition ✨', 'color: #6e40c9; font-size: 18px; font-weight: bold;');
console.log('%c📚 Repo: ivanipote/MathX_searcher', 'color: #4078c0; font-size: 14px;');
console.log('%c📁 Dossier: exercices/', 'color: #4078c0; font-size: 14px;');
console.log('%c🚀 API GitHub activée', 'color: #6cc644; font-size: 14px;');
console.log('='.repeat(60));