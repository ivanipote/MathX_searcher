// CONFIGURATION PDF.js
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.js';
}

// VARIABLES GLOBALES
const RECH_FOLDER = "searchfiles";
let allPDFs = [];
let pdfCache = new Map();
let searchTimeout;
let currentPage = 1;
const resultsPerPage = 12;
let currentResults = [];
let usingTestPDFs = false;

// GESTION DU SIDEBAR
function setupSidebar() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const closeSidebar = document.getElementById('closeSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const body = document.body;

  function openSidebar() {
    body.classList.add('sidebar-open');
  }

  function closeSidebarFunc() {
    body.classList.remove('sidebar-open');
  }

  hamburgerBtn.addEventListener('click', openSidebar);
  closeSidebar.addEventListener('click', closeSidebarFunc);
  sidebarOverlay.addEventListener('click', closeSidebarFunc);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSidebarFunc();
    }
  });
}

// MISE À JOUR DU STATUT
function updateStatus(message, type = 'loading') {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.className = '';
  statusElement.classList.add(`status-${type}`);
}

// CHARGEMENT DES PDF RÉELS
async function loadPDFList() {
  try {
    updateStatus('Chargement des PDF...', 'loading');
    const resp = await fetch(`https://api.github.com/repos/ivanipote/PDF-search/contents/${RECH_FOLDER}`);
    
    if (!resp.ok) {
      // SI LE DOSSIER N'EXISTE PAS, ON CRÉE DES PDF DE TEST
      allPDFs = [];
      usingTestPDFs = true;
      createTestPDFs();
      showAllPDFs();
      return;
    }
    
    const files = await resp.json();
    allPDFs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    
    if (allPDFs.length > 0) {
      usingTestPDFs = false;
      updateStatus(`${allPDFs.length} fichier${allPDFs.length > 1 ? 's' : ''} chargé${allPDFs.length > 1 ? 's' : ''}`, 'success');
    } else {
      // SI LE DOSSIER EST VIDE, ON CRÉE DES PDF DE TEST
      usingTestPDFs = true;
      createTestPDFs();
    }
    
    showAllPDFs();
    
  } catch (e) {
    // EN CAS D'ERREUR, ON CRÉE DES PDF DE TEST
    allPDFs = [];
    usingTestPDFs = true;
    createTestPDFs();
    showAllPDFs();
  }
}

// CRÉER DES PDF FICTIFS POUR LES TESTS
function createTestPDFs() {
  allPDFs = [
    { name: "cours-mathematiques-avancees.pdf" },
    { name: "schema-electronique-circuit.pdf" },
    { name: "cours-physique-quantique.pdf" },
    { name: "guide-programmation-python.pdf" },
    { name: "cours-chimie-organique.pdf" },
    { name: "sys.pdf" }
  ];
  updateStatus(`${allPDFs.length} fichiers de démonstration chargés`, 'success');
}

// CACHE DES PDF ANALYSÉS
async function getPDFText(pdfName) {
  if (pdfCache.has(pdfName)) {
    return pdfCache.get(pdfName);
  }
  
  let fullText = "";
  try {
    if (typeof pdfjsLib === 'undefined') {
      return "";
    }
    
    // POUR LES PDF FICTIFS, RETOURNE UN TEXTE SIMULÉ
    if (usingTestPDFs) {
      const simulatedText = simulatePDFContent(pdfName);
      pdfCache.set(pdfName, simulatedText);
      return simulatedText;
    }
    
    // POUR LES VRAIS PDF, CHARGE LE CONTENU RÉEL
    const loadingTask = pdfjsLib.getDocument(`https://raw.githubusercontent.com/ivanipote/PDF-search/main/${RECH_FOLDER}/${pdfName}`);
    const doc = await loadingTask.promise;
    
    for (let p = 1; p <= Math.min(doc.numPages, 10); p++) {
      const page = await doc.getPage(p);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(i => i.str).join(" ");
      fullText += pageText + " ";
    }
    pdfCache.set(pdfName, fullText);
  } catch (e) {
    console.error("Erreur analyse PDF:", pdfName, e);
    // EN CAS D'ERREUR, RETOURNE UN TEXTE SIMULÉ
    const simulatedText = simulatePDFContent(pdfName);
    pdfCache.set(pdfName, simulatedText);
    return simulatedText;
  }
  return fullText;
}

