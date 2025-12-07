// Configuration
const CONFIG = {
    exercicesDir: 'exercices/',
    repoInfo: {
        owner: 'ivanipote',
        repo: 'formule_search',
        branch: 'main'
    },
    fileTypes: {
        pdf: ['pdf'],
        txt: ['txt'],
        image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
    }
};

// État global
let allExercises = [];
let currentFilter = 'all';
let currentSearch = '';

// Éléments DOM
let hamburgerBtn, closeSidebar, sidebar, overlay, mainSearch, searchBtn;
let resultsContainer, resultsCount, typeFilters;
let pdfTemplate, imageTemplate, txtTemplate;

// ==================== FONCTIONS UTILITAIRES ====================

// Logger amélioré
const logger = {
    log: (...args) => console.log('📝', ...args),
    error: (...args) => console.error('❌', ...args),
    warn: (...args) => console.warn('⚠️', ...args),
    success: (...args) => console.log('✅', ...args),
    debug: (...args) => console.debug('🐛', ...args)
};

function formatCategory(category) {
    const categories = {
        'geometrie': 'géométrie',
        'algebre': 'algèbre',
        'analyse': 'analyse',
        'physique': 'physique-chimie',
        'pc': 'physique-chimie',
        'math': 'mathématiques',
        'maths': 'mathématiques',
        'physique-chimie': 'physique-chimie'
    };
    return categories[category.toLowerCase()] || category;
}

function formatTitle(title) {
    return title
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function generateDescription(category, title, fileType) {
    const typeMap = {
        'pdf': 'Document PDF',
        'txt': 'Fichier texte avec exercices',
        'image': 'Image illustrative'
    };
    const fileTypeDesc = typeMap[fileType] || 'Fichier';
    return `${fileTypeDesc} sur ${category} - ${title}`;
}

function createExerciseFromFile(filePath) {
    const fileName = filePath.split('/').pop();
    const fileExt = fileName.split('.').pop().toLowerCase();
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    
    const parts = baseName.split('-');
    let category = 'général';
    let title = baseName;
    
    if (parts.length >= 2) {
        category = formatCategory(parts[0]);
        title = parts.slice(1).join(' ').replace(/-/g, ' ');
    }
    
    let fileType = 'pdf';
    if (CONFIG.fileTypes.txt.includes(fileExt)) fileType = 'txt';
    if (CONFIG.fileTypes.image.includes(fileExt)) fileType = 'image';
    
    title = formatTitle(title);
    const description = generateDescription(category, title, fileType);
    
    return {
        id: `ex-${baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
        title: title,
        filename: fileName,
        path: filePath,
        type: fileType,
        category: category,
        description: description,
        rawName: baseName
    };
}

async function discoverExercisesFiles() {
    logger.log('🔍 Début du scan des fichiers...');
    
    // Liste de fichiers connus
    const knownFiles = [
        'exercices/geometrie-pythagore.pdf',
        'exercices/geometrie-triangles.txt',
        'exercices/geometrie-cercles.png',
        'exercices/algebre-equations.pdf',
        'exercices/algebre-polynomes.txt',
        'exercices/analyse-derivees.pdf',
        'exercices/analyse-integrales.txt',
        'exercices/physique-mecanique.pdf',
        'exercices/physique-electricite.txt',
        'exercices/physique-atome.png'
    ];
    
    const discoveredFiles = [];
    
    // Tester chaque fichier
    for (const filePath of knownFiles) {
        try {
            const rawUrl = `https://raw.githubusercontent.com/${CONFIG.repoInfo.owner}/${CONFIG.repoInfo.repo}/${CONFIG.repoInfo.branch}/${filePath}`;
            const response = await fetch(rawUrl, { method: 'HEAD' });
            
            if (response.ok) {
                discoveredFiles.push(filePath);
                logger.success(`Trouvé: ${filePath}`);
            } else {
                logger.debug(`Non trouvé: ${filePath}`);
            }
        } catch (error) {
            logger.debug(`Erreur pour ${filePath}: ${error.message}`);
        }
    }
    
    // Essayer de détecter d'autres fichiers
    const possibleCategories = ['geometrie', 'algebre', 'analyse', 'physique', 'pc', 'maths'];
    const possibleNames = ['exercice', 'test', 'exo', 'probleme', 'corrige', 'solution'];
    
    // Générer quelques combinaisons
    const extraFiles = [];
    for (const category of possibleCategories) {
        for (const name of possibleNames) {
            extraFiles.push(`exercices/${category}-${name}.pdf`);
            extraFiles.push(`exercices/${category}-${name}.txt`);
            extraFiles.push(`exercices/${category}-${name}.png`);
        }
    }
    
    // Tester quelques combinaisons
    const sampleFiles = extraFiles.slice(0, 30);
    for (const filePath of sampleFiles) {
        if (discoveredFiles.includes(filePath)) continue;
        
        try {
            const rawUrl = `https://raw.githubusercontent.com/${CONFIG.repoInfo.owner}/${CONFIG.repoInfo.repo}/${CONFIG.repoInfo.branch}/${filePath}`;
            const response = await fetch(rawUrl, { method: 'HEAD' });
            
            if (response.ok) {
                discoveredFiles.push(filePath);
                logger.success(`NOUVEAU FICHIER DÉTECTÉ: ${filePath}`);
            }
        } catch (error) {
            // Ignorer les erreurs
        }
    }
    
    if (discoveredFiles.length === 0) {
        logger.warn('Aucun fichier trouvé, utilisation des exemples');
        return knownFiles.slice(0, 3); // Retourner quelques exemples
    }
    
    logger.success(`Total fichiers détectés: ${discoveredFiles.length}`);
    return discoveredFiles;
}

