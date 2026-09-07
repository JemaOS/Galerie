/*
 * Copyright (C) 2025 Jema Technology
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// ============ INTERNATIONALIZATION ============

const I18N_LANGUAGES = {
  en: { code: "en", name: "English" },
  fr: { code: "fr", name: "Français" },
};

const I18N_TRANSLATIONS = {
  en: {
    // App
    appDescription: "A JemaOS gallery for viewing images, videos, and audio files",
    loadingGallery: "Loading gallery...",
    dropFilesHere: "Drop files here to add them to the gallery",
    language: "Language",

    // Common toolbar / actions
    info: "Info",
    print: "Print",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    rotate: "Rotate",
    save: "Save",
    saveAs: "Save as",
    editAnnotate: "Edit / Annotate",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    done: "Done",
    editMode: "Edit Mode",
    adjust: "Adjust",
    pen: "Pen",
    marker: "Highlighter",
    eraser: "Eraser",
    text: "Text",
    undo: "Undo",
    redo: "Redo",
    open: "Open",
    copy: "Copy",
    download: "Download",
    rename: "Rename",
    delete: "Delete",
    close: "Close",

    // PDF viewer
    toggleSidebar: "Show/Hide sidebar",
    fileInfo: "File info",
    layout: "Layout",
    prevPage: "Previous page",
    nextPage: "Next page",
    fitWidth: "Fit to width",
    fitPage: "Fit to page",
    editTextOcr: "Edit text (OCR)",
    textEditModeIndicator: "Text Edit Mode - Click on text to edit it",
    cannotAnnotate: "Cannot annotate: no document loaded",
    textEditorLoadError: "Error loading text editor",
    pdfLoadError: "Error loading PDF file",
    previewUpdateError: "Error updating preview",
    pdfSaved: "PDF saved",
    savingPdf: "Saving PDF...",
    preparingFile: "Preparing file...",

    // Audio player
    nowPlaying: "Now Playing",
    trackTitle: "Track title",
    trackArtist: "Artist name",
    previous: "Previous",
    playPause: "Play/Pause",
    next: "Next",
    shuffle: "Shuffle",
    repeat: "Repeat",
    unknownArtist: "Unknown artist",

    // File info modal
    fileInformation: "File Information",
    nameLabel: "Name:",
    typeLabel: "Type:",
    sizeLabel: "Size:",
    dateLabel: "Date:",
    dimensionsLabel: "Dimensions:",

    // App lifecycle / settings
    initFailed: "Failed to initialize the gallery. Please refresh the page.",
    installedSuccessfully: "Gallery installed successfully!",
    sharedFiles: "Shared files: {count}",
    newVersionAvailable: "New version available!",
    update: "Update",
    clearDataConfirm: "This will clear all gallery data. Are you sure?",
    allDataCleared: "All data has been cleared",
    settingsExported: "Settings exported",
    invalidSettingsFile: "Invalid settings file",
    settingsImported: "Settings imported",
    settingsImportFailed: "Failed to import settings",
    unexpectedError: "An unexpected error occurred",
    fileLoadError: "Error loading file: {filename}",
    settingsComingSoon: "Settings panel coming soon!",
    renameComingSoon: "Rename feature coming soon!",

    // Relative dates
    today: "Today",
    yesterday: "Yesterday",
    daysAgo: "{count} days ago",
    weekAgo: "1 week ago",
    weeksAgo: "{count} weeks ago",

    // Sharing
    galleryFiles: "Gallery files",
    sharedFromGallery: "Shared from Galerie",
    shareFailed: "Failed to share files",
    fileShared: "Shared {count} file",
    filesShared: "Shared {count} files",

    // File loading
    unsupportedFile: "{filename}: Unsupported or invalid file",
    fileReadFailed: "{filename}: Failed to read file",
    someFilesFailed: "Some files could not be loaded: {errors}",
    folderLoadError: "Error loading folder",
    filesLoadError: "Error loading files",
    fileLoadFailed: "Failed to load file",
    noCompatibleFiles: "No compatible files found in this folder",
    folderAccessError: "Folder access error",

    // File operations
    deleteFileConfirm: "Delete {count} file?",
    deleteFilesConfirm: "Delete {count} files?",
    fileDeleted: "{count} file deleted",
    filesDeleted: "{count} files deleted",
    fileCopied: "{count} file copied to clipboard",
    filesCopied: "{count} files copied to clipboard",
    fileDownloaded: "{count} file downloaded",
    filesDownloaded: "{count} files downloaded",
    filePasted: "{count} file pasted",
    filesPasted: "{count} files pasted",
    fileSavedToast: "File saved",

    // Component loading
    audioPlayerLoadError: "Error loading audio player",
    pdfViewerLoadError: "Error loading PDF viewer",
    editToolsLoadError: "Error loading editing tools",
    editImagesOnly: "Editing is only available for images",

    // Saving
    changesSaved: "Changes saved",
    saveError: "Error saving",

    // Error display
    error: "Error",

    // Image adjustments
    adjustLight: "Light",
    adjustColor: "Color",
    brightness: "Brightness",
    exposure: "Exposure",
    contrast: "Contrast",
    highlights: "Highlights",
    shadows: "Shadows",
    vignette: "Vignette",
    saturation: "Saturation",
    warmth: "Warmth",
    tint: "Tint",
    sharpness: "Sharpness",

    // Annotation tools
    groupSize: "SIZE",
    font: "Font",
    styles: "Styles",
    textColor: "Text color",
    groupColor: "COLOR",
    applyAutomatically: "Apply automatically",
    brushSize: "Brush size",

    // Text editor
    textEditorHint: "Click on text to edit it. Changes will be saved when the document is saved.",

    // Video player
    volume: "Volume",
    rewind10: "Back 10s",
    play: "Play",
    forward10: "Forward 10s",
    playbackCancelled: "Playback cancelled",
    networkError: "Network error",
    decodingError: "Decoding error",
    unsupportedFormat: "Unsupported format",
    unknownError: "Unknown error",
    playbackError: "Playback error",
  },

  fr: {
    // App
    appDescription: "Une galerie de JemaOS pour visualiser des images, des vidéos et des fichiers audio",
    loadingGallery: "Chargement de la galerie...",
    dropFilesHere: "Déposez des fichiers ici pour les ajouter à la galerie",
    language: "Langue",

    // Common toolbar / actions
    info: "Infos",
    print: "Imprimer",
    zoomIn: "Zoom avant",
    zoomOut: "Zoom arrière",
    rotate: "Pivoter",
    save: "Enregistrer",
    saveAs: "Enregistrer sous",
    editAnnotate: "Modifier / Annoter",
    fullscreen: "Plein écran",
    exitFullscreen: "Quitter plein écran",
    done: "Terminer",
    editMode: "Mode Édition",
    adjust: "Ajuster",
    pen: "Stylo",
    marker: "Surligneur",
    eraser: "Gomme",
    text: "Texte",
    undo: "Annuler",
    redo: "Rétablir",
    open: "Ouvrir",
    copy: "Copier",
    download: "Télécharger",
    rename: "Renommer",
    delete: "Supprimer",
    close: "Fermer",

    // PDF viewer
    toggleSidebar: "Afficher/Masquer la barre latérale",
    fileInfo: "Infos du fichier",
    layout: "Mise en page",
    prevPage: "Page précédente",
    nextPage: "Page suivante",
    fitWidth: "Adapter à la largeur",
    fitPage: "Adapter à la page",
    editTextOcr: "Éditer le texte (OCR)",
    textEditModeIndicator: "Mode Édition de Texte - Cliquez sur le texte pour le modifier",
    cannotAnnotate: "Impossible d'annoter : aucun document chargé",
    textEditorLoadError: "Erreur de chargement de l'éditeur de texte",
    pdfLoadError: "Erreur lors du chargement du fichier PDF",
    previewUpdateError: "Erreur lors de la mise à jour de l'aperçu",
    pdfSaved: "PDF enregistré",
    savingPdf: "Enregistrement du PDF...",
    preparingFile: "Préparation du fichier...",

    // Audio player
    nowPlaying: "Lecture en cours",
    trackTitle: "Titre de la piste",
    trackArtist: "Nom de l'artiste",
    previous: "Précédent",
    playPause: "Lecture/Pause",
    next: "Suivant",
    shuffle: "Aléatoire",
    repeat: "Répéter",
    unknownArtist: "Artiste inconnu",

    // File info modal
    fileInformation: "Informations du fichier",
    nameLabel: "Nom :",
    typeLabel: "Type :",
    sizeLabel: "Taille :",
    dateLabel: "Date :",
    dimensionsLabel: "Dimensions :",

    // App lifecycle / settings
    initFailed: "Échec de l'initialisation de la galerie. Veuillez rafraîchir la page.",
    installedSuccessfully: "Galerie installée avec succès !",
    sharedFiles: "Fichiers partagés : {count}",
    newVersionAvailable: "Nouvelle version disponible !",
    update: "Mettre à jour",
    clearDataConfirm: "Ceci effacera toutes les données de la galerie. Êtes-vous sûr ?",
    allDataCleared: "Toutes les données ont été effacées",
    settingsExported: "Paramètres exportés",
    invalidSettingsFile: "Fichier de paramètres invalide",
    settingsImported: "Paramètres importés",
    settingsImportFailed: "Échec de l'importation des paramètres",
    unexpectedError: "Une erreur inattendue est survenue",
    fileLoadError: "Erreur lors du chargement du fichier : {filename}",
    settingsComingSoon: "Panneau de paramètres bientôt disponible !",
    renameComingSoon: "Fonctionnalité de renommage bientôt disponible !",

    // Relative dates
    today: "Aujourd'hui",
    yesterday: "Hier",
    daysAgo: "Il y a {count} jours",
    weekAgo: "Il y a 1 semaine",
    weeksAgo: "Il y a {count} semaines",

    // Sharing
    galleryFiles: "Fichiers de la galerie",
    sharedFromGallery: "Partagé depuis Galerie",
    shareFailed: "Échec du partage des fichiers",
    fileShared: "Partagé {count} fichier",
    filesShared: "Partagé {count} fichiers",

    // File loading
    unsupportedFile: "{filename} : Fichier non supporté ou invalide",
    fileReadFailed: "{filename} : Échec de la lecture du fichier",
    someFilesFailed: "Certains fichiers n'ont pas pu être chargés : {errors}",
    folderLoadError: "Erreur lors du chargement du dossier",
    filesLoadError: "Erreur lors du chargement des fichiers",
    fileLoadFailed: "Échec du chargement du fichier",
    noCompatibleFiles: "Aucun fichier compatible trouvé dans ce dossier",
    folderAccessError: "Erreur d'accès au dossier",

    // File operations
    deleteFileConfirm: "Supprimer {count} fichier ?",
    deleteFilesConfirm: "Supprimer {count} fichiers ?",
    fileDeleted: "{count} fichier supprimé",
    filesDeleted: "{count} fichiers supprimés",
    fileCopied: "{count} fichier copié dans le presse-papiers",
    filesCopied: "{count} fichiers copiés dans le presse-papiers",
    fileDownloaded: "{count} fichier téléchargé",
    filesDownloaded: "{count} fichiers téléchargés",
    filePasted: "{count} fichier collé",
    filesPasted: "{count} fichiers collés",
    fileSavedToast: "Fichier enregistré",

    // Component loading
    audioPlayerLoadError: "Erreur lors du chargement du lecteur audio",
    pdfViewerLoadError: "Erreur lors du chargement du lecteur PDF",
    editToolsLoadError: "Erreur de chargement des outils d'édition",
    editImagesOnly: "L'édition n'est disponible que pour les images",

    // Saving
    changesSaved: "Modifications enregistrées",
    saveError: "Erreur lors de l'enregistrement",

    // Error display
    error: "Erreur",

    // Image adjustments
    adjustLight: "Clair",
    adjustColor: "Couleur",
    brightness: "Luminosité",
    exposure: "Exposition",
    contrast: "Contraste",
    highlights: "Essentiel",
    shadows: "Ombres",
    vignette: "Vignette",
    saturation: "Saturation",
    warmth: "Chaleur",
    tint: "Teinte",
    sharpness: "Netteté",

    // Annotation tools
    groupSize: "TAILLE",
    font: "Police",
    styles: "Styles",
    textColor: "Couleur du texte",
    groupColor: "COULEUR",
    applyAutomatically: "Appliquer automatiquement",
    brushSize: "Taille du pinceau",

    // Text editor
    textEditorHint: "Cliquez sur le texte pour le modifier. Les modifications seront enregistrées lors de la sauvegarde du document.",

    // Video player
    volume: "Volume",
    rewind10: "Reculer de 10s",
    play: "Lecture",
    forward10: "Avancer de 10s",
    playbackCancelled: "Lecture annulée",
    networkError: "Erreur réseau",
    decodingError: "Erreur de décodage",
    unsupportedFormat: "Format non supporté",
    unknownError: "Erreur inconnue",
    playbackError: "Erreur de lecture",
  },
};

// Get system language from navigator.language ('fr' if French, else 'en')
function getSystemLang() {
  const sysLang = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en';
  return sysLang.split('-')[0].toLowerCase() === 'fr' ? 'fr' : 'en';
}

let currentLang = getSystemLang();

/**
 * Translate a key in the current language, with optional {param} placeholders.
 * @param {string} key - Translation key
 * @param {Object} [params] - Placeholder values, e.g. { count: 3 }
 * @returns {string} Translated string
 */