// SIMULER LE CONTENU DES PDF POUR LES TESTS
function simulatePDFContent(pdfName) {
  const contentMap = {
    "cours-mathematiques-avancees.pdf": "Ce cours de mathématiques avancées couvre les concepts fondamentaux de l'algèbre linéaire, du calcul différentiel et intégral, ainsi que des probabilités et statistiques. Les étudiants apprendront les matrices, les vecteurs, les fonctions complexes et les équations différentielles.",
    "schema-electronique-circuit.pdf": "Document technique présentant des schémas électroniques détaillés pour circuits imprimés. Ce guide inclut des diagrammes de circuits analogiques et numériques, avec des explications sur les composants électroniques et leur fonctionnement.",
    "cours-physique-quantique.pdf": "Introduction à la physique quantique et mécanique quantique. Ce cours explore les principes fondamentaux comme la dualité onde-particule, le principe d'incertitude de Heisenberg et les équations de Schrödinger.",
    "guide-programmation-python.pdf": "Guide complet pour apprendre la programmation Python. Ce document couvre les bases du langage, les structures de données, les fonctions, les classes et modules, ainsi que des projets pratiques.",
    "cours-chimie-organique.pdf": "Cours approfondi sur la chimie organique, incluant l'étude des hydrocarbures, des groupes fonctionnels, des réactions organiques et des mécanismes réactionnels.",
    "sys.pdf": "Document sur les systèmes informatiques et l'administration système. Ce guide couvre la gestion des systèmes d'exploitation, les réseaux informatiques et la sécurité des systèmes."
  };
  
  return contentMap[pdfName] || `Ce document ${pdfName} contient des informations importantes sur son sujet. Le contenu couvre les aspects fondamentaux et avancés du domaine concerné.`;
}

// RECHERCHE AVEC DÉLAI (DEBOUNCE)
function setupSearchDebounce() {
  document.getElementById("searchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    
    const query = e.target.value.trim();
    
    // Si recherche trop courte, on affiche tous les PDF
    if (query.length < 2) {
      showAllPDFs();
      return;
    }
    
    // Sinon, on lance la recherche avec délai
    showLoading();
    
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      search(query);
    }, 300);
  });
}

