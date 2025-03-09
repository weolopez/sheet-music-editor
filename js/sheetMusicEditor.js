export class SheetMusicEditor {
  constructor() {
    // VexFlow objects
    this.renderer = null;
    this.context = null;
    this.stave = null;

    // Music data
    this.notes = [];
    this.beatValue = 4; // 4/4 time
    this.beatsPerMeasure = 4;
    this.currentBeats = 0;
    this.noteMap = {
      'w': 4,    // whole note = 4 beats
      'h': 2,    // half note = 2 beats
      'q': 1,    // quarter note = 1 beat
      '8': 0.5,  // eighth note = 1/2 beat
      '16': 0.25 // sixteenth note = 1/4 beat
    };

    // Variables to store hover state
    this.hoverBeat = undefined;  // snapped beat value (fractional)
    this.hoverNoteName = undefined;

    // Initialize with rests for a full measure
    this.initializeWithRests();
  }

  init() {
    // Create the renderer
    const outputDiv = document.getElementById('output');
    this.renderer = new VexFlow.Renderer(outputDiv, VexFlow.Renderer.Backends.SVG);

    // Configure renderer
    this.renderer.resize(800, 200);
    this.context = this.renderer.getContext();

    // Create a stave
    this.stave = new VexFlow.Stave(10, 40, 780);
    this.stave.addClef('treble').addTimeSignature('4/4');

    // Draw the score initially
    this.drawScore();

    // Add event listeners for click and hover
    outputDiv.addEventListener('mousemove', this.handleMouseMove.bind(this));
    outputDiv.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    outputDiv.addEventListener('click', this.handleClick.bind(this));
    document.getElementById('reset-btn').addEventListener('click', this.resetMeasure.bind(this));
  }

  initializeWithRests() {
    this.notes = [];
    this.currentBeats = 0;
    let remainingBeats = this.beatsPerMeasure;

    while (remainingBeats > 0) {
      let restDuration;
      if (remainingBeats >= 4) {
        restDuration = 'w';
      } else if (remainingBeats >= 2) {
        restDuration = 'h';
      } else if (remainingBeats >= 1) {
        restDuration = 'q';
      } else if (remainingBeats >= 0.5) {
        restDuration = '8';
      } else {
        restDuration = '16';
      }

      this.notes.push(new VexFlow.StaveNote({
        keys: ["b/4"],
        duration: restDuration + "r" // rest note
      }));

      remainingBeats -= this.noteMap[restDuration];
      this.currentBeats += this.noteMap[restDuration];
    }
  }

  drawScore() {
    // Clear the context
    this.context.clear();

    // Draw the stave
    this.stave.setContext(this.context).draw();

    // Create a voice
    const voice = new VexFlow.Voice({
      num_beats: this.beatsPerMeasure,
      beat_value: this.beatValue
    });
    voice.addTickables(this.notes);

    // Compute available width from the note-start position
    const noteStartX = this.stave.getNoteStartX();
    const availableWidth = this.stave.width - (noteStartX - this.stave.x);

    // Format using the available width
    new VexFlow.Formatter()
      .joinVoices([voice])
      .format([voice], availableWidth);

    voice.draw(this.context, this.stave);
  }

  // Helper: Split a duration into allowed rest durations
  splitDuration(remainder) {
    const durations = [];
    const allowed = [
      { key: 'w', value: 4 },
      { key: 'h', value: 2 },
      { key: 'q', value: 1 },
      { key: '8', value: 0.5 },
      { key: '16', value: 0.25 }
    ];
    let remaining = remainder;
    for (const { key, value } of allowed) {
      while (remaining >= value - 0.0001) { // use epsilon for float imprecision
        durations.push(key);
        remaining -= value;
        remaining = Math.round(remaining * 10000) / 10000;
      }
    }
    return durations;
  }

  handleMouseMove(event) {
    const outputDiv = document.getElementById('output');
    const svgElement = outputDiv.querySelector('svg');
    if (!svgElement) return;

    const svgRect = svgElement.getBoundingClientRect();
    const mouseX = event.clientX - svgRect.left;
    const mouseY = event.clientY - svgRect.top;

    // Calculate available note area
    const noteStartX = this.stave.getNoteStartX();
    const availableWidth = this.stave.width - (noteStartX - this.stave.x) - 20;

    // If mouse is outside note area, remove the placeholder.
    if (mouseX < noteStartX || mouseX > this.stave.x + this.stave.width) {
      this.removePlaceholder();
      this.hoverBeat = undefined;
      this.hoverNoteName = undefined;
      return;
    }

    // Compute raw beat value (0 to beatsPerMeasure)
    let rawBeat = ((mouseX - noteStartX) / availableWidth) * this.beatsPerMeasure;
    // Snap to the nearest 0.25 beat (adjust the snapping resolution as needed)
    let snappedBeat = Math.round(rawBeat * 4) / 4;
    // Clamp within [0, beatsPerMeasure - 0.25]
    snappedBeat = Math.max(0, Math.min(snappedBeat, this.beatsPerMeasure - 0.25));

    // Compute placeholder X using the same snapped beat value.
    // Here we assume each 0.25-beat division is evenly spaced.
    const placeholderX = noteStartX + ((snappedBeat + 0.125) / this.beatsPerMeasure) * availableWidth;

    // Vertical calculations: snap to the nearest staff line/space.
    // We'll use the top line and bottom line positions to compute candidate positions.
    const topLineY = this.stave.getYForLine(0);
    const bottomLineY = this.stave.getYForLine(4);
    const lineSpacing = (bottomLineY - topLineY) / 4;
    const candidatePositions = [];
    for (let i = 0; i < 9; i++) {
      candidatePositions.push(topLineY + (i * (lineSpacing / 2)));
    }
    let closestCandidate = candidatePositions[0];
    let closestIndex = 0;
    for (let i = 1; i < candidatePositions.length; i++) {
      if (Math.abs(candidatePositions[i] - mouseY) < Math.abs(closestCandidate - mouseY)) {
        closestCandidate = candidatePositions[i];
        closestIndex = i;
      }
    }
    const placeholderY = closestCandidate;
    const noteNames = ['f/5', 'e/5', 'd/5', 'c/5', 'b/4', 'a/4', 'g/4', 'f/4', 'e/4'];
    const noteName = noteNames[closestIndex] || 'b/4';

    // Store hover state for click handling.
    this.hoverBeat = snappedBeat;
    this.hoverNoteName = noteName;

    // Create or update the placeholder marker.
    let placeholder = svgElement.querySelector('#placeholder');
    if (!placeholder) {
      placeholder = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      placeholder.setAttribute("id", "placeholder");
      placeholder.setAttribute("r", "8");
      placeholder.setAttribute("fill", "none");
      placeholder.setAttribute("stroke", "blue");
      placeholder.setAttribute("stroke-dasharray", "4,2");
      // Ensure the marker does not capture mouse events.
      placeholder.setAttribute("pointer-events", "none");
      svgElement.appendChild(placeholder);
    }
    placeholder.setAttribute("cx", placeholderX);
    placeholder.setAttribute("cy", placeholderY);
  }

  handleMouseLeave(event) {
    this.removePlaceholder();
    this.hoverBeat = undefined;
    this.hoverNoteName = undefined;
  }

  handleClick(event) {
    if (this.hoverBeat === undefined || this.hoverNoteName === undefined) {
      return;
    }
    const duration = document.getElementById('note-duration').value;
    const beatValue = this.noteMap[duration];

    // Use the same snapped beat value for note insertion.
    this.replaceNoteAtPosition(this.hoverBeat, this.hoverNoteName, duration, beatValue);

    this.removePlaceholder();
    this.hoverBeat = undefined;
    this.hoverNoteName = undefined;
    this.drawScore();
  }

  removePlaceholder() {
    const outputDiv = document.getElementById('output');
    const svgElement = outputDiv.querySelector('svg');
    if (!svgElement) return;
    const placeholder = svgElement.querySelector('#placeholder');
    if (placeholder) {
      placeholder.remove();
    }
  }

    replaceNoteAtPosition(targetBeat, noteName, duration, beatValue) {
    const newNotes = [];
    let currentBeat = 0;

    for (const note of this.notes) {
      const noteDuration = note.duration.replace('r', '');
      const noteBeatValue = this.noteMap[noteDuration];

      // Check if the target beat falls within this note.
      if (currentBeat <= targetBeat && currentBeat + noteBeatValue > targetBeat) {
        // Ensure that the inserted note fits within the duration of the replaced note.
        if ((targetBeat - currentBeat) + beatValue > noteBeatValue) {
          // If insertion would overflow the note, just carry over the original note.
          newNotes.push(note);
        } else {
          // Insert any rest before the new note.
          if (currentBeat < targetBeat) {
            const beforeBeatValue = targetBeat - currentBeat;
            const beforeDurations = this.splitDuration(beforeBeatValue);
            beforeDurations.forEach(d => {
              newNotes.push(new VexFlow.StaveNote({
                keys: ["b/4"],
                duration: d + "r"
              }));
            });
          }
          // Insert the new note.
          newNotes.push(new VexFlow.StaveNote({
            keys: [noteName],
            duration: duration
          }));
          // Insert any rest after the new note.
          const afterBeatValue = noteBeatValue - beatValue - (targetBeat - currentBeat);
          if (afterBeatValue > 0) {
            const afterDurations = this.splitDuration(afterBeatValue);
            afterDurations.forEach(d => {
              newNotes.push(new VexFlow.StaveNote({
                keys: ["b/4"],
                duration: d + "r"
              }));
            });
          }
        }
      } else {
        newNotes.push(note);
      }
      currentBeat += noteBeatValue;
    }

    this.notes = newNotes;
  }
  resetMeasure() {
    this.initializeWithRests();
    this.drawScore();
  }
}