function t(key, params) {
  let str = I18N_TRANSLATIONS[currentLang]?.[key] ?? I18N_TRANSLATIONS.en[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([name, value]) => {
      str = str.split(`{${name}}`).join(String(value));
    });
  }
  return str;
}

/**
 * Apply translations to all elements carrying data-i18n attributes.
 * @param {ParentNode} [root] - Root element to scope the search (defaults to document)
 */
function applyI18n(root = document) {
  const scope = root || document;
  if (!scope.querySelectorAll) return;

  const selector = '[data-i18n], [data-i18n-title], [data-i18n-placeholder], [data-i18n-aria]';
  let elements;
  if (scope === document) {
    elements = scope.querySelectorAll(selector);
  } else if (typeof scope.matches === 'function' && scope.matches(selector)) {
    elements = [scope, ...scope.querySelectorAll(selector)];
  } else {
    elements = scope.querySelectorAll(selector);
  }

  elements.forEach(el => {
    if (el.hasAttribute('data-i18n')) {
      el.textContent = t(el.getAttribute('data-i18n'));
    }
    if (el.hasAttribute('data-i18n-title')) {
      el.title = t(el.getAttribute('data-i18n-title'));
    }
    if (el.hasAttribute('data-i18n-placeholder')) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    }
    if (el.hasAttribute('data-i18n-aria')) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    }
  });
}

