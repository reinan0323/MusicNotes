// Database Client Configuration
const supabaseUrl = "https://yrkoxnxzvrhwzmhcqnsq.supabase.co";
const supabaseKey = "sb_publishable_wLmrCX0JfUS2if7niX0w2g_woIYwLMz";
const client = window.supabase.createClient(supabaseUrl, supabaseKey);

// Load music pieces into the select dropdown
async function loadPieces() {
  const { data: pieces, error } = await client
    .from('pieces')
    .select('*');

  if (error) {
    console.error('Error loading pieces:', error);
    return;
  }

  const selectElement = document.getElementById('piece-select');
  selectElement.innerHTML = '<option value="">-- Select a Piece --</option>';

  pieces.forEach(piece => {
    const option = document.createElement('option');
    option.value = piece.id;
    option.textContent = `${piece.composer_name} - ${piece.work_title}`;
    selectElement.appendChild(option);
  });
}

// Handle submitting a note and triggering the gacha pull
async function submitNote() {
  const pieceId = document.getElementById('piece-select').value;
  const noteText = document.getElementById('note-text').value.trim();

  if (!pieceId || !noteText) {
    alert("Please select a piece and write a note before sending!");
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending into the ether...";

  // Save user note to database
  const { error: insertError } = await client
    .from('notes')
    .insert([
      { piece_id: pieceId, note_text: noteText }
    ]);

  if (insertError) {
    console.error('Error submitting note:', insertError);
    alert('Could not send note into the ether: ' + insertError.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Send into Ether & Receive a Note";
    return;
  }

  // Fetch a random note from someone else
  await getRandomNote();

  // Reset inputs
  document.getElementById('piece-select').value = "";
  document.getElementById('note-text').value = "";
  submitBtn.disabled = false;
  submitBtn.textContent = "Send into Ether & Receive a Note";
}

// Fetch a random note from the database
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

// Initialize on page load
loadPieces();