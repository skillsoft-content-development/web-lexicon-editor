# Lexicon Editor

A modern web application for creating, editing, importing, exporting, and managing pronunciation lexicons (PLS XML files).

---

## Project Overview

Lexicon Editor provides a user-friendly interface for managing pronunciation lexicons. It supports Azure Blob Storage integration, robust file operations, and a workflow designed for both power users and accessibility.

---

## Key Features

- **Modern, Responsive UI**: Built with React and Tailwind CSS.
- **Azure Blob Storage Integration**: Securely upload/download lexicons.
- **Open, New, Duplicate, Import, Export, Save, Save As**: Full file management.
- **Search**: Filter entries by grapheme, alias, or phoneme.
- **Save Prompts**: Prevents data loss with robust unsaved changes prompts.
- **Import/Export**: Handles PLS XML files, with error handling for malformed files.
- **Accessibility**: Keyboard navigation, Escape closes modals, accessible labels.
- **Toasts & Modals**: Consistent feedback for all major actions.
- **Edge Case Handling**: Prevents saving empty lexicons, warns on overwrites, etc.

---

### Prerequisites
- Node.js (v14 or later)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd lexicon-editor
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

### Running the Application
- **Frontend**: Start the development server:
  ```bash
  npm start
  ```
- **Backend**: Start the backend service:
  ```bash
  cd backend
  npm start
  ```

---

## Usage & Workflow

- **API Key**: On first launch, enter your Azure Storage API key.
- **Open**: Load an existing lexicon from blob storage.
- **New**: Create a new lexicon (not saved until you click Save).
- **Duplicate**: Make a copy of the current lexicon for editing.
- **Import**: Upload a PLS XML file from your computer.
- **Export**: Download the current lexicon as XML.
- **Save/Save As**: Save changes to blob storage, with overwrite protection.
- **Search**: Filter entries by grapheme, alias, or phoneme.
- **Editing**: Add, edit, or delete entries. All changes are local until saved.

---

## Accessibility & UX
- **Keyboard Navigation**: Tab through all controls and modals.
- **Escape Key**: Closes any open modal.
- **Accessible Labels**: All icon buttons have aria-labels.
- **Toasts**: Success/error feedback for all major actions.

---

## Testing Workflow
- API key modal and error handling
- File operations: open, new, duplicate, import, export, save, save as
- Entry editing: add, edit, delete, search
- Save prompts and overwrite protection
- Accessibility: keyboard, Escape, aria-labels
- Error handling: malformed XML, empty lexicon, duplicate names

---

## Troubleshooting
- **API Key Issues**: Ensure your Azure Storage key is correct and has permissions.
- **Export/Import Errors**: Check XML file format and encoding.
- **UI Not Updating**: Try a hard refresh or clear cache.