// INDICATEUR DE CHARGEMENT
function showLoading() {
  document.getElementById("results").innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Recherche en cours...</p>
    </div>
  `;
  document.getElementById("pagination").style.display = 'none';
  // CACHER LE COMPTEUR PENDANT LA RECHERCHE
  document.getElementById("resultCount").style.display = 'none';
}

// PAGINATION
function displayPaginatedResults(results) {
  const start = (currentPage - 1) * resultsPerPage;
  const end = start + resultsPerPage;
  const paginatedResults = results.slice(start, end);
  
  displayResults(paginatedResults);
  setupPagination(results.length);
}

function setupPagination(totalResults) {
  const totalPages = Math.ceil(totalResults / resultsPerPage);
  const paginationDiv = document.getElementById("pagination");
  
  if (totalPages <= 1) {
    paginationDiv.style.display = 'none';
    return;
  }
  
  paginationDiv.style.display = 'flex';
  paginationDiv.innerHTML = '';
  
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
    btn.textContent = i;
    btn.onclick = () => {
      currentPage = i;
      displayPaginatedResults(currentResults);
    };
    paginationDiv.appendChild(btn);
  }
}

// RECHERCHE SÉMANTIQUE
const synonymes = {
  "maths": ["mathématiques", "calcul", "algèbre"],
  "electronique": ["circuit", "composant", "schéma"],
  "physique": ["mécanique", "optique", "thermodynamique"],
  "python": ["programmation", "codage", "développement"],
  "sys": ["système", "informatique", "administration"]
};

function expandQuery(query) {
  const terms = query.toLowerCase().split(/\s+/);
  const expanded = [...terms];
  terms.forEach(term => {
    if (synonymes[term]) {
      expanded.push(...synonymes[term]);
    }
  });
  return [...new Set(expanded)];
}

// SURlIGNAGE DU TEXTE
function highlightText(text, terms) {
  let highlighted = text;
  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlighted = highlighted.replace(regex, '<span class="highlight">$1</span>');
  });
  return highlighted;
}

// CALCUL DU SCORE DE PERTINENCE
function calculateScore(pdfName, pdfText, terms) {
  let score = 0;
  const lowerName = pdfName.toLowerCase();
  const lowerText = pdfText.toLowerCase();
  
  terms.forEach(term => {
    if (lowerName.includes(term)) score += 3;
    const matches = (lowerText.match(new RegExp(term, 'gi')) || []).length;
    score += matches;
  });
  
  return score;
}

// FONCTION DE RECHERCHE PRINCIPALE
async function search(query) {
  const baseTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  const expandedTerms = expandQuery(query);
  
  let results = [];

  for (const pdf of allPDFs) {
    let snippet = "";
    let fullText = "";

    const nameMatchCount = baseTerms.filter(t => pdf.name.toLowerCase().includes(t)).length;

    try {
      fullText = await getPDFText(pdf.name);
      if (!snippet && fullText) {
        for (const term of baseTerms) {
          const index = fullText.toLowerCase().indexOf(term);
          if (index !== -1) {
            snippet = fullText.substring(Math.max(0, index - 50), index + 150) + "...";
            break;
          }
        }
      }
    } catch (e) {}

    const score = calculateScore(pdf.name, fullText, expandedTerms);
    if (score > 0 || nameMatchCount > 0) {
      results.push({
        pdf,
        score,
        snippet: snippet || "Correspondance dans le nom du fichier",
        terms: baseTerms
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  currentResults = results;
  displayPaginatedResults(results);
  
  // SUPPRIMER LE COMPTEUR DE RÉSULTATS
  document.getElementById("resultCount").style.display = 'none';
}

// AFFICHAGE DES RÉSULTATS
function displayResults(results) {
  const grid = document.getElementById("results");
  grid.innerHTML = "";

  if (results.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: #666;">
        <h2 style="color: #0066FF;">Aucun résultat trouvé</h2>
        <p>Essayez avec d'autres mots-clés</p>
      </div>
    `;
    return;
  }

  results.forEach(item => {
    // POUR LES VRAIS PDF, LIEN DE TÉLÉCHARGEMENT RÉEL
    const rawUrl = usingTestPDFs 
      ? "#" 
      : `https://raw.githubusercontent.com/ivanipote/PDF-search/main/${RECH_FOLDER}/${item.pdf.name}`;
    
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="score-badge">Score ${item.score}</div>
      <div class="file-title">📄 ${item.pdf.name}</div>
      <div class="snippet">${highlightText(item.snippet, item.terms)}</div>
      ${usingTestPDFs 
        ? '<button class="download-btn" style="background: #666; cursor: not-allowed;">PDF de démonstration</button>' 
        : `<a href="${rawUrl}" download class="download-btn">Télécharger le PDF</a>`
      }
    `;
    grid.appendChild(card);
  });
}

// AFFICHAGE DE TOUS LES PDF
function showAllPDFs() {
  currentResults = allPDFs;
  displayPaginatedResults(allPDFs);
  // CACHER LE COMPTEUR
  document.getElementById("resultCount").style.display = 'none';
}

// INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();
  setupSearchDebounce();
  loadPDFList();
});