async function scanExercisesDirectory() {
    logger.log('📁 Scan du dossier exercices/...');
    
    const knownFiles = await discoverExercisesFiles();
    allExercises = knownFiles.map(file => createExerciseFromFile(file));
    
    allExercises.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.title.localeCompare(b.title);
    });
    
    logger.success(`${allExercises.length} exercices chargés`);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function highlightText(text, searchTerm) {
    if (!searchTerm || !text || typeof text !== 'string') return text || '';
    try {
        const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedSearch})`, 'gi');
        return text.replace(regex, '<mark class="highlight">$1</mark>');
    } catch (e) {
        return text;
    }
}

function getSampleContentWithMathJax(category) {
    const samples = {
        'géométrie': `
            <h4>Exercice de Géométrie</h4>
            <p><strong>Théorème de Pythagore :</strong></p>
            <p>\\(a^2 + b^2 = c^2\\)</p>
            <p>Avec \\(a = 3\\,cm\\) et \\(b = 4\\,cm\\), calculer \\(c\\).</p>
            <p><strong>Solution :</strong> \\(c = \\sqrt{3^2 + 4^2} = 5\\,cm\\)</p>
        `,
        'algèbre': `
            <h4>Exercice d'Algèbre</h4>
            <p><strong>Équation du second degré :</strong></p>
            <p>\\(x^2 - 5x + 6 = 0\\)</p>
            <p><strong>Solution :</strong> \\(S = \\{2, 3\\}\\)</p>
        `,
        'analyse': `
            <h4>Exercice d'Analyse</h4>
            <p><strong>Dérivée de fonction :</strong></p>
            <p>\\(f(x) = 3x^4 - 2x^2 + 5\\)</p>
            <p><strong>Solution :</strong> \\(f'(x) = 12x^3 - 4x\\)</p>
        `,
        'physique-chimie': `
            <h4>Exercice de Physique-Chimie</h4>
            <p><strong>Loi d'Ohm :</strong></p>
            <p>\\(U = R \\times I\\)</p>
            <p>Avec \\(U = 12\\,V\\) et \\(R = 100\\,\\Omega\\), calculer \\(I\\).</p>
            <p><strong>Solution :</strong> \\(I = 0.12\\,A = 120\\,mA\\)</p>
        `
    };
    
    return samples[category] || `
        <h4>Exercice</h4>
        <p>Contenu avec formules MathJax : \\(\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)</p>
    `;
}

async function loadTextContent(filePath, container, category) {
    try {
        const rawUrl = `https://raw.githubusercontent.com/${CONFIG.repoInfo.owner}/${CONFIG.repoInfo.repo}/${CONFIG.repoInfo.branch}/${filePath}`;
        const response = await fetch(rawUrl);
        
        if (response.ok) {
            const content = await response.text();
            
            // FORMATER POUR MATHJAX
            let formattedContent = content
                .replace(/\$(.*?)\$/g, '\\($1\\)')
                .replace(/\\\[(.*?)\\\]/g, '\\[$1\\]')
                .replace(/\\\((.*?)\\\)/g, '\\($1\\)');
            
            if (content.length > 5000) {
                container.innerHTML = `<div class="text-preview">${formattedContent.substring(0, 5000)}...</div>`;
            } else {
                container.innerHTML = `<div class="text-full">${formattedContent}</div>`;
            }
            
            // FORCER MATHJAX
            if (window.MathJax && window.MathJax.typesetPromise) {
                setTimeout(() => {
                    MathJax.typesetPromise([container]).catch(err => {
                        logger.debug('MathJax erreur:', err);
                    });
                }, 100);
            }
            
        } else {
            container.innerHTML = getSampleContentWithMathJax(category);
        }
        
    } catch (error) {
        logger.warn('Impossible de charger le fichier texte:', error);
        container.innerHTML = getSampleContentWithMathJax(category);
    }
}

