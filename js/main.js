import { SheetMusicEditor } from './SheetMusicEditor.js';

// This file serves as the entry point for the application. It loads the VexFlow library, initializes the SheetMusicEditor class, and sets up event listeners for user interactions.

VexFlow.loadFonts('Bravura', 'Academico').then(() => {
  VexFlow.setFonts('Bravura', 'Academico');
  
  // Initialize the editor
  const editor = new SheetMusicEditor();
  editor.init();
});