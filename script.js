// === MENU HAMBURGER (inchangé) ===
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const closeBtn = document.getElementById("closeBtn");

hamburger.addEventListener("click", () => {
  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
  hamburger.classList.toggle("active");
});
closeBtn.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);
function closeSidebar() {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
  hamburger.classList.remove("active");
}

// === CHARGEMENT DES FICHIERS PREMIUM (VERSION QUI MARCHE À 100%) ===
let fileIndex = [];

async function loadFilesFromGitHub() {
  const loadingMessage = document.getElementById('loading-message');
  loadingMessage.innerHTML = 'Chargement des fichiers Premium...';

  try {
    // PROXY CORS QUI MARCHE TOUJOURS
    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const targetUrl = encodeURIComponent('https://api.github.com/repos/ivanipote/premium_search/contents/premium_files');
    
    const response = await fetch(proxyUrl + targetUrl);
    const data = await response.json();
    const files = JSON.parse(data.contents);

    fileIndex = files.map(file => ({
      name: file.name,
      path: file.download_url,           // lien direct de téléchargement
      type: file.name.split('.').pop().toLowerCase(),
      size: file.size,
      githubUrl: file.html_url
    }));

    loadingMessage.innerHTML = `<span style="color:#28a745">Premium prêt ! ${fileIndex.length} fichiers disponibles</span>`;
    console.log("Fichiers chargés :", fileIndex);

  } catch (err) {
    console.error(err);
    loadingMessage.innerHTML = `<span style="color:#dc3545">Erreur de connexion<br>Recharge la page ou réessaie dans 10s</span>`;
  }
}

// === RECHERCHE ===
function performSearch(query) {
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = '';

  if (!query || query.trim() === '') {
    resultsContainer.innerHTML = '<div class="loading">Tape quelque chose pour chercher</div>';
    return;
  }

  const terms = query.toLowerCase().split(' ');
  const matches = fileIndex.filter(file => 
    terms.some(t => file.name.toLowerCase().includes(t))
  );

  if (matches.length === 0) {
    resultsContainer.innerHTML = `<div class="loading">Aucun fichier trouvé pour "${query}"</div>`;
    return;
  }

  resultsContainer.innerHTML += `<div style="text-align:center; color:#0066FF; margin:20px 0; font-weight:bold;">
    ${matches.length} résultat(s) trouvé(s)
  </div>`;

  matches.forEach(file => {
    const icon = file.type === 'pdf' ? 'PDF' : 
                 file.type === 'mp3' ? 'Music' : 
                 file.type.includes('zip') || file.type === 'apk' ? 'Package' : 'File';

    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <h3>\( {icon} \){file.name}</h3>
      <p style="color:#666; font-size:0.9rem;">
        \( {file.type.toUpperCase()} • \){(file.size/1024).toFixed(1)} KB
      </p>
      <div style="margin-top:15px;">
        <a href="${file.path}" download class="btn-download">
          Télécharger Premium
        </a>
        <a href="${file.githubUrl}" target="_blank" style="margin-left:10px; color:#666; font-size:0.9rem;">
          Voir sur GitHub
        </a>
      </div>
    `;
    resultsContainer.appendChild(item);
  });
}

// === ÉVÉNEMENTS ===
document.getElementById('search-button').addEventListener('click', () => {
  performSearch(document.getElementById('search-input').value);
});

document.getElementById('search-input').addEventListener('keypress', e => {
  if (e.key === 'Enter') performSearch(e.target.value);
});

let timeout;
document.getElementById('search-input').addEventListener('input', e => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    performSearch(e.target.value);
  }, 400);
});

// === LANCEMENT ===
document.addEventListener('DOMContentLoaded', loadFilesFromGitHub);
