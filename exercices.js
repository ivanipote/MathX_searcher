// exercices.js - VERSION COMPLÈTE CORRIGÉE
// mathX_searcher - GitHub Edition

// ================= CONFIGURATION =================
const CONFIG = {
    DEBOUNCE_DELAY: 300,
    MIN_CHARS: 2,
    MAX_TITLE_LENGTH: 50,
    MAX_FILENAME_LENGTH: 30
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
let currentUser = null;

// ================= VÉRIFICATION AUTH =================
async function checkAuthentication() {
    try {
        // Vérifier Firebase d'abord
        if (typeof firebase !== 'undefined' && firebase.auth) {
            return new Promise((resolve) => {
                firebase.auth().onAuthStateChanged((user) => {
                    currentUser = user;
                    const isAuthenticated = user || localStorage.getItem('mathx_user') || 
                                           localStorage.getItem('mathx_profile_data');
                    resolve(isAuthenticated);
                });
            });
        }
        
        // Fallback: localStorage
        const cachedUser = localStorage.getItem('mathx_user');
        const profileData = localStorage.getItem('mathx_profile_data');
        const testMode = localStorage.getItem('mathx_test_mode') === 'true';
        
        return cachedUser || profileData || testMode;
    } catch (error) {
        console.error('❌ Erreur vérification auth:', error);
        return false;
    }
}

// ================= FONCTIONS UTILITAIRES =================
function getFileType(extension) {
    if (['pdf'].includes(extension)) return 'pdf';
    if (['txt', 'md', 'rtf', 'tex'].includes(extension)) return 'txt';
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

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

function extractKeywords(filename) {
    const title = formatFileName(filename);
    const words = title.toLowerCase().split(/\s+/);
    const ignoreWords = ['de', 'des', 'du', 'et', 'ou', 'les', 'la', 'le', 'un', 'une'];
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

function extractMathContent(text) {
    // Extraire les formules mathématiques (entre $$ ou \( \))
    const mathPattern = /\$\$([^$]+)\$\$|\\\(([^)]+)\\\)/g;
    const matches = [];
    let match;
    
    while ((match = mathPattern.exec(text)) !== null) {
        const formula = match[1] || match[2];
        if (formula) matches.push(formula.trim());
    }
    
    return matches;
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
    let mathFormulas = [];
    
    if (type === 'txt' && item.size < 100000) {
        try {
            const response = await fetch(rawUrl);
            if (response.ok) {
                const texte = await response.text();
                extrait = texte.substring(0, 300).replace(/\n/g, ' ');
                mathFormulas = extractMathContent(texte.substring(0, 1000));
            }
        } catch (e) {
            console.warn('⚠️ Erreur chargement texte:', e);
        }
    }
    
    return {
        id: `gh-${item.sha?.substring(0, 8) || Date.now()}`,
        nom: item.name,
        nomAffiche: truncateText(item.name, CONFIG.MAX_FILENAME_LENGTH),
        chemin: `${GITHUB_CONFIG.DOSSIER_EXERCICES}/${cheminRelatif}`,
        url: rawUrl,
        type: type,
        titre: truncateText(formatFileName(item.name), CONFIG.MAX_TITLE_LENGTH),
        description: getFileDescription(type),
        icon: getFileIcon(type),
        color: getFileColor(type),
        humanSize: formatFileSize(item.size || 0),
        taille: item.size || 0,
        extrait: extrait,
        mathFormulas: mathFormulas,
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
                    nomAffiche: truncateText(fichier.nom, CONFIG.MAX_FILENAME_LENGTH),
                    chemin: fichier.chemin,
                    url: rawUrl,
                    type: type,
                    titre: truncateText(formatFileName(fichier.nom), CONFIG.MAX_TITLE_LENGTH),
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
            nomAffiche: 'exemple_math.pdf',
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
            nomAffiche: 'exercice_algebre.txt',
            chemin: 'exercices/exercice_algebre.txt',
            url: `${RAW_BASE}exercices/exercice_algebre.txt`,
            type: 'txt',
            titre: 'Exercice Algèbre',
            description: 'Exercice de mathématiques',
            icon: '📃',
            color: 'file-text',
            humanSize: '4.5 KB',
            extrait: 'Exercice sur les matrices...',
            mathFormulas: ['A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}'],
            motsCles: ['exercice', 'algèbre', 'math']
        },
        {
            id: 'sample-3',
            nom: 'schema_geometrie.png',
            nomAffiche: 'schema_geometrie.png',
            chemin: 'exercices/schema_geometrie.png',
            url: `${RAW_BASE}exercices/schema_geometrie.png`,
            type: 'image',
            titre: 'Schéma Géométrie',
            description: 'Image ou schéma',
            icon: '🖼️',
            color: 'file-image',
            humanSize: '150 KB',
            motsCles: ['schéma', 'géométrie', 'image']
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
        previewHTML = createTextPreview(file);
    } else if (file.type === 'image') {
        previewHTML = createImagePreview(file);
    } else {
        previewHTML = `<div class="file-description">${escapeHTML(file.description)}</div>`;
    }
    
    const buttonsHTML = createFileButtons(file);
    
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
                <span title="${escapeHTML(file.nom)}">${escapeHTML(file.nomAffiche)}</span>
            </div>
        </div>
        
        <div class="card-actions">
            ${buttonsHTML}
        </div>
    `;
    
    // Ajouter KaTeX pour les formules si nécessaire
    if (file.type === 'txt' && file.mathFormulas && file.mathFormulas.length > 0) {
        setTimeout(() => {
            renderMathFormulas(div, file.mathFormulas);
        }, 100);
    }
    
    return div;
}

function createTextPreview(file) {
    let content = escapeHTML(file.extrait || 'Contenu texte');
    
    // Ajouter un indicateur de formules mathématiques
    let mathIndicator = '';
    if (file.mathFormulas && file.mathFormulas.length > 0) {
        mathIndicator = `<div class="math-indicator"><i class="fas fa-square-root-alt"></i> ${file.mathFormulas.length} formule(s) mathématique(s)</div>`;
    }
    
    return `
        <div class="exercise-preview">
            ${mathIndicator}
            <div class="text-content">${content}</div>
            ${file.extrait && file.extrait.length > 300 ? '<div class="more-text">...</div>' : ''}
        </div>
    `;
}

function createImagePreview(file) {
    // Utiliser une image placeholder pendant le chargement
    const placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="%23f1f5f9"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="%2364748b" text-anchor="middle" dy=".3em">Chargement de l\'image...</text></svg>';
    
    return `
        <div class="image-container">
            <img src="${placeholder}" 
                 data-src="${escapeHTML(file.url)}" 
                 alt="${escapeHTML(file.titre)}" 
                 class="image-preview lazy"
                 loading="lazy"
                 onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"200\"><rect width=\"300\" height=\"200\" fill=\"%23f1f5f9\"/><text x=\"50%" y=\"50%\" font-family=\"Arial\" font-size=\"14\" fill=\"%2364748b\" text-anchor=\"middle\" dy=\".3em\">Image non disponible</text></svg>';"
                 onclick="openImagePreview('${escapeHTML(file.url)}', '${escapeHTML(file.nom)}')">
            <div class="image-loading">
                <i class="fas fa-spinner fa-spin"></i> Chargement...
            </div>
        </div>
    `;
}

function createFileButtons(file) {
    if (file.type === 'pdf') {
        return `
            <a href="${escapeHTML(file.url)}" class="action-download" download="${escapeHTML(file.nom)}">
                <i class="fas fa-download"></i> Télécharger
            </a>
            <a href="https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true" 
               target="_blank" class="action-open">
                <i class="fas fa-external-link-alt"></i> Ouvrir
            </a>
        `;
    } else if (file.type === 'txt') {
        return `
            <a href="${escapeHTML(file.url)}" class="action-download" download="${escapeHTML(file.nom)}">
                <i class="fas fa-download"></i> Télécharger
            </a>
            <a href="${escapeHTML(file.url)}" target="_blank" class="action-open" onclick="event.stopPropagation();">
                <i class="fas fa-external-link-alt"></i> Ouvrir
            </a>
        `;
    } else if (file.type === 'image') {
        return `
            <a href="${escapeHTML(file.url)}" class="action-download" download="${escapeHTML(file.nom)}" onclick="downloadImage(event, '${escapeHTML(file.url)}', '${escapeHTML(file.nom)}')">
                <i class="fas fa-download"></i> Télécharger
            </a>
            <button class="action-open" onclick="openImagePreview('${escapeHTML(file.url)}', '${escapeHTML(file.nom)}')">
                <i class="fas fa-eye"></i> Voir
            </button>
        `;
    } else {
        return `
            <a href="${escapeHTML(file.url)}" class="action-download" download="${escapeHTML(file.nom)}">
                <i class="fas fa-download"></i> Télécharger
            </a>
        `;
    }
}

// ================= GESTION DES IMAGES =================
function downloadImage(event, imageUrl, fileName) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('📥 Tentative de téléchargement:', fileName);
    
    // Créer un lien temporaire pour le téléchargement
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    link.target = '_blank';
    
    // Ajouter au DOM, cliquer, et supprimer
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ Téléchargement initié pour:', fileName);
    
    // Message utilisateur
    showNotification(`Téléchargement de "${fileName}" démarré`, 'success');
}

// ================= VISIONNEUSE D'IMAGES AMÉLIORÉE =================
function openImagePreview(imageUrl, fileName) {
    console.log('🖼️ Ouverture visionneuse pour:', fileName);
    
    // Fermer toute visionneuse existante
    closeImagePreview();
    
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
            <div class="image-container-modal">
                <div class="image-loader">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p>Chargement de l'image...</p>
                </div>
                <img src="${escapeHTML(imageUrl)}" 
                     alt="${escapeHTML(fileName)}" 
                     class="modal-image"
                     onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';"
                     onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"400\"><rect width=\"600\" height=\"400\" fill=\"%23f1f5f9\"/><text x=\"50%\" y=\"50%\" font-family=\"Arial\" font-size=\"16\" fill=\"%2364748b\" text-anchor=\"middle\" dy=\".3em\">Image non disponible</text></svg>';">
            </div>
            <div class="image-footer">
                <button class="btn-download" onclick="downloadImageFromModal('${escapeHTML(imageUrl)}', '${escapeHTML(fileName)}')">
                    <i class="fas fa-download"></i> Télécharger
                </button>
                <button class="btn-close" onclick="closeImagePreview()">
                    <i class="fas fa-times"></i> Fermer
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    
    // Ajouter le CSS pour la modal si pas déjà présent
    addImageModalCSS();
    
    // Fermer avec Escape
    overlay.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeImagePreview();
    });
    
    // Focus sur le bouton fermer pour navigation clavier
    setTimeout(() => {
        const closeBtn = overlay.querySelector('.close-btn');
        if (closeBtn) closeBtn.focus();
    }, 100);
}

function downloadImageFromModal(imageUrl, fileName) {
    downloadImage({ preventDefault: () => {}, stopPropagation: () => {} }, imageUrl, fileName);
}

function closeImagePreview() {
    const overlay = document.querySelector('.image-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.remove();
            document.body.style.overflow = '';
        }, 300);
    }
}

function addImageModalCSS() {
    if (document.getElementById('image-modal-css')) return;
    
    const style = document.createElement('style');
    style.id = 'image-modal-css';
    style.textContent = `
        .image-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(10px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        }
        
        .image-modal {
            background: white;
            border-radius: 15px;
            overflow: hidden;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            animation: slideUp 0.3s ease;
        }
        
        [data-theme="dark"] .image-modal {
            background: #334155;
        }
        
        .image-header {
            padding: 20px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        [data-theme="dark"] .image-header {
            background: #475569;
            border-color: #64748b;
        }
        
        .image-header h3 {
            margin: 0;
            color: #1e293b;
            font-size: 1.2rem;
        }
        
        [data-theme="dark"] .image-header h3 {
            color: #f1f5f9;
        }
        
        .close-btn {
            background: none;
            border: none;
            font-size: 1.5rem;
            color: #64748b;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .close-btn:hover {
            background: rgba(0, 0, 0, 0.1);
            color: #dc2626;
        }
        
        .image-container-modal {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            max-height: 70vh;
            position: relative;
        }
        
        .image-loader {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #64748b;
        }
        
        .modal-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            opacity: 0;
            transition: opacity 0.3s ease;
            border-radius: 8px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
        }
        
        .image-footer {
            padding: 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        
        [data-theme="dark"] .image-footer {
            background: #475569;
            border-color: #64748b;
        }
        
        .btn-download, .btn-close {
            padding: 10px 24px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
        }
        
        .btn-download {
            background: linear-gradient(135deg, #06b6d4, #0891b2);
            color: white;
        }
        
        .btn-download:hover {
            background: linear-gradient(135deg, #0891b2, #0e7490);
            transform: translateY(-2px);
        }
        
        .btn-close {
            background: #f1f5f9;
            color: #475569;
            border: 2px solid #e2e8f0;
        }
        
        [data-theme="dark"] .btn-close {
            background: #64748b;
            color: #f1f5f9;
            border-color: #94a3b8;
        }
        
        .btn-close:hover {
            background: #e2e8f0;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        /* Lazy loading images */
        .image-preview.lazy {
            opacity: 0.5;
            transition: opacity 0.3s ease;
        }
        
        .image-preview.lazy.loaded {
            opacity: 1;
        }
        
        .image-loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #64748b;
            font-size: 0.9rem;
        }
        
        /* Indicateur formules math */
        .math-indicator {
            background: rgba(16, 185, 129, 0.1);
            color: #065f46;
            padding: 5px 10px;
            border-radius: 4px;
            margin-bottom: 10px;
            font-size: 0.85rem;
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }
        
        [data-theme="dark"] .math-indicator {
            background: rgba(16, 185, 129, 0.2);
            color: #6ee7b7;
        }
    `;
    
    document.head.appendChild(style);
}

// ================= KATEX POUR LES FORMULES MATH =================
function renderMathFormulas(container, formulas) {
    if (!formulas || formulas.length === 0) return;
    
    // Vérifier si KaTeX est chargé
    if (typeof katex === 'undefined') {
        console.warn('⚠️ KaTeX non chargé');
        return;
    }
    
    const textContent = container.querySelector('.text-content');
    if (!textContent) return;
    
    formulas.forEach(formula => {
        try {
            // Remplacer les formules dans le texte si elles y sont
            const text = textContent.innerHTML;
            const escapedFormula = formula.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedFormula.replace(/\s+/g, '\\s+'), 'g');
            
            if (regex.test(text)) {
                textContent.innerHTML = textContent.innerHTML.replace(
                    regex,
                    (match) => {
                        try {
                            return katex.renderToString(match, {
                                throwOnError: false,
                                displayMode: false
                            });
                        } catch (e) {
                            console.warn('Erreur KaTeX:', e);
                            return match;
                        }
                    }
                );
            }
        } catch (error) {
            console.warn('⚠️ Erreur rendu formule:', error);
        }
    });
    
    // Ajouter aussi un bloc de formules en bas
    if (formulas.length > 0) {
        const formulaBlock = document.createElement('div');
        formulaBlock.className = 'math-formulas-block';
        formulaBlock.innerHTML = `
            <div class="formulas-header">
                <i class="fas fa-square-root-alt"></i>
                <span>Formules mathématiques :</span>
            </div>
            <div class="formulas-container">
                ${formulas.map((formula, index) => `
                    <div class="formula-item" data-index="${index}">
                        ${katex.renderToString(formula, { throwOnError: false, displayMode: false })}
                    </div>
                `).join('')}
            </div>
        `;
        
        const preview = container.querySelector('.exercise-preview');
        if (preview) {
            preview.appendChild(formulaBlock);
        }
        
        // Ajouter le CSS pour les formules
        addMathFormulasCSS();
    }
}

function addMathFormulasCSS() {
    if (document.getElementById('math-formulas-css')) return;
    
    const style = document.createElement('style');
    style.id = 'math-formulas-css';
    style.textContent = `
        .math-formulas-block {
            margin-top: 15px;
            padding: 10px;
            background: rgba(6, 182, 212, 0.05);
            border-radius: 8px;
            border-left: 3px solid #06b6d4;
        }
        
        [data-theme="dark"] .math-formulas-block {
            background: rgba(6, 182, 212, 0.1);
        }
        
        .formulas-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            color: #1e293b;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        [data-theme="dark"] .formulas-header {
            color: #f1f5f9;
        }
        
        .formulas-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .formula-item {
            background: white;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            font-size: 0.9rem;
            overflow-x: auto;
        }
        
        [data-theme="dark"] .formula-item {
            background: #475569;
            border-color: #64748b;
        }
        
        .katex {
            font-size: 1.1em !important;
        }
        
        .text-content .katex {
            font-size: 1em !important;
            background: rgba(16, 185, 129, 0.1);
            padding: 2px 4px;
            border-radius: 3px;
        }
    `;
    
    document.head.appendChild(style);
}

// ================= LAZY LOADING IMAGES =================
function initLazyLoading() {
    const lazyImages = document.querySelectorAll('.image-preview.lazy');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.getAttribute('data-src');
                
                if (src) {
                    img.src = src;
                    img.classList.remove('lazy');
                    img.classList.add('loaded');
                    
                    // Cacher le loader
                    const loader = img.parentElement.querySelector('.image-loading');
                    if (loader) {
                        loader.style.display = 'none';
                    }
                }
                
                observer.unobserve(img);
            }
        });
    });
    
    lazyImages.forEach(img => imageObserver.observe(img));
}

// ================= NOTIFICATIONS =================
function showNotification(message, type = 'info') {
    // Supprimer les notifications existantes
    const oldNotifications = document.querySelectorAll('.global-notification');
    oldNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `global-notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove après 4 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'notificationSlideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
    
    // Ajouter le CSS si nécessaire
    addNotificationCSS();
}

function addNotificationCSS() {
    if (document.getElementById('notification-css')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-css';
    style.textContent = `
        .global-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-radius: 10px;
            padding: 15px 20px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            min-width: 300px;
            max-width: 400px;
            animation: notificationSlideIn 0.3s ease;
            border-left: 4px solid #06b6d4;
        }
        
        [data-theme="dark"] .global-notification {
            background: #334155;
        }
        
        .notification-success {
            border-left-color: #10b981;
        }
        
        .notification-error {
            border-left-color: #ef4444;
        }
        
        .notification-info {
            border-left-color: #06b6d4;
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
        }
        
        .notification-content i {
            font-size: 1.2rem;
        }
        
        .notification-success .notification-content i {
            color: #10b981;
        }
        
        .notification-error .notification-content i {
            color: #ef4444;
        }
        
        .notification-info .notification-content i {
            color: #06b6d4;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: #64748b;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .notification-close:hover {
            background: rgba(0, 0, 0, 0.1);
        }
        
        @keyframes notificationSlideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes notificationSlideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// ================= GESTION INTERFACE =================
function showHomeContent() {
    const welcomeState = document.getElementById('welcomeState');
    const noResultsState = document.getElementById('noResultsState');
    const resultsContainer = document.getElementById('resultsContainer');
    const noSearchMessage = document.getElementById('noSearchMessage');
    
    if (welcomeState) welcomeState.style.display = 'block';
    if (noResultsState) noResultsState.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (noSearchMessage) noSearchMessage.style.display = 'none';
}

function showResultsContent() {
    const welcomeState = document.getElementById('welcomeState');
    const noSearchMessage = document.getElementById('noSearchMessage');
    if (welcomeState) welcomeState.style.display = 'none';
    if (noSearchMessage) noSearchMessage.style.display = 'none';
}

async function rescanGitHub() {
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
        showNotification('Veuillez vous connecter pour scanner les exercices', 'error');
        return;
    }
    
    const scanBtn = document.getElementById('scanNewFilesBtn');
    if (scanBtn) {
        scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scan...';
        scanBtn.disabled = true;
    }
    
    try {
        fileIndex = await scanGitHubFolder();
        showNotification(`${fileIndex.length} fichiers trouvés`, 'success');
        
        const searchInput = document.getElementById('exercicesSearchInput');
        if (searchInput && searchInput.value.trim()) {
            performSearch(searchInput.value.trim());
        }
    } catch (error) {
        showNotification('Erreur lors du scan: ' + error.message, 'error');
    } finally {
        if (scanBtn) {
            scanBtn.innerHTML = '<i class="fab fa-github"></i> Re-scan GitHub';
            scanBtn.disabled = false;
        }
    }
}

// ================= INITIALISATION =================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 mathX_searcher - GitHub Edition');
    
    // Vérifier l'authentification IMMÉDIATEMENT
    const isAuthenticated = await checkAuthentication();
    
    if (!isAuthenticated) {
        // Afficher l'overlay d'authentification
        const authOverlay = document.getElementById('authOverlay');
        if (authOverlay) {
            authOverlay.style.display = 'flex';
            
            // Cacher le contenu principal
            document.querySelector('.ex-header')?.style.setProperty('display', 'none', 'important');
            document.querySelector('main')?.style.setProperty('display', 'none', 'important');
            document.querySelector('.bottom-nav')?.style.setProperty('display', 'none', 'important');
            
            // Configurer les boutons de l'overlay
            setupAuthOverlayButtons();
            return;
        }
    }
    
    try {
        // 1. Initialiser filtres
        initFilters();
        
        // 2. Scanner GitHub (si authentifié)
        console.log('🔍 Connexion à GitHub...');
        fileIndex = await scanGitHubFolder();
        
        // 3. Initialiser interface
        initInterface();
        
        // 4. Afficher état initial
        showHomeContent();
        
        // 5. Initialiser lazy loading
        initLazyLoading();
        
        console.log(`✅ ${fileIndex.length} fichiers chargés depuis GitHub`);
        
    } catch (error) {
        console.error('❌ Erreur initialisation:', error);
        showNotification('Erreur de chargement: ' + error.message, 'error');
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
    
    const rescanBtn = document.getElementById('rescanBtn');
    if (rescanBtn) {
        rescanBtn.addEventListener('click', rescanGitHub);
    }
}

function setupAuthOverlayButtons() {
    const goToLoginBtn = document.getElementById('goToLoginBtn');
    const goToSignupBtn = document.getElementById('goToSignupBtn');
    const goToHomeBtn = document.getElementById('goToHomeBtn');
    
    if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', function() {
            localStorage.setItem('mathx_redirect_after_login', 'exercices.html');
            window.location.href = 'auth.html';
        });
    }
    
    if (goToSignupBtn) {
        goToSignupBtn.addEventListener('click', function() {
            localStorage.setItem('mathx_redirect_after_login', 'exercices.html');
            localStorage.setItem('mathx_force_signup_tab', 'true');
            window.location.href = 'auth.html';
        });
    }
    
    if (goToHomeBtn) {
        goToHomeBtn.addEventListener('click', function() {
            window.location.href = 'index.html';
        });
    }
}

// ================= EXPORT =================
window.ExercicesManager = {
    scan: scanGitHubFolder,
    search: performSearch,
    getFiles: () => fileIndex,
    getFilters: () => activeFilters,
    rescan: rescanGitHub,
    checkAuth: checkAuthentication
};

window.openImagePreview = openImagePreview;
window.closeImagePreview = closeImagePreview;
window.rescanGitHub = rescanGitHub;
window.performSearch = performSearch;
window.downloadImage = downloadImage;

// Console styling
console.log('%c✨ mathX_searcher - GitHub Edition ✨', 'color: #6e40c9; font-size: 18px; font-weight: bold;');
console.log('%c📚 Repo: ivanipote/MathX_searcher', 'color: #4078c0; font-size: 14px;');
console.log('%c📁 Dossier: exercices/', 'color: #4078c0; font-size: 14px;');
console.log('%c🚀 API GitHub activée', 'color: #6cc644; font-size: 14px;');
console.log('='.repeat(60));