function openFile(url, type, filename, title = '') {
    if (type === 'pdf') {
        const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        window.open(googleViewerUrl, '_blank');
    } else if (type === 'image') {
        window.open(url, '_blank');
    } else if (type === 'txt') {
        const textWindow = window.open('', '_blank', 'width=800,height=600');
        if (textWindow) {
            textWindow.document.write(`
                <html>
                    <head>
                        <title>${title}</title>
                        <style>
                            body { font-family: Arial; padding: 20px; }
                            pre { white-space: pre-wrap; }
                        </style>
                        <script>
                            MathJax = {
                                tex: {
                                    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']]
                                }
                            };
                        </script>
                        <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
                    </head>
                    <body>
                        <h2>${title}</h2>
                        <pre id="content">Chargement...</pre>
                    </body>
                </html>
            `);
            
            fetch(url)
                .then(r => r.text())
                .then(t => {
                    textWindow.document.getElementById('content').textContent = t;
                    if (textWindow.MathJax) {
                        textWindow.MathJax.typesetPromise();
                    }
                });
        }
    }
}

function downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==================== FONCTIONS D'AFFICHAGE ====================

function showWelcomePage() {
    if (!resultsCount || !resultsContainer) return;
    
    const count = allExercises.length || 0;
    resultsCount.textContent = `${count} exercice${count !== 1 ? 's' : ''} disponible${count !== 1 ? 's' : ''}`;
    currentSearch = '';
    
    resultsContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <i class="fas fa-pen-fancy"></i>
            </div>
            <h3>${count} exercices disponibles</h3>
            <p>Recherchez par nom, catégorie ou type de fichier</p>
            <div class="welcome-examples">
                <span class="example-tag">Pythagore</span>
                <span class="example-tag">Équations</span>
                <span class="example-tag">Dérivées</span>
                <span class="example-tag">Électricité</span>
            </div>
            <div class="welcome-tips">
                <p><i class="fas fa-lightbulb"></i> Format recommandé: categorie-nom.extension (ex: physique-electricite.txt)</p>
            </div>
        </div>
    `;
}

function showError(message) {
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon" style="color: #ef4444;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 style="color: #ef4444;">Erreur</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="
                padding: 10px 20px;
                background: #4361ee;
                color: white;
                border: none;
                border-radius: 8px;
                margin-top: 20px;
                cursor: pointer;
            ">
                Réessayer
            </button>
        </div>
    `;
}