/**
 * Change the UI language at runtime (manual override only - the system
 * language always wins on page load and on the languagechange event).
 * @param {string} lang - Language code ('en' or 'fr')
 */
function setI18nLang(lang) {
  if (!I18N_TRANSLATIONS[lang]) {
    lang = 'en';
  }
  currentLang = lang;
  if (typeof document !== 'undefined') {
    if (document.documentElement) {
      document.documentElement.lang = lang;
    }
    applyI18n();
    updateLanguageSelectorUI();
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
  }
}

// The system language always wins when the OS language changes
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('languagechange', () => setI18nLang(getSystemLang()));
}

// ============ LANGUAGE SELECTOR (ported from JemaPDF LanguageSelector.jsx) ============

function updateLanguageSelectorUI() {
  const container = document.getElementById('language-selector');
  if (!container) return;

  const text = container.querySelector('.lang-text');
  if (text) {
    const other = currentLang === 'en' ? 'fr' : 'en';
    text.textContent = `${currentLang.toUpperCase()}/${other.toUpperCase()}`;
  }

  container.querySelectorAll('.language-option').forEach(option => {
    option.classList.toggle('active', option.dataset.lang === currentLang);
  });
}

function initLanguageSelector() {
  const container = document.getElementById('language-selector');
  if (!container) return;

  const dropdown = container.querySelector('.language-dropdown');
  if (dropdown && dropdown.children.length === 0) {
    Object.values(I18N_LANGUAGES).forEach(lang => {
      const option = document.createElement('div');
      option.className = 'language-option';
      option.dataset.lang = lang.code;
      option.setAttribute('role', 'button');
      option.setAttribute('tabindex', '0');
      const label = document.createElement('span');
      label.textContent = lang.name;
      option.appendChild(label);
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        setI18nLang(lang.code);
        closeLanguageDropdown();
      });
      dropdown.appendChild(option);
    });
  }

  container.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = container.classList.toggle('open');
    container.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.language-selector')) {
      closeLanguageDropdown();
    }
  });

  updateLanguageSelectorUI();
}

