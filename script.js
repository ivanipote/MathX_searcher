// Configuration
const CONFIG = {
    mathFile: 'math/math.txt',
    pcFile: 'pc/pc.txt'
};

// Éléments DOM
const hamburgerBtn = document.getElementById('hamburgerBtn');
const closeSidebar = document.getElementById('closeSidebar');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const mainSearch = document.getElementById('mainSearch');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('resultsContainer');
const resultsCount = document.getElementById('resultsCount');
const formulaTemplate = document.getElementById('formulaTemplate');
const navItems = document.querySelectorAll('.nav-item');
const filterBtns = document.querySelectorAll('.filter-btn');

// État
let allFormulas = [];
let currentFilter = 'all';

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    // Afficher la page d'accueil immédiatement
    showWelcomePage();
    
    try {
        const [mathData, pcData] = await Promise.all([
            loadFile(CONFIG.mathFile, 'mathématique'),
            loadFile(CONFIG.pcFile, 'physique-chimie')
        ]);
        
        allFormulas = [...mathData, ...pcData];
        console.log(`${allFormulas.length} formules chargées en arrière-plan`);
    } catch (error) {
        console.error('Erreur de chargement:', error);
        // On n'affiche pas d'erreur sur la page d'accueil
    }
    
    setupEventListeners();
});

// Charger un fichier
async function loadFile(filePath, type) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const text = await response.text();
        return parseFormulas(text, type);
    } catch (error) {
        console.warn(`⚠️ Impossible de charger ${filePath}:`, error.message);
        return [];
    }
}

// Parser les formules
function parseFormulas(text, type) {
    const formulas = [];
    const blocks = text.trim().split('---').filter(block => block.trim());
    
    blocks.forEach((block, index) => {
        const formula = {
            id: `${type}-${index}`,
            type: type,
            title: '',
            formula: '',
            description: '',
            category: ''
        };
        
        block.split('\n').forEach(line => {
            line = line.trim();
            if (line.startsWith('TITRE:')) {
                formula.title = line.substring(6).trim();
            } else if (line.startsWith('FORMULE:')) {
                formula.formula = line.substring(8).trim();
            } else if (line.startsWith('DESCRIPTION:')) {
                formula.description = line.substring(12).trim();
            } else if (line.startsWith('CATEGORIE:')) {
                formula.category = line.substring(10).trim();
            }
        });
        
        if (formula.title && formula.formula) {
            formulas.push(formula);
        }
    });
    
    return formulas;
}

// Configurer les événements
function setupEventListeners() {
    // Sidebar
    hamburgerBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    closeSidebar.addEventListener('click', closeSidebarFunc);
    overlay.addEventListener('click', closeSidebarFunc);
    
    // Recherche avec anti-rebond
    const debouncedSearch = debounce((value) => performSearch(value), 300);
    
    mainSearch.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });
    
    searchBtn.addEventListener('click', () => {
        performSearch(mainSearch.value);
    });
    
    mainSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch(mainSearch.value);
        }
    });
    
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Filtres
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = getFilterType(btn.textContent);
            
            // Si une recherche est en cours, on relance la recherche avec le filtre
            if (mainSearch.value.trim()) {
                performSearch(mainSearch.value);
            }
        });
    });
}

// Fermer la sidebar
function closeSidebarFunc() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Anti-rebond
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

// Effectuer la recherche
function performSearch(query = '') {
    // CONVERSION SÉCURISÉE EN STRING
    const searchTerm = String(query || '').toLowerCase().trim();
    
    // Si la recherche est vide, on affiche la page d'accueil
    if (!searchTerm) {
        showWelcomePage();
        return;
    }
    
    let filtered = allFormulas;
    
    // Appliquer le filtre
    if (currentFilter !== 'all') {
        filtered = filtered.filter(formula => {
            const cat = (formula.category || '').toLowerCase();
            if (currentFilter === 'géométrie') return cat.includes('géométrie');
            if (currentFilter === 'analyse') return cat.includes('analyse');
            if (currentFilter === 'physique') return formula.type === 'physique-chimie';
            if (currentFilter === 'chimie') return cat.includes('chimie');
            return true;
        });
    }
    
    // Filtrer par recherche
    filtered = filtered.filter(formula => {
        const searchText = `${formula.title || ''} ${formula.category || ''} ${formula.description || ''}`.toLowerCase();
        return searchText.includes(searchTerm);
    });
    
    displayResults(filtered, searchTerm);
}