function createExerciseCard(exercise) {
    if (!pdfTemplate || !imageTemplate || !txtTemplate) {
        logger.warn('Templates non chargés, carte simple');
        return createSimpleCard(exercise);
    }
    
    let template;
    switch (exercise.type) {
        case 'pdf': template = pdfTemplate; break;
        case 'image': template = imageTemplate; break;
        case 'txt': template = txtTemplate; break;
        default: return createSimpleCard(exercise);
    }
    
    try {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.exercise-card');
        
        if (!card) {
            return createSimpleCard(exercise);
        }
        
        // Titre
        const titleEl = card.querySelector('.exercise-title');
        if (titleEl) titleEl.innerHTML = highlightText(exercise.title, currentSearch);
        
        // Catégorie
        const categoryEl = card.querySelector('.file-category');
        if (categoryEl) categoryEl.textContent = exercise.category;
        
        // Description
        const descEl = card.querySelector('.exercise-description');
        if (descEl) descEl.innerHTML = highlightText(exercise.description, currentSearch);
        
        // Image preview
        const previewImg = card.querySelector('.preview-img');
        if (previewImg && exercise.type === 'image') {
            const rawUrl = `https://raw.githubusercontent.com/${CONFIG.repoInfo.owner}/${CONFIG.repoInfo.repo}/${CONFIG.repoInfo.branch}/${exercise.path}`;
            previewImg.src = rawUrl;
            previewImg.alt = exercise.title;
            previewImg.onerror = function() {
                this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50" y="50" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle" dy=".3em">Image</text></svg>';
            };
        }
        
        // Contenu texte
        const textContent = card.querySelector('.text-content');
        if (textContent && exercise.type === 'txt') {
            loadTextContent(exercise.path, textContent, exercise.category);
        }
        
        // Taille
        const fileSize = card.querySelector('.file-size');
        if (fileSize && exercise.type === 'txt') {
            fileSize.textContent = '~2-5 pages';
        }
        
        // Boutons
        const openBtn = card.querySelector('.open-btn');
        const downloadBtn = card.querySelector('.download-btn');
        
        if (openBtn && downloadBtn) {
            const rawUrl = `https://raw.githubusercontent.com/${CONFIG.repoInfo.owner}/${CONFIG.repoInfo.repo}/${CONFIG.repoInfo.branch}/${exercise.path}`;
            
            openBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openFile(rawUrl, exercise.type, exercise.filename, exercise.title);
            });
            
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                downloadFile(rawUrl, exercise.filename);
            });
        }
        
        return card;
    } catch (error) {
        logger.error('Erreur création carte:', error);
        return createSimpleCard(exercise);
    }
}