function closeLanguageDropdown() {
  const container = document.getElementById('language-selector');
  if (container) container.classList.remove('open');
}

// Hide the selector while a fullscreen viewer / PDF viewer / audio player is open
function isGalleryHomeVisible() {
  const fullscreen = document.getElementById('fullscreen-viewer');
  const pdf = document.getElementById('pdf-viewer');
  const audio = document.getElementById('audio-player');
  return !(
    (fullscreen && !fullscreen.classList.contains('hidden')) ||
    (pdf && !pdf.classList.contains('hidden')) ||
    (audio && !audio.classList.contains('hidden'))
  );
}

function updateLanguageSelectorVisibility() {
  const container = document.getElementById('language-selector');
  if (!container) return;
  container.classList.toggle('lang-hidden', !isGalleryHomeVisible());
}

function setupLanguageSelectorVisibility() {
  const ids = ['fullscreen-viewer', 'pdf-viewer', 'audio-player'];
  const observer = new MutationObserver(updateLanguageSelectorVisibility);
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    }
  });
  updateLanguageSelectorVisibility();
}

// ============ EXPORTS / BOOTSTRAP ============

globalThis.I18N_LANGUAGES = I18N_LANGUAGES;
globalThis.I18N_TRANSLATIONS = I18N_TRANSLATIONS;
globalThis.getSystemLang = getSystemLang;
globalThis.t = t;
globalThis.applyI18n = applyI18n;
globalThis.setI18nLang = setI18nLang;
globalThis.getCurrentI18nLang = () => currentLang;

// Initial application (script is deferred, DOM is parsed at this point)
if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.lang = currentLang;
  applyI18n();
  initLanguageSelector();
  if (typeof MutationObserver !== 'undefined') {
    setupLanguageSelectorVisibility();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N_LANGUAGES, I18N_TRANSLATIONS, getSystemLang, t, applyI18n, setI18nLang };
}
