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

// CHARGEMENT DES PDF SANS MESSAGES D'ERREUR
async function loadPDFList() {
  try {
    updateStatus('Chargement des PDF...', 'loading');
    const resp = await fetch(`https://api.github.com/repos/ivanipote/PDF-search/contents/${RECH_FOLDER}`);
    
    if (!resp.ok) {
      allPDFs = [];
      updateStatus('0 fichier chargé', 'loading');
      showAllPDFs();
      return;
    }
    
    const files = await resp.json();
    allPDFs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    
    if (allPDFs.length > 0) {
      updateStatus(`${allPDFs.length} fichier${allPDFs.length > 1 ? 's' : ''} chargé${allPDFs.length > 1 ? 's' : ''} - Prêt pour la recherche`, 'success');
    } else {
      updateStatus('0 fichier chargé', 'loading');
    }
    
    showAllPDFs();
    
  } catch (e) {
    allPDFs = [];
    updateStatus('0 fichier chargé', 'loading');
    showAllPDFs();
  }
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
  }
  return fullText;
}

// RECHERCHE AVEC DÉLAI (DEBOUNCE) - CORRIGÉ
function setupSearchDebounce() {
  document.getElementById("searchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    
    const query = e.target.value.trim();
    
    // Si pas de PDF, on affiche directement "Aucun résultat"
    if (allPDFs.length === 0) {
      showNoResults();
      return;
    }
    
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

// AFFICHER "AUCUN RÉSULTAT" QUAND PAS DE PDF
function showNoResults() {
  const grid = document.getElementById("results");
  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: #666;">
      <h2 style="color: #0066FF;">Aucun PDF disponible</h2>
      <p>Ajoutez des PDF dans le dossier searchfiles pour commencer la recherche</p>
    </div>
  `;
  document.getElementById("resultCount").textContent = "0 résultat";
  document.getElementById("pagination").style.display = 'none';
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
  "physique": ["mécanique", "optique", "thermodynamique"]
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

// FONCTION DE RECHERCHE PRINCIPALE - CORRIGÉE
async function search(query) {
  // Si pas de PDF chargés, on affiche aucun résultat
  if (allPDFs.length === 0) {
    showNoResults();
    return;
  }
  
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
  
  document.getElementById("resultCount").textContent = 
    `${results.length} résultat${results.length > 1 ? 's' : ''} intelligent${results.length > 1 ? 's' : ''}`;
}

// AFFICHAGE DES RÉSULTATS
function displayResults(results) {
  const grid = document.getElementById("results");
  grid.innerHTML = "";

  if (results.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: #666;">
        <h2 style="color: #0066FF;">Aucun résultat trouvé</h2>
        <p>Essayez avec d'autres mots-clés ou vérifiez l'orthographe</p>
      </div>
    `;
    return;
  }

  results.forEach(item => {
    const rawUrl = `https://raw.githubusercontent.com/ivanipote/PDF-search/main/${RECH_FOLDER}/${item.pdf.name}`;
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="score-badge">Score ${item.score}</div>
      <div class="file-title">📄 ${item.pdf.name}</div>
      <div class="snippet">${highlightText(item.snippet, item.terms)}</div>
      <a href="${rawUrl}" download class="download-btn">Télécharger le PDF</a>
    `;
    grid.appendChild(card);
  });
}

// AFFICHAGE DE TOUS LES PDF - CORRIGÉ
function showAllPDFs() {
  if (allPDFs.length === 0) {
    showNoResults();
    return;
  }
  
  currentResults = allPDFs;
  displayPaginatedResults(allPDFs);
  document.getElementById("resultCount").textContent = `${allPDFs.length} PDF disponible${allPDFs.length > 1 ? 's' : ''}`;
}

// INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();
  setupSearchDebounce();
  loadPDFList();
});
