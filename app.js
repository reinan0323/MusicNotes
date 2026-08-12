// Database Client Configuration
const supabaseUrl = "https://yrkoxnxzvrhwzmhcqnsq.supabase.co";
const supabaseKey = "sb_publishable_wLmrCX0JfUS2if7niX0w2g_woIYwLMz";
const client = window.supabase.createClient(supabaseUrl, supabaseKey);


let currentSearchResults = [];
let selectedPieceId = null;
let currentNoteId = null;




// State swapping
function showState(stateId) {
  const allStates = ['gate-view', 'sending-view','ether-view','gacha-reveal'];

  // Loop through all the state/divs
  for (const id of allStates){
    const element = document.getElementById(id)
    // show only stateId div element, hide all others.
    if (id === stateId){
      element.style.display = 'block';
    } else {
      element.style.display = 'none';
    }
  }
}





// Debounce helper; only execute the latest input/event/call to a function
function debounce(func, delay = 300) {
  let timeoutId;
  //...means takes all arguments, not only the first parameter
  return (...args) => {
    //clear previous timer, if any
    clearTimeout(timeoutId);
    //create a new timer for the latest function call; timeout triggers func
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// 1. Fetch search results from Supabase & populate datalist
async function searchPieces(searchTerm) {
  const datalistElement = document.getElementById('piece-options');
  const inputElement = document.getElementById('piece-input');

  // Don't show dropdown list if input is null/empty/falsey or less than 2 characters
  if (!searchTerm || searchTerm.trim().length < 2) {
    if (datalistElement) {
      datalistElement.innerHTML = '';
    }
    currentSearchResults = [];
    selectedPieceId = null;
    return;
  }

  // Clean user input string
  // Replace non alphabet or numerals with spaces
  // e.g. "rachmaninoff piano concerto no.2" -> "rachmaninoff piano concerto no 2"
  const cleanTerm = searchTerm.replace(/[^a-zA-Z0-9\s]/g, " ");
  // Split into words where space is, and convert into an array, and filter out empty strings
  // e.g. [rachmaninoff, piano, concerto, no, 2]
  const words = cleanTerm.trim().split(/\s+/).filter(w => w.length > 0);

  // Safety check; if word array is empty, exit search func
  if (words.length === 0) return;

  // Build multi-word query
  let query = client.from('pieces').select('id, composer_name, work_title');
  words.forEach(word => {
    // Second layer of defense after the whitelist; making sure " are omitted. Kinda redundant.
    const safeWord = word.replace(/"/g, '');
    // Each loop adds the new query condition on top of the previous. For some weird reason, query builders don't reassign vars, they use a "builder pattern" which ADDs conditions.
    query = query.or(`composer_name.ilike."%${safeWord}%",work_title.ilike."%${safeWord}%"`);
  });

  // Actually request from supabase
  const { data: pieces, error } = await query.limit(20);
  // Throw an error if supabase returns error or pieces is falsey (no hit on query is still truthy)
  if (error || !pieces) {
    console.error('Error loading pieces:', error);
    return;
  }
  // Update global
  currentSearchResults = pieces;
  // Initialize (clear) dropdown list before repopulating with each search attempt
  datalistElement.innerHTML = '';

  // Format each piece and append into dropdown list
  pieces.forEach(piece => {
    const option = document.createElement('option');
    option.value = `${piece.composer_name} - ${piece.work_title}`;
    datalistElement.appendChild(option);
  });

  // Verify match in case full text was selected/typed
  checkMatch(inputElement.value);
}

// Check typed text against stored search results to set selectedPieceId
// String match due to nature of datalist element; is fragile, should fix.
function checkMatch(inputValue) {
  const currentText = inputValue.trim();
  const match = currentSearchResults.find(
    p => `${p.composer_name} - ${p.work_title}` === currentText
  );
  // Update global. If match is true, assign selectedPieceId; otherwise, null.
  selectedPieceId = match ? match.id : null;
}

// Submit note
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

  const { data: insertedNote, error: insertError } = await client
    .from('notes')
    .insert([{ piece_id: selectedPieceId, note_text: noteText }])
    .select();

  if (insertError) {
    console.error('Error submitting note:', insertError);
    alert('Could not send note: ' + insertError.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Send into Ether & Receive a Note";
    return;
  }

  // Update global
  currentNoteId = insertedNote[0].id;

  // Browser stores info that user has submitted note; persists across sessions.
  localStorage.setItem('etherUnlocked', 'true');

  await getRandomNote();

  // Clean reset of user search/note input, globals, and datalist
  inputElement.value = "";
  noteTextElement.value = "";
  currentNoteId = null;
  selectedPieceId = null;
  currentSearchResults = [];
  document.getElementById('piece-options').innerHTML = "";

  submitBtn.disabled = false;
  submitBtn.textContent = "Send into Ether & Receive a Note";
}

// Fetch random note
async function getRandomNote() {
  // .rpc calls function that was declared on supabase side, which returns one random note.
  // e.g. [{ id:..., note_text: ..., composer_name: ..., work_title: ... }]
  const { data: data, error } = await client.rpc('get_random_note', {exclude_id: currentNoteId});

  if (error || !data || data.length === 0) {
    console.error('Error fetching random note:', error);
    return;
  }

  const randomNote = data[0];

  // Populate display with retrieved note info
  document.getElementById('received-piece').textContent = 
    `${randomNote.composer_name} - ${randomNote.work_title}`;
  document.getElementById('received-text').textContent = randomNote.note_text;
  
  // Show gacha-reveal element
  document.getElementById('gacha-reveal').style.display = "block";
}

// Initialize event listeners safely after DOM loads
// .addEventListner('eventName', funcToExecuteOnEvent)
document.addEventListener('DOMContentLoaded', () => {

  // check if user has already submitted note before
  const hasUnlocked = localStorage.getItem('etherUnlocked') === 'true';

  if (hasUnlocked) {
    showState('ether-view');
  } else {
    showState('gate-view');
  }

  // piece search user input
  const inputElement = document.getElementById('piece-input');
  // Listen for user input, debounce so requests aren't overloaded
  const debouncedSearch = debounce((e) => searchPieces(e.target.value), 300);
  inputElement.addEventListener('input', debouncedSearch);
  // Instant ID lock when user clicks an option from the datalist dropdown
  inputElement.addEventListener('change', (e) => checkMatch(e.target.value));


  // submit note btn
  document.getElementById('submit-btn').addEventListener('click', () => {
    submitNote();
    showState('gacha-reveal');
  });

  // skip to ether without submitting
  document.getElementById('skip-link').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.setItem('etherUnlocked', 'true');
    showState('ether-view');
  });
  

  // add another note
  document.getElementById('add-note-btn').addEventListener('click', () => showState('gate-view'));


  // close revealed note btn
  document.getElementById('close-reveal-btn').addEventListener('click', () => showState('ether-view'));



});