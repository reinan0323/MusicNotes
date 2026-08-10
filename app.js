// Database Client Configuration
const supabaseUrl = "https://yrkoxnxzvrhwzmhcqnsq.supabase.co";
const supabaseKey = "sb_publishable_wLmrCX0JfUS2if7niX0w2g_woIYwLMz";
const client = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentSearchResults = [];
let selectedPieceId = null;

// Debounce helper
function debounce(func, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// 1. Fetch search results from Supabase & populate datalist
async function searchPieces(searchTerm) {
  const datalistElement = document.getElementById('piece-options');
  const inputElement = document.getElementById('piece-input');

  if (!searchTerm || searchTerm.trim().length < 2) {
    if (datalistElement) datalistElement.innerHTML = '';
    currentSearchResults = [];
    selectedPieceId = null;
    return;
  }

  // 1. Replace punctuation (periods, commas, dashes) with spaces
  // "rachmaninoff piano concerto no.2" -> "rachmaninoff piano concerto no 2"
  const cleanTerm = searchTerm.replace(/[.,\-\/#!$%\^&\*;:{}=\-_`~()]/g, " ");

  // 2. Split into words and filter out empty strings
  const words = cleanTerm.trim().split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return;

  // 3. Build multi-word query
  let query = client.from('pieces').select('id, composer_name, work_title');

  words.forEach(word => {
    // Escape double quotes to prevent SQL syntax errors
    const safeWord = word.replace(/"/g, '""');
    query = query.or(`composer_name.ilike."%${safeWord}%",work_title.ilike."%${safeWord}%"`);
  });

  const { data: pieces, error } = await query.limit(20);

  if (error || !pieces) {
    console.error('Error loading pieces:', error);
    return;
  }

  currentSearchResults = pieces;
  datalistElement.innerHTML = '';

  pieces.forEach(piece => {
    const option = document.createElement('option');
    option.value = `${piece.composer_name} - ${piece.work_title}`;
    datalistElement.appendChild(option);
  });

  // Verify match in case full text was selected/typed
  checkMatch(inputElement.value);
  // Verify match in case full text was selected/typed
  checkMatch(inputElement.value);
}

// 2. Check typed text against stored search results to set selectedPieceId
function checkMatch(inputValue) {
  const currentText = inputValue.trim();
  const match = currentSearchResults.find(
    p => `${p.composer_name} - ${p.work_title}` === currentText
  );

  selectedPieceId = match ? match.id : null;
}

// 3. Submit Note
async function submitNote() {
  const inputElement = document.getElementById('piece-input');
  const noteTextElement = document.getElementById('note-text');

  // Final check right before submitting
  if (!selectedPieceId) {
    checkMatch(inputElement.value);
  }

  const noteText = noteTextElement.value.trim();

  if (!selectedPieceId || !noteText) {
    alert("Please select a piece from the suggestions list and write a note!");
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending into the ether...";

  const { error: insertError } = await client
    .from('notes')
    .insert([{ piece_id: selectedPieceId, note_text: noteText }]);

  if (insertError) {
    console.error('Error submitting note:', insertError);
    alert('Could not send note: ' + insertError.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Send into Ether & Receive a Note";
    return;
  }

  await getRandomNote();

  // Clean reset of input, state, and rendered datalist
  inputElement.value = "";
  noteTextElement.value = "";
  selectedPieceId = null;
  currentSearchResults = [];
  document.getElementById('piece-options').innerHTML = "";

  submitBtn.disabled = false;
  submitBtn.textContent = "Send into Ether & Receive a Note";
}

// 4. Fetch random note
async function getRandomNote() {
  const { data: notes, error } = await client
    .from('notes')
    .select(`
      note_text,
      pieces ( composer_name, work_title )
    `);

  if (error || !notes || notes.length === 0) {
    console.error('Error fetching random note:', error);
    return;
  }

  const randomIndex = Math.floor(Math.random() * notes.length);
  const randomNote = notes[randomIndex];

  document.getElementById('received-piece').textContent = 
    `${randomNote.pieces.composer_name} - ${randomNote.pieces.work_title}`;
  document.getElementById('received-text').textContent = randomNote.note_text;
  
  document.getElementById('gacha-result').style.display = "block";
}

// Initialize event listeners safely after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  const inputElement = document.getElementById('piece-input');

  // Debounced API call as user types
  const debouncedSearch = debounce((e) => searchPieces(e.target.value), 300);
  inputElement.addEventListener('input', debouncedSearch);

  // Instant ID lock when user clicks an option from the datalist dropdown
  inputElement.addEventListener('change', (e) => checkMatch(e.target.value));
});
