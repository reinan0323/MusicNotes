// Database Client Configuration
const supabaseUrl = "https://yrkoxnxzvrhwzmhcqnsq.supabase.co";
const supabaseKey = "sb_publishable_wLmrCX0JfUS2if7niX0w2g_woIYwLMz";
const client = window.supabase.createClient(supabaseUrl, supabaseKey);



let currentSearchResults = [];
let selectedPieceId = null;

// exclude the note that user *just* sent, and account for ether filter
let excludedIds = [];

let currentComposerResults = [];
let filterComposer = null;

let myNoteIds = [];




// State swapping
function showState(stateId) {
  const allStates = ['gate-view', 'sending-view','ether-view','gacha-reveal'];
  
  // Loop through all the state/divs
  for (const id of allStates){
    const element = document.getElementById(id)
    // show only stateId div element, hide all others.
    if (id === stateId){
      element.style.display = (id === 'ether-view') ? 'flex' : 'block';
    } else {
      element.style.display = 'none';
    }
  }

  if (stateId === 'ether-view'){
    renderField();
  }
}


function playHoverSound() {
  const HoverSounds = "abcdefg";
  const randomHoverSound = HoverSounds[Math.floor(Math.random() * 7 + 1)];
  const sound = new Audio(`audio/${randomHoverSound}.mp3`);
  sound.volume = 0.3;
  sound.play().catch(error => {
    console.log("Browser blocked hover sound until user clicks somewhere")
  });
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


// Dots in the ether
async function renderField() {
  const fieldEl = document.getElementById('field');
  fieldEl.innerHTML = '';
  const area = fieldEl.offsetWidth * fieldEl.offsetHeight;
  let count = (Math.floor(area / 12000) < 25) ? 25 : Math.floor(area / 12000); // tune the divisor to taste
  
 
  // exceptions: determine count
  if (document.getElementById('show-my-notes-checkbox').checked) {
    count = myNoteIds.length;
  }

  if (filterComposer) {
    count = await getNotesCount();
  }

  // if (!count) {
  //   const area = fieldEl.offsetWidth * fieldEl.offsetHeight;
  //   count = (Math.floor(area / 12000) < 25) ? 25 : Math.floor(area / 12000); // tune the divisor to taste
  // }


  

  for (let i = 0; i < count; i++) {
    // note-dot class controls animation for bopping
    const dot = document.createElement('div');
    dot.className = 'note-dot';

    // note-dot-wrapper class controls animation for drift across
    const dotWrapper = document.createElement('div');
    dotWrapper.className = 'note-dot-wrapper';
    
    // randomly load a png
    const colors = ['red','orange','yellow','green','blue','purple','pink']
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const musicNotations = ['quarter','eighth']
    const randomMusicNotation = musicNotations[Math.floor(Math.random() * musicNotations.length)]

    dot.style.backgroundImage = `url('redeighth.png')`;

    // each note will have a unique property to randomize animation
    dot.style.setProperty('--duration', (Math.random() * 6 + 3) + 's'); /* how quickly dot bops up and down */
    const durationA = parseFloat(dot.style.getPropertyValue('--duration'));
    dot.style.animationDelay = `-${Math.random() * durationA}s`; /* when the bop starts to prevent all notes from bopping uniformly */

    
    dotWrapper.style.setProperty('--top-pos', Math.random() * 90 + '%'); /* randomized vertical spawn position */
    dotWrapper.style.setProperty('--duration', (Math.random() * 6 + 50) + 's'); /* randomized drift across speed */

    const durationB = parseFloat(dotWrapper.style.getPropertyValue('--duration'));
    dotWrapper.style.animationDelay = `-${Math.random() * durationB}s`;

    
    dot.addEventListener('click', () => catchNote(dot));
    // dot.addEventListener('mouseover', playHoverSound);

    dotWrapper.appendChild(dot);
    fieldEl.appendChild(dotWrapper);
  }
}

async function catchNote(dotElement) {
  console.log('caught a dot!', dotElement);
  // real fetch-and-reveal logic comes next
  const found = await getRandomNote();
  if (found){
    showState('gacha-reveal');
  } else if (filterComposer || document.getElementById('show-my-notes-checkbox').checked) {
      excludedIds = [];
      catchNote(dotElement);
  } else {
      alert("You've caught every note in the ether right now; come back later or add one yourself.");
  }
  
}



// Fetch search results from Supabase & populate datalist
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

  // Error if no piece or note content
  if (!selectedPieceId || !noteText) {
    alert("Please select a piece from the suggestions list and write a note!");
    return;
  }

  // Content moderation
  const cleanedText = await profanityCleaner.clean(noteText);
  if (cleanedText !== noteText) {
    alert("Please remove inappropriate language from your note!");
    // Clean reset of user search/note input, globals, and datalist
    inputElement.value = "";
    noteTextElement.value = "";
    selectedPieceId = null;
    currentSearchResults = [];
    document.getElementById('piece-options').innerHTML = "";
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

  // Update globals (append current note id into excludedIds array)
  excludedIds.push(insertedNote[0].id);

  myNoteIds.push(insertedNote[0].id);
  localStorage.setItem('myNoteIds', JSON.stringify(myNoteIds));


  // Browser stores info that user has submitted note; persists across sessions.
  localStorage.setItem('etherUnlocked', 'true');

  // await getRandomNote();

  // Clean reset of user search/note input, globals, and datalist
  inputElement.value = "";
  noteTextElement.value = "";
  selectedPieceId = null;
  currentSearchResults = [];
  document.getElementById('piece-options').innerHTML = "";

  submitBtn.disabled = false;
  submitBtn.textContent = "Send into Ether & Receive a Note";

  showState('sending-view');
}




// Filter ether dots by composer name
async function searchComposers(searchTerm){
  const datalistElement = document.getElementById('composer-options');

  if (!searchTerm || searchTerm.trim().length < 2){
    if (datalistElement) {
      datalistElement.innerHTML = '';
    }
    currentComposerResults = [];
    filterComposer = null;
    return;
  }

  // Fetch composers from supabase (searchTerm 'ach' returns [{composer_name: 'rachmaninoff'}, {composer_name: 'bach'}] etc.)
  const { data, error } = await client.rpc('search_composers', { search_term: searchTerm.trim()});

  if (error || !data){
    console.error('Error searching composers: ', error);
    return;
  }

  // .map loops through each item (row) in data (array) begetting ['bach','rachmaninoff']
  currentComposerResults = data.map(row => row.composer_name);
  datalistElement.innerHTML = '';

  // For each composer name, populate dropdown list
  currentComposerResults.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    datalistElement.appendChild(option);
  });

}

