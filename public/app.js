/**
 * ============================================================================
 * JAVASCRIPT FRONTEND - LOGIQUE DU WIDGET CHATBOT
 * ============================================================================
 * 
 * Ce script gère :
 * 1. L'ouverture / fermeture de la fenêtre de discussion.
 * 2. L'envoi des messages vers l'API interne /api/chat.
 * 3. L'affichage des bulles de discussion et de l'indicateur de frappe.
 * 4. La mémoire de conversation (historique des échanges en mémoire vive).
 * 5. Le rendu simple du Markdown reçu du modèle (gras, puces, sauts de ligne).
 * 6. L'affichage dynamique de la FAQ sur la page principale.
 */

// ----------------------------------------------------------------------------
// 1. État global du client (State)
// ----------------------------------------------------------------------------
const state = {
  isOpen: false,
  isSending: false,
  // Historique local des échanges pour permettre le dialogue multi-tours
  conversationHistory: []
};

// ----------------------------------------------------------------------------
// 2. Sélection des éléments du DOM
// ----------------------------------------------------------------------------
const chatWidget = document.getElementById('chatWidget');
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatCloseBtn = document.getElementById('chatCloseBtn');
const chatWindow = document.getElementById('chatWindow');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const chatBadge = document.getElementById('chatBadge');
const quickQuestions = document.getElementById('quickQuestions');
const faqDisplay = document.getElementById('faqDisplay');

// ----------------------------------------------------------------------------
// 3. Fonctions d'interface : Ouvrir / Fermer le Chat
// ----------------------------------------------------------------------------

function toggleChat() {
  if (state.isOpen) {
    closeChat();
  } else {
    openChat();
  }
}

function openChat() {
  state.isOpen = true;
  chatWidget.classList.add('is-open');
  chatWindow.classList.remove('closed');
  // On cache le badge de notification une fois le chat ouvert
  if (chatBadge) chatBadge.style.display = 'none';
  // Focus automatique sur le champ texte pour l'accessibilité
  setTimeout(() => chatInput.focus(), 200);
}

function closeChat() {
  state.isOpen = false;
  chatWidget.classList.remove('is-open');
  chatWindow.classList.add('closed');
}

// Rendre la fonction accessible depuis le bouton héro de la page
window.chatWidget = { openChat, closeChat };

// ----------------------------------------------------------------------------
// 4. Utilitaires d'affichage : Rendu des messages et Markdown
// ----------------------------------------------------------------------------

/**
 * Convertisseur Markdown léger et sécurisé vers HTML.
 * Transforme le gras (**texte**), l'italique (*texte*), les listes et les retours à la ligne.
 * Évite le chargement d'une bibliothèque tierce lourde.
 */
function parseMarkdown(text) {
  if (!text) return '';
  
  // Échappement des balises HTML pour éviter les failles XSS
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Remplacement du gras : **texte** -> <strong>texte</strong>
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Remplacement de l'italique : *texte* -> <em>$1</em>
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Remplacement des listes à puces (- élément ou * élément)
  escaped = escaped.replace(/^[\*\-]\s+(.*)$/gm, '• $1');

  // Remplacement des sauts de ligne par <br>
  escaped = escaped.replace(/\n/g, '<br>');

  return escaped;
}

/**
 * Ajoute une bulle de message dans la zone de défilement.
 * @param {'user' | 'bot'} sender - Expéditeur du message
 * @param {string} text - Contenu texte brut ou formaté
 */
function appendMessage(sender, text) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', sender);

  const bubbleEl = document.createElement('div');
  bubbleEl.classList.add('message-bubble');

  // Si c'est l'utilisateur, on affiche en texte brut. Si c'est le bot, on parse le markdown.
  if (sender === 'bot') {
    bubbleEl.innerHTML = parseMarkdown(text);
  } else {
    bubbleEl.textContent = text;
  }

  // Horodatage
  const timeEl = document.createElement('span');
  timeEl.classList.add('message-time');
  const now = new Date();
  timeEl.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  messageEl.appendChild(bubbleEl);
  messageEl.appendChild(timeEl);
  chatMessages.appendChild(messageEl);

  // Défilement automatique vers le bas
  scrollToBottom();
}

/**
 * Fait défiler la boîte de dialogue vers le dernier message.
 */
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Affiche ou masque l'indicateur "NovaBot est en train d'écrire...".
 */
function setTyping(isTyping) {
  state.isSending = isTyping;
  chatSendBtn.disabled = isTyping;
  chatInput.disabled = isTyping;

  if (isTyping) {
    typingIndicator.classList.remove('hidden');
  } else {
    typingIndicator.classList.add('hidden');
  }
  scrollToBottom();
}

// ----------------------------------------------------------------------------
// 5. Envoi du message au serveur (Appel fetch vers /api/chat)
// ----------------------------------------------------------------------------

async function handleSendMessage(userText) {
  const text = (userText || chatInput.value).trim();
  if (!text || state.isSending) return;

  // 1. Afficher immédiatement le message utilisateur dans le widget
  appendMessage('user', text);
  chatInput.value = '';

  // 2. Activer l'indicateur de chargement
  setTyping(true);

  try {
    // 3. Appel AJAX vers notre serveur backend Node.js
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        // On envoie les 6 derniers messages d'historique pour garder le fil de la discussion
        history: state.conversationHistory.slice(-6)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erreur inconnue du serveur.');
    }

    // 4. Afficher la réponse du bot
    appendMessage('bot', data.reply);

    // 5. Enregistrer les échanges dans l'historique pour les prochains tours
    state.conversationHistory.push({ role: 'user', text: text });
    state.conversationHistory.push({ role: 'model', text: data.reply });

  } catch (error) {
    console.error('Erreur chatbot :', error);
    appendMessage('bot', `⚠️ **Oups !** ${error.message || 'Impossible de joindre le serveur. Vérifiez que server.js tourne bien.'}`);
  } finally {
    // 6. Rétablir le champ de saisie
    setTyping(false);
    chatInput.focus();
  }
}

// ----------------------------------------------------------------------------
// 6. Chargement et affichage de la FAQ sur la page principale
// ----------------------------------------------------------------------------

async function loadFaqOnPage() {
  if (!faqDisplay) return;
  
  try {
    const res = await fetch('/api/faq');
    if (!res.ok) throw new Error('Impossible de charger la FAQ');
    const items = await res.json();

    faqDisplay.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'faq-card';
      card.innerHTML = `
        <div class="faq-category">${item.categorie || 'Info'}</div>
        <div class="faq-question">${item.question}</div>
        <div class="faq-answer">${item.reponse}</div>
      `;
      faqDisplay.appendChild(card);
    });
  } catch (err) {
    faqDisplay.innerHTML = '<p class="text-muted">La documentation FAQ est disponible dans le fichier <code>data/faq.json</code>.</p>';
  }
}

// ----------------------------------------------------------------------------
// 7. Écouteurs d'événements (Event Listeners)
// ----------------------------------------------------------------------------

// Clics sur les boutons de toggle / fermeture
chatToggleBtn.addEventListener('click', toggleChat);
chatCloseBtn.addEventListener('click', closeChat);

// Soumission du formulaire
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSendMessage();
});

// Clic sur une suggestion rapide (Chips)
if (quickQuestions) {
  quickQuestions.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-btn');
    if (chip && chip.dataset.question) {
      handleSendMessage(chip.dataset.question);
    }
  });
}

// Fermeture avec la touche Échap
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.isOpen) {
    closeChat();
  }
});

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  loadFaqOnPage();
});