// Afficher la page d'accueil (aucun résultat)
function showWelcomePage() {
    resultsCount.textContent = '0 résultat';
    
    resultsContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <i class="fas fa-square-root-alt"></i>
            </div>
            <h3>Bienvenue sur MathLab</h3>
            <p>Recherchez des formules de mathématiques et physique</p>
            <div class="welcome-examples">
                <span class="example-tag">Pythagore</span>
                <span class="example-tag">Énergie cinétique</span>
                <span class="example-tag">Dérivée</span>
                <span class="example-tag">Loi d'Ohm</span>
                <span class="example-tag">Théorème</span>
                <span class="example-tag">Intégrale</span>
            </div>
            <div class="welcome-tips">
                <p><i class="fas fa-lightbulb"></i> Utilisez les filtres pour affiner votre recherche</p>
            </div>
        </div>
    `;
    
    // Re-lier les événements aux tags d'exemple
    document.querySelectorAll('.example-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            const searchText = e.target.textContent;
            mainSearch.value = searchText;
            performSearch(searchText);
        });
    });
}

// Afficher les résultats SEULEMENT après recherche
function displayResults(formulas, searchTerm = '') {
    resultsCount.textContent = `${formulas.length} résultat${formulas.length !== 1 ? 's' : ''}`;
    
    if (formulas.length === 0) {
        resultsContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-search"></i>
                </div>
                <h3>Aucun résultat</h3>
                <p>Aucune formule ne correspond à "${searchTerm}"</p>
                <div class="welcome-examples">
                    <span class="example-tag">Pythagore</span>
                    <span class="example-tag">Énergie</span>
                    <span class="example-tag">Dérivée</span>
                    <span class="example-tag">Loi d'Ohm</span>
                </div>
            </div>
        `;
        
        // Re-lier les événements
        document.querySelectorAll('.example-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                const searchText = e.target.textContent;
                mainSearch.value = searchText;
                performSearch(searchText);
            });
        });
        
        return;
    }
    
    // Afficher les résultats
    resultsContainer.innerHTML = '';
    
    formulas.forEach(formula => {
        const card = createFormulaCard(formula, searchTerm);
        resultsContainer.appendChild(card);
    });
    
    // MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetPromise();
    }
}

// Créer une carte de formule (SANS BOUTON DÉTAILS)
function createFormulaCard(formula, searchTerm) {
    const clone = formulaTemplate.content.cloneNode(true);
    
    // Titre
    const title = clone.querySelector('.formula-title');
    title.innerHTML = highlightText(formula.title, searchTerm);
    
    // Catégorie
    const category = clone.querySelector('.formula-category');
    category.textContent = formula.category || 'Général';
    
    // Formule
    const formulaDisplay = clone.querySelector('.formula-display');
    const formulaText = formula.formula.includes('$') || formula.formula.includes('\\(') 
        ? formula.formula 
        : `\\(${formula.formula}\\)`;
    formulaDisplay.innerHTML = formulaText;
    
    // Description
    const description = clone.querySelector('.formula-description');
    description.innerHTML = highlightText(formula.description, searchTerm) || 'Aucune description';
    
    // Source
    const source = clone.querySelector('.source-type');
    source.textContent = formula.type.charAt(0).toUpperCase() + formula.type.slice(1);
    
    // Bouton favori
    const favoriteBtn = clone.querySelector('.favorite-btn');
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const icon = favoriteBtn.querySelector('i');
        if (icon.classList.contains('far')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            icon.style.color = '#ffd700'; // Or pour favori
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            icon.style.color = ''; // Retour à la couleur par défaut
        }
    });
    
    return clone;
}

// Surligner le texte recherché
function highlightText(text, searchTerm) {
    if (!searchTerm || !text || typeof text !== 'string') return text || '';
    
    try {
        const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
        return text.replace(regex, '<mark class="highlight">$1</mark>');
    } catch (e) {
        return text;
    }
}

// Échapper pour Regex
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Obtenir le type de filtre
function getFilterType(text) {
    // Nettoyer le texte (enlever les icônes et HTML)
    const cleanText = text.trim()
        .replace(/<i.*?>.*?<\/i>/g, '')
        .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
        .trim();
    
    const map = {
        'Toutes': 'all',
        'Tous': 'all',
        'Géométrie': 'géométrie',
        'Analyse': 'analyse',
        'Physique': 'physique',
        'Chimie': 'chimie'
    };
    
    return map[cleanText] || 'all';
}

// Changer d'onglet
function switchTab(tab) {
    console.log(`Onglet activé: ${tab}`);
    
    // Ici vous pourriez ajouter la logique pour changer de page
    switch(tab) {
        case 'recherche':
            // Déjà sur la page recherche
            break;
        case 'exercice':
            alert('Page Exercice - À implémenter');
            break;
        case 'profil':
            alert('Page Profil - À implémenter');
            break;
    }
}

// Fonction pour effacer la recherche
function clearSearch() {
    mainSearch.value = '';
    showWelcomePage();
    mainSearch.focus();
}

// Exposer certaines fonctions globalement (pour débogage)
window.clearSearch = clearSearch;
window.showWelcomePage = showWelcomePage;
window.performSearch = performSearch;