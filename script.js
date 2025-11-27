// MENU (inchangé)
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const closeBtn = document.getElementById("closeBtn");

hamburger.addEventListener("click", () => {
  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
  hamburger.classList.toggle("active");
});
closeBtn.addEventListener("click", () => { sidebar.classList.remove("active"); overlay.classList.remove("active"); hamburger.classList.remove("active"); });
overlay.addEventListener("click", () => { sidebar.classList.remove("active"); overlay.classList.remove("active"); hamburger.classList.remove("active"); });

// VARIABLES
let fileIndex = [];

// CHARGEMENT DES FICHIERS (via proxy stable + cache)
async function loadFiles() {
  const loading = document.getElementById('loading-message');
  loading.innerHTML = 'Chargement des fichiers Premium...';

  try {
    const proxy = 'https://api.allorigins.win/get?url=';
    const url = encodeURIComponent('https://api.github.com/repos/ivanipote/premium_search/contents/premium_files');
    const res = await fetch(proxy + url);
    const data = await res.json();
    const files = JSON.parse(data.contents);

    fileIndex = files.map(f => ({
      name: f.name,
      path: f.download_url,
      type: f.name.split('.').pop().toLowerCase(),
      size: f.size,
      url: f.html_url
    }));

    // AFFICHAGE IMMÉDIAT DE TOUS LES FICHIERS (comme une liste premium)
    displayAllFiles();

    loading.innerHTML = `<span style="color:#28a745; font-weight:bold;">Premium actif • ${fileIndex.length} fichiers disponibles</span>`;

  } catch (err) {
    loading.innerHTML = `<span style="color:#dc3545;">Erreur réseau. Rechargement...</span>`;
    setTimeout(loadFiles, 3000); // retry auto
  }
}

// AFFICHAGE DE TOUS LES FICHIERS DÈS LE DÉPART (ultra rapide + très visible)
function displayAllFiles() {
  const container = document.getElementById('search-results');
  container.innerHTML = `
    <div style="text-align:center; margin:30px 0; font-size:1.4rem; color:#0066FF; font-weight:800;">
      Tous les fichiers Premium disponibles
    </div>
  `;

  fileIndex.forEach(file => {
    const icon = file.type === 'pdf' ? 'PDF' :
                 ['jpg','png','jpeg','gif'].includes(file.type) ? 'Image' :
                 file.type === 'mp3' ? 'Music' :
                 file.type === 'apk' ? 'App' :
                 file.type === 'zip' ? 'Archive' : 'File';

    const card = document.createElement('div');
    card.className = 'result-item';
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:15px;">
        <div style="flex:1; min-width:200px;">
          <h3 style="margin:0; font-size:1.3rem; color:#0066FF;">
            \( {icon} <strong> \){file.name}</strong>
          </h3>
          <small style="color:#666;">
            \( {file.type.toUpperCase()} • \){(file.size/1024).toFixed(1)} KB
          </small>
        </div>
        <div>
          <a href="\( {file.path}" download=" \){file.name}"
             style="background:#0066FF; color:white; padding:12px 24px; border-radius:50px; text-decoration:none; font-weight:bold; font-size:1rem;">
             Télécharger
          </a>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// RECHERCHE (filtre instantané sur la liste déjà affichée)
function performSearch(query) {
  if (!query.trim()) {
    displayAllFiles();
    return;
  }

  const terms = query.toLowerCase().split(' ');
  const matches = fileIndex.filter(file =>
    terms.some(t => file.name.toLowerCase().includes(t))
  );

  const container = document.getElementById('search-results');
  container.innerHTML = matches.length === 0
    ? `<div class="loading">Aucun fichier trouvé pour "${query}"</div>`
    : `<div style="text-align:center; color:#0066FF; margin:20px 0; font-weight:bold;">
         \( {matches.length} résultat(s) pour " \){query}"
       </div>`;

  matches.forEach(file => {
    const icon = file.type === 'pdf' ? 'PDF' : file.type === 'mp3' ? 'Music' : 'File';
    const card = document.createElement('div');
    card.className = 'result-item';
    card.innerHTML = `
      <h3>\( {icon} <strong> \){file.name}</strong></h3>
      <p style="color:#666; margin:5px 0;">
        \( {file.type.toUpperCase()} • \){(file.size/1024).toFixed(1)} KB
      </p>
      <a href="${file.path}" download style="background:#0066FF; color:white; padding:10px 20px; border-radius:50px; text-decoration:none; font-weight:bold;">
        Télécharger Premium
      </a>
    `;
    container.appendChild(card);
  });
}

// ÉVÉNEMENTS RECHERCHE
document.getElementById('search-input').addEventListener('input', e => {
  performSearch(e.target.value);
});
document.getElementById('search-button').addEventListener('click', () => {
  performSearch(document.getElementById('search-input').value);
});

// LANCEMENT
document.addEventListener('DOMContentLoaded', loadFiles);