// called when user clicks off of input field
function checkComposerMatch(inputValue){
  const currentText = inputValue.trim();
  // Assign global var
  filterComposer = currentComposerResults.includes(currentText) ? currentText : null;
}


async function getNotesCount(){
  const { data: data, error } = await client.rpc('get_notes_count', {
    filter_composer: filterComposer
  });
  if (error || data === null) {
    console.error('Error getting notes count:', error);
    return false;
  }
  return data;
}



// Fetch random note
async function getRandomNote() {

  // Only pass the myNotesId array when the checkbox is checked
  const checkboxElement = document.getElementById('show-my-notes-checkbox');
  const noteIdsToInclude = checkboxElement.checked ? myNoteIds : [];


  // .rpc calls function that was declared on supabase side, which returns one random note.
  // e.g. [{ id:..., note_text: ..., composer_name: ..., work_title: ... }]

  const { data: data, error } = await client.rpc('get_random_note', {
    exclude_ids: excludedIds,
    my_notes_ids: noteIdsToInclude,
    filter_composer: filterComposer
  });


  if (error || !data || data.length === 0) {
    console.error('Error fetching random note:', error);
    return false;
  }

  const randomNote = data[0];

  // Update global of excluded Ids
  excludedIds.push(randomNote.id);

  // Populate display with retrieved note info
  document.getElementById('received-piece').textContent = 
    `${randomNote.composer_name} - ${randomNote.work_title}`;
  document.getElementById('received-text').textContent = randomNote.note_text;
  
  // Show gacha-reveal element
  document.getElementById('gacha-reveal').style.display = "block";

  return true;
}






///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Initialize event listeners safely after DOM loads
// .addEventListner('eventName', funcToExecuteOnEvent)
document.addEventListener('DOMContentLoaded', () => {

  // check if user has already submitted note before
  const hasUnlocked = localStorage.getItem('etherUnlocked') === 'true';

  if (hasUnlocked) {
    showState('ether-view');
    myNoteIds = JSON.parse(localStorage.getItem('myNoteIds')) || [];
  } else {
    showState('gate-view');
  }



  // Gate view piece search user input
  const inputElement = document.getElementById('piece-input');
  // Listen for user input, debounce so requests aren't overloaded
  const debouncedSearch = debounce((e) => searchPieces(e.target.value), 300);
  inputElement.addEventListener('input', debouncedSearch);
  // Instant ID lock when user clicks an option from the datalist dropdown
  inputElement.addEventListener('change', (e) => checkMatch(e.target.value));


  // Ether view composer filter input
  const composerInput = document.getElementById('composer-filter-input');
  const debouncedComposerSearch = debounce((e) => searchComposers(e.target.value), 300);
  composerInput.addEventListener('input', debouncedComposerSearch);
  composerInput.addEventListener('change', async (e) => {
    checkComposerMatch(e.target.value);
    renderField();
  });

  composerInput.addEventListener('blur', () => {
  checkComposerMatch(composerInput.value);
  if (!filterComposer) {
    composerInput.value = '';
  }
});

  // document.getElementById('clear-filter-btn').addEventListener('click', () => {
  //   filterComposer = null;
  //   composerInput.value = '';
  // });


  
  // submit note btn (async/await because getRandomNote is called within submitNote; showState could show blank due to race conditions)
  document.getElementById('submit-btn').addEventListener('click', async () => {
    await submitNote();
  });

  // skip sending animation btn
  document.getElementById('skip-send-animation-btn').addEventListener('click', () => showState('ether-view'));

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


  window.addEventListener('resize', debounce(() => renderField(), 300));

  document.getElementById('show-my-notes-checkbox').addEventListener('change', () => renderField());


});