function createSimpleCard(exercise) {
    const div = document.createElement('div');
    div.className = 'exercise-card';
    div.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    `;
    
    const rawUrl = `https://raw.githubusercontent.com/${CONFIG.repoInfo.owner}/${CONFIG.repoInfo.repo}/${CONFIG.repoInfo.branch}/${exercise.path}`;
    const color = exercise.type === 'pdf' ? '#e74c3c' : exercise.type === 'image' ? '#2ecc71' : '#3498db';
    const icon = exercise.type === 'pdf' ? 'file-pdf' : exercise.type === 'image' ? 'image' : 'file-alt';
    
    div.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="width: 50px; height: 50px; background: ${color}; 
                     border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; margin-right: 15px;">
                <i class="fas fa-${icon}"></i>
            </div>
            <div style="flex: 1;">
                <h3 style="margin: 0; color: #2c3e50;">${exercise.title}</h3>
                <div style="display: flex; gap: 10px; margin-top: 5px;">
                    <span style="background: ${color}; color: white; padding: 3px 10px; border-radius: 15px; font-size: 12px;">
                        ${exercise.type.toUpperCase()}
                    </span>
                    <span style="background: #9b59b6; color: white; padding: 3px 10px; border-radius: 15px; font-size: 12px;">
                        ${exercise.category}
                    </span>
                </div>
            </div>
        </div>
        <p style="color: #7f8c8d; margin: 15px 0;">${exercise.description}</p>
        <div style="display: flex; gap: 10px;">
            <button class="open-btn" style="flex: 1; padding: 10px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer;">
                <i class="fas fa-external-link-alt"></i> Ouvrir
            </button>
            <button class="download-btn" style="flex: 1; padding: 10px; background: #2ecc71; color: white; border: none; border-radius: 8px; cursor: pointer;">
                <i class="fas fa-download"></i> Télécharger
            </button>
        </div>
    `;
    
    div.querySelector('.open-btn').addEventListener('click', () => openFile(rawUrl, exercise.type, exercise.filename, exercise.title));
    div.querySelector('.download-btn').addEventListener('click', () => downloadFile(rawUrl, exercise.filename));
    
    return div;
}

function performSearch(query = '') {
    const searchTerm = String(query || '').toLowerCase().trim();
    currentSearch = searchTerm;
    
    if (!searchTerm) {
        showWelcomePage();
        return;
    }
    
    displayFilteredResults();
}

function displayFilteredResults() {
    let filtered = allExercises;
    
    logger.log(`Recherche: "${currentSearch}", Filtre: ${currentFilter}`);
    logger.log(`Total exercices: ${allExercises.length}`);
    
    if (currentSearch) {
        filtered = filtered.filter(exercise => {
            const searchText = `${exercise.title} ${exercise.category} ${exercise.description} ${exercise.filename}`.toLowerCase();
            const found = searchText.includes(currentSearch);
            if (found) logger.debug(`Correspondance trouvée: ${exercise.title}`);
            return found;
        });
    }
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(exercise => exercise.type === currentFilter);
    }
    
    displayResults(filtered);
}

function displayResults(exercises) {
    if (!resultsCount || !resultsContainer) return;
    
    resultsCount.textContent = `${exercises.length} exercice${exercises.length !== 1 ? 's' : ''} trouvé${exercises.length !== 1 ? 's' : ''}`;
    
    if (exercises.length === 0) {
        resultsContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-search"></i>
                </div>
                <h3>Aucun résultat</h3>
                <p>Aucun exercice ne correspond à "${currentSearch}"</p>
                <div class="welcome-examples">
                    <span class="example-tag">Pythagore</span>
                    <span class="example-tag">Équations</span>
                    <span class="example-tag">Électricité</span>
                </div>
                <div class="welcome-tips">
                    <p><i class="fas fa-lightbulb"></i> Vérifiez l'orthographe ou essayez d'autres termes</p>
                </div>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = '';
    
    exercises.forEach((exercise, index) => {
        const card = createExerciseCard(exercise);
        if (card) {
            if (card.style) {
                card.style.animationDelay = `${index * 0.05}s`;
            }
            resultsContainer.appendChild(card);
        }
    });
    
    // MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
        setTimeout(() => {
            MathJax.typesetPromise().catch(err => {
                logger.debug('MathJax final:', err);
            });
        }, 200);
    }
}

// ==================== GESTION DES ÉVÉNEMENTS ====================

function closeSidebarFunc() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function openSidebar() {
    sidebar.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function setupEventListeners() {
    // Sidebar
    hamburgerBtn.addEventListener('click', openSidebar);
    closeSidebar.addEventListener('click', closeSidebarFunc);
    overlay.addEventListener('click', closeSidebarFunc);
    
    // Recherche
    const debouncedSearch = debounce((value) => performSearch(value), 300);
    mainSearch.addEventListener('input', (e) => debouncedSearch(e.target.value));
    searchBtn.addEventListener('click', () => performSearch(mainSearch.value));
    mainSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch(mainSearch.value);
    });
    
    // Tags d'exemple
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('example-tag')) {
            const searchText = e.target.textContent;
            mainSearch.value = searchText;
            performSearch(searchText);
        }
    });
    
    // Filtres
    typeFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            typeFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.type;
            logger.log(`Filtre changé: ${currentFilter}`);
            if (currentSearch) displayFilteredResults();
        });
    });
}

// ==================== INITIALISATION ====================

async function init() {
    logger.log('🚀 Initialisation exercice.js...');
    
    // Initialiser les éléments DOM
    hamburgerBtn = document.getElementById('hamburgerBtn');
    closeSidebar = document.getElementById('closeSidebar');
    sidebar = document.getElementById('sidebar');
    overlay = document.getElementById('overlay');
    mainSearch = document.getElementById('mainSearch');
    searchBtn = document.getElementById('searchBtn');
    resultsContainer = document.getElementById('resultsContainer');
    resultsCount = document.getElementById('resultsCount');
    typeFilters = document.querySelectorAll('.type-filter');
    pdfTemplate = document.getElementById('pdfTemplate');
    imageTemplate = document.getElementById('imageTemplate');
    txtTemplate = document.getElementById('txtTemplate');
    
    // Vérifier le DOM
    if (!resultsContainer || !mainSearch) {
        logger.error('Éléments DOM manquants, réessai...');
        setTimeout(init, 100);
        return;
    }
    
    logger.success('✅ DOM chargé');
    
    // Afficher page d'accueil
    showWelcomePage();
    
    try {
        await scanExercisesDirectory();
        logger.success(`${allExercises.length} exercices chargés`);
        showWelcomePage(); // Rafraîchir avec le bon compte
    } catch (error) {
        logger.error('Erreur scan:', error);
        showError('Impossible de charger les exercices');
    }
    
    setupEventListeners();
    logger.success('✅ Exercice.js initialisé avec succès');
}

// Démarrer
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ==================== FONCTIONS GLOBALES ====================

window.refreshExercises = async () => {
    logger.log('🔄 Actualisation des exercices...');
    try {
        await scanExercisesDirectory();
        const message = `Actualisé: ${allExercises.length} exercices détectés`;
        logger.success(message);
        
        if (currentSearch) {
            displayFilteredResults();
        } else {
            showWelcomePage();
        }
        
        // Notification visuelle
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        
    } catch (error) {
        logger.error('Erreur actualisation:', error);
        alert('Erreur lors de l\'actualisation');
    }
};

window.addExerciseFile = function(filename, category = '', title = '') {
    const filePath = `exercices/${filename}`;
    
    // Déterminer le type
    const ext = filename.split('.').pop().toLowerCase();
    let type = 'pdf';
    if (CONFIG.fileTypes.txt.includes(ext)) type = 'txt';
    if (CONFIG.fileTypes.image.includes(ext)) type = 'image';
    
    // Extraire info si non fourni
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const parts = baseName.split('-');
    
    if (!category && parts.length >= 1) category = parts[0];
    if (!title && parts.length >= 2) title = parts.slice(1).join(' ');
    
    const exercise = {
        id: `manual-${Date.now()}`,
        title: title || baseName.replace(/-/g, ' '),
        filename: filename,
        path: filePath,
        type: type,
        category: formatCategory(category || 'divers'),
        description: `Fichier ajouté: ${filename}`
    };
    
    allExercises.push(exercise);
    logger.success(`Fichier ajouté manuellement: ${filename}`);
    
    // Mettre à jour
    if (currentSearch) {
        displayFilteredResults();
    } else {
        showWelcomePage();
    }
    
    return exercise;
};

window.showAllExercises = () => {
    console.log('📋 Liste complète des exercices:', allExercises);
    console.log('🔍 Détails:');
    allExercises.forEach((ex, i) => {
        console.log(`${i+1}. ${ex.title} (${ex.type}) - ${ex.category} - ${ex.filename}`);
    });
    return allExercises;
};

window.testMathJax = () => {
    const testDiv = document.createElement('div');
    testDiv.innerHTML = `
        <h3>Test MathJax</h3>
        <p>Formule simple: \\(E = mc^2\\)</p>
        <p>Formule complexe: \\(\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)</p>
        <p>Intégrale: \\(\\int_a^b f(x)\\,dx\\)</p>
    `;
    document.body.appendChild(testDiv);
    
    if (window.MathJax) {
        MathJax.typesetPromise([testDiv]);
    }
    
    return testDiv;
};