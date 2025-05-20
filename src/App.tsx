import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { uploadBlob } from './services/blobStorage';

function deepEqual(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface LexiconEntry {
  graphemes: string[];
  alias?: string;
  phoneme?: string;
}

function App() {
  const [entries, setEntries] = useState<LexiconEntry[]>([]);
  const [savedEntries, setSavedEntries] = useState<LexiconEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [showFileModal, setShowFileModal] = useState(false);
  const [showNewLexiconModal, setShowNewLexiconModal] = useState(false);
  const [newLexiconName, setNewLexiconName] = useState('');
  const [newLexiconError, setNewLexiconError] = useState<string | null>(null);
  const [blobList, setBlobList] = useState<string[]>([]);
  const [loadingBlobs, setLoadingBlobs] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobErrorDetail, setBlobErrorDetail] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Backend API endpoints
  const BACKEND_URL = 'http://localhost:4000';

  async function listBlobsFromBackend() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/blobs`);
      if (response.status === 401) throw new Error('API key not set');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list blobs: ${response.status} ${response.statusText} - ${errorText}`);
      }
      return await response.json();
    } catch (e) {
      console.error('Error listing blobs:', e);
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        throw new Error('Cannot connect to backend server. Please ensure it is running at ' + BACKEND_URL);
      }
      throw e;
    }
  }

  async function downloadBlobFromBackend(blobName: string) {
    const response = await fetch(`${BACKEND_URL}/api/blob/${encodeURIComponent(blobName)}`);
    if (response.status === 401) throw new Error('API key not set');
    if (!response.ok) throw new Error('Failed to download blob');
    return await response.text();
  }

  async function setApiKeyOnBackend(key: string) {
    const response = await fetch(`${BACKEND_URL}/api/set-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    if (!response.ok) throw new Error('Failed to set API key');
    return await response.json();
  }

  async function resetApiKeyOnBackend() {
    await fetch(`${BACKEND_URL}/api/reset-key`, { method: 'POST' });
  }

  async function saveLexicon(blobName: string, xmlString: string) {
    try {
      // Ensure we have a valid string
      if (!xmlString || typeof xmlString !== 'string') {
        throw new Error('Invalid XML string');
      }

      console.log('Saving lexicon:', {
        blobName,
        xmlLength: xmlString.length,
        xmlPreview: xmlString.substring(0, 100) + '...'
      });

      // Send the XML string to the backend
      const response = await fetch(`${BACKEND_URL}/api/blob/${encodeURIComponent(blobName)}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/xml',
          'Accept': 'application/json'
        },
        body: xmlString
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        throw new Error(`Failed to save lexicon: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Save successful:', result);
      return result;
    } catch (e) {
      console.error('Save error details:', e);
      throw e;
    }
  }

  // Check for API key on mount and before operations
  const checkApiKey = () => {
    const apiKey = localStorage.getItem('azureStorageKey');
    if (!apiKey) {
      setShowKeyModal(true);
      return false;
    }
    return true;
  };

  // On mount, check if backend has API key by trying to list blobs
  useEffect(() => {
    (async () => {
      try {
        if (!checkApiKey()) return;
        // Try to fetch blob list on mount if API key is valid
        setLoadingBlobs(true);
        const blobs = await listBlobsFromBackend();
        setBlobList(blobs);
        setLoadingBlobs(false);
      } catch (e: any) {
        setLoadingBlobs(false);
        if (e.message === 'API key not set') {
          setShowKeyModal(true);
        }
      }
    })();
  }, []);

  // After setting a valid key, fetch blob list and close modal
  const handleSetKey = async () => {
    setValidatingKey(true);
    setKeyError(null);
    try {
      await setApiKeyOnBackend(keyInput.trim());
      localStorage.setItem('azureStorageKey', keyInput.trim());
      setShowKeyModal(false);
      setKeyInput('');
      // Fetch blob list after setting key
      setLoadingBlobs(true);
      const blobs = await listBlobsFromBackend();
      setBlobList(blobs);
      setLoadingBlobs(false);
    } catch (e: any) {
      setKeyError('Failed to set API key.');
      setLoadingBlobs(false);
    }
    setValidatingKey(false);
  };

  // After resetting the key, show modal and clear blob list
  const handleResetKey = async () => {
    await resetApiKeyOnBackend();
    localStorage.removeItem('azureStorageKey');
    setShowKeyModal(true);
    setKeyInput('');
    setBlobList([]);
    setCurrentFile('');
    setEntries([]);
    setSelectedIndex(null);
  };

  const handleOpenLexicon = async () => {
    if (!checkApiKey()) return;
    setShowFileModal(true);
    setLoadingBlobs(true);
    setError(null);
    setBlobErrorDetail(null);
    try {
      const blobs = await listBlobsFromBackend();
      setBlobList(blobs);
    } catch (e: any) {
      setError('Failed to list blobs.');
      setBlobErrorDetail(e && e.message ? e.message : String(e));
    }
    setLoadingBlobs(false);
  };

  const handleSelectBlob = async (blobName: string) => {
    setLoadingFile(true);
    setError(null);
    try {
      const xmlString = await downloadBlobFromBackend(blobName);
      const parser = new XMLParser({ ignoreAttributes: false });
      const xml = parser.parse(xmlString);
      const ns = xml.lexicon['@_xmlns'] || xml.lexicon['@_xmlns:xsi'] || '';
      const lexemes = Array.isArray(xml.lexicon.lexeme)
        ? xml.lexicon.lexeme
        : xml.lexicon.lexeme ? [xml.lexicon.lexeme] : [];
      const parsedEntries = lexemes.map((lex: any) => ({
        graphemes: Array.isArray(lex.grapheme)
          ? lex.grapheme.map((g: any) => g) : lex.grapheme ? [lex.grapheme] : [],
        alias: lex.alias || '',
        phoneme: lex.phoneme || ''
      }));
      setEntries(parsedEntries);
      setSavedEntries(parsedEntries);
      setSelectedIndex(parsedEntries.length > 0 ? 0 : null);
      setCurrentFile(blobName);
      setShowFileModal(false);
    } catch (e) {
      setError('Failed to download or parse the file.');
    }
    setLoadingFile(false);
  };

  const handleNewEntry = () => {
    const newEntry: LexiconEntry = {
      graphemes: ['*** NEW ENTRY ***'],
      alias: '',
      phoneme: ''
    };
    setEntries([...entries, newEntry]);
    setSelectedIndex(entries.length);
  };

  const handleDeleteEntry = () => {
    if (selectedIndex !== null) {
      const newEntries = entries.filter((_, idx) => idx !== selectedIndex);
      setEntries(newEntries);
      setSelectedIndex(null);
    }
  };

  const handleGraphemeChange = (gIdx: number, value: string) => {
    if (selectedIndex === null) return;
    const updatedEntry = { ...entries[selectedIndex] };
    updatedEntry.graphemes = [...updatedEntry.graphemes];
    updatedEntry.graphemes[gIdx] = value;
    const newEntries = entries.map((entry, idx) => idx === selectedIndex ? updatedEntry : entry);
    setEntries(newEntries);
  };

  const handleAddGrapheme = () => {
    if (selectedIndex === null) return;
    const updatedEntry = { ...entries[selectedIndex] };
    updatedEntry.graphemes = [...updatedEntry.graphemes, ''];
    const newEntries = entries.map((entry, idx) => idx === selectedIndex ? updatedEntry : entry);
    setEntries(newEntries);
  };

  const handleRemoveGrapheme = (gIdx: number) => {
    if (selectedIndex === null) return;
    const updatedEntry = { ...entries[selectedIndex] };
    updatedEntry.graphemes = updatedEntry.graphemes.filter((_, idx) => idx !== gIdx);
    const newEntries = entries.map((entry, idx) => idx === selectedIndex ? updatedEntry : entry);
    setEntries(newEntries);
  };

  const handleAliasChange = (value: string) => {
    if (selectedIndex === null) return;
    const updatedEntry = { ...entries[selectedIndex], alias: value };
    const newEntries = entries.map((entry, idx) => idx === selectedIndex ? updatedEntry : entry);
    setEntries(newEntries);
  };

  const handlePhonemeChange = (value: string) => {
    if (selectedIndex === null) return;
    const updatedEntry = { ...entries[selectedIndex], phoneme: value };
    const newEntries = entries.map((entry, idx) => idx === selectedIndex ? updatedEntry : entry);
    setEntries(newEntries);
  };

  const handleSaveLexicon = async () => {
    if (!checkApiKey()) return;
    if (!currentFile) {
      setSaveError('No file loaded.');
      return;
    }
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      // Build XML from state
      const builder = new XMLBuilder({ 
        ignoreAttributes: false,
        format: true,
        attributeNamePrefix: '@_',
        suppressBooleanAttributes: false,
        indentBy: '    ',
        processEntities: true,
        suppressEmptyNode: false
      });
      
      // Create lexeme entries with direct text values
      const lexemeXml = entries.map(entry => {
        const lexeme: any = {
          grapheme: entry.graphemes
        };
        if (entry.alias) {
          lexeme.alias = entry.alias;
        }
        if (entry.phoneme) {
          lexeme.phoneme = entry.phoneme;
        }
        return lexeme;
      });

      // Create the XML object with proper structure
      const xmlObj = {
        '?xml': {
          '@_version': '1.0',
          '@_encoding': 'utf-8'
        },
        lexicon: {
          '@_version': '1.0',
          '@_xmlns': 'http://www.w3.org/2005/01/pronunciation-lexicon',
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          '@_xsi:schemaLocation': 'http://www.w3.org/2005/01/pronunciation-lexicon         http://www.w3.org/TR/2007/CR-pronunciation-lexicon-20071212/pls.xsd',
          '@_alphabet': 'ipa',
          '@_xml:lang': 'en-US',
          lexeme: lexemeXml
        }
      };

      console.log('XML Object before building:', JSON.stringify(xmlObj, null, 2));
      
      // Validate the XML object
      if (!xmlObj || !xmlObj.lexicon || !Array.isArray(xmlObj.lexicon.lexeme)) {
        throw new Error('Invalid XML object structure');
      }

      let xmlString;
      try {
        xmlString = builder.build(xmlObj);
        console.log('Generated XML:', xmlString);
      } catch (buildError: any) {
        console.error('XML Build Error:', buildError);
        throw new Error(`Failed to build XML: ${buildError.message}`);
      }
      
      if (!xmlString || xmlString.trim() === '') {
        throw new Error('Generated XML string is empty');
      }
      
      await saveLexicon(currentFile, xmlString);
      setSaveSuccess('Lexicon saved successfully!');
      setSavedEntries(entries);
    } catch (e: any) {
      console.error('Save error:', e);
      setSaveError(e.message || 'Failed to save lexicon.');
    }
    setSaving(false);
  };

  // Determine if there are unsaved changes
  const hasUnsavedChanges = !deepEqual(entries, savedEntries);

  // Handle lexicon select change
  const handleLexiconSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const blobName = e.target.value;
    if (blobName) handleSelectBlob(blobName);
  };

  const handleCreateNewLexicon = async () => {
    if (!newLexiconName.trim()) {
      setNewLexiconError('Please enter a lexicon name');
      return;
    }

    // Add .xml extension if not present
    let finalName = newLexiconName.trim();
    if (!finalName.toLowerCase().endsWith('.xml')) {
      finalName += '.xml';
    }

    // Validate the name format (only check for valid characters now since we handle the extension)
    if (!/^[a-zA-Z0-9-_]+\.xml$/.test(finalName)) {
      setNewLexiconError('Lexicon name must contain only letters, numbers, hyphens, and underscores');
      return;
    }

    setNewLexiconError(null);
    setShowNewLexiconModal(false);

    // Create a new lexicon with a master entry
    const newEntry: LexiconEntry = {
      graphemes: ['*** NEW ENTRY ***'],
      alias: '',
      phoneme: ''
    };

    // Clear any existing state and set up the new lexicon
    setEntries([newEntry]);
    setSavedEntries([]); // Empty saved entries to indicate unsaved state
    setSelectedIndex(0);
    setCurrentFile(finalName);
    setSaveSuccess(null);
    setSaveError(null);

    // Add spoof entry to blobList if not present
    setBlobList((prev) => prev.includes(finalName) ? prev : [finalName, ...prev]);
  };

  // Block main UI if API key modal is open
  if (showKeyModal) {
    return (
      <>
        <div className="modal-backdrop" />
        <div className="modal-container">
          <div className="modal-content">
            <h2 className="text-xl font-semibold mb-4">Enter Azure Storage API Key</h2>
            <div className="form-group">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="input"
                placeholder="Enter your API key"
              />
              {keyError && (
                <div className="form-error">{keyError}</div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSetKey}
                disabled={validatingKey}
                className="btn btn-primary"
              >
                {validatingKey ? 'Validating...' : 'Set Key'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8">
      <div className="max-w-[900px] mx-auto bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
        {/* Header Section */}
        <div className="relative h-[120px]">
          <img
            src={process.env.PUBLIC_URL + '/images/4.jpg'}
            alt="Skillsoft Lexicon Editor header"
            className="absolute inset-0 w-full h-full object-cover"
            draggable="false"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/70 to-transparent" />
          <div className="relative h-full px-6">
            <div className="flex justify-between items-center h-full">
              <div className="text-white">
                <h1 className="text-3xl font-bold tracking-tight">Skillsoft Lexicon Editor</h1>
                <p className="mt-1 text-sm text-gray-200">Edit and manage your lexicon entries</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Section */}
        <div className="px-6 py-6 space-y-5 flex-1 flex flex-col">
          {currentFile && (
            <div className="flex items-center justify-between pt-1 pb-0 mb-1">
              <div className="text-xs text-gray-500">
                Current file: <span className="font-mono">{currentFile}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveLexicon}
                  disabled={saving || !hasUnsavedChanges}
                  className="btn btn-primary px-4 py-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Lexicon'}
                </button>
                {saveSuccess && (
                  <span className="text-green-500 text-sm">{saveSuccess}</span>
                )}
                {saveError && (
                  <span className="text-red-500 text-sm">{saveError}</span>
                )}
              </div>
            </div>
          )}

          {/* Main Grid Layout */}
          <div className="md:grid md:grid-cols-2 gap-6 mt-2 flex-1">
            {/* Sidebar */}
            <aside className="flex flex-col h-full">
              {/* Lexicon File Dropdown */}
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col">
                  <label htmlFor="lexicon-select" className="text-sm font-medium text-gray-700 mb-1">Lexicon:</label>
                  <div className="flex gap-2 items-center">
                    <select
                      id="lexicon-select"
                      className="flex-grow h-11 appearance-none rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-white text-base shadow-sm px-3"
                      value={currentFile || ''}
                      onChange={handleLexiconSelect}
                      disabled={loadingBlobs}
                    >
                      <option value="" disabled>Select a Lexicon...</option>
                      {blobList.map((blob) => (
                        <option key={blob} value={blob}>{blob}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowNewLexiconModal(true)}
                      className="w-[60px] h-11 flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 bg-gray-700 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                    >
                      New
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleNewEntry}
                  disabled={!currentFile}
                  className="w-full px-4 py-2 text-base rounded-lg font-medium transition-all duration-200 bg-gray-700 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  New Entry
                </button>
                <button
                  onClick={handleDeleteEntry}
                  disabled={!currentFile || selectedIndex === null}
                  className="w-full px-4 py-2 text-base rounded-lg font-medium transition-all duration-200 bg-red-400 text-white hover:bg-red-500 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  Delete Entry
                </button>
              </div>
              <div className="overflow-y-auto flex-1 rounded-lg bg-gray-50 border border-gray-200 min-h-[200px]">
                {entries.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
                    No entries
                  </div>
                ) : (
                  entries.map((entry, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedIndex(index)}
                      className={`p-2 rounded-lg cursor-pointer mb-1 text-sm transition-all duration-200 border
                        ${selectedIndex === index
                          ? 'bg-gray-700 text-white border-gray-700'
                          : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-800'
                        }`}
                    >
                      {entry.graphemes[0]}
                    </div>
                  ))
                )}
              </div>
            </aside>

            {/* Main Panel */}
            <main className="flex flex-col h-full">
              <div className="bg-gray-50 rounded-lg p-6 shadow-inner flex-1 flex flex-col min-h-[200px]">
                {selectedIndex !== null ? (
                  <div className="space-y-5">
                    <div className="form-group">
                      <label className="form-label">Graphemes</label>
                      {entries[selectedIndex].graphemes.map((grapheme, gIdx) => (
                        <div key={gIdx} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={grapheme}
                            onChange={(e) => handleGraphemeChange(gIdx, e.target.value)}
                            className="input flex-grow text-base"
                          />
                          <button
                            onClick={() => handleRemoveGrapheme(gIdx)}
                            className="btn btn-danger px-3"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={handleAddGrapheme}
                        className="btn btn-secondary mt-2"
                      >
                        Add Grapheme
                      </button>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Alias</label>
                      <input
                        type="text"
                        value={entries[selectedIndex].alias || ''}
                        onChange={(e) => handleAliasChange(e.target.value)}
                        className="input text-base"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Phoneme</label>
                      <input
                        type="text"
                        value={entries[selectedIndex].phoneme || ''}
                        onChange={(e) => handlePhonemeChange(e.target.value)}
                        className="input text-base"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm text-center">
                    Select an entry or create a new one to begin editing
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>

        {/* Reset API Key at the bottom */}
        <div className="flex justify-end items-center px-6 py-4 border-t border-gray-100 bg-white">
          <button
            onClick={handleResetKey}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
          >
            <span className="inline-block align-middle" style={{fontSize: '18px', lineHeight: 1}}>&#9881;</span>
            Reset API Key
          </button>
        </div>

        {/* File Selection Modal */}
        {showFileModal && (
          <>
            <div className="modal-backdrop" onClick={() => setShowFileModal(false)} />
            <div className="modal-container">
              <div className="modal-content">
                <h2 className="text-xl font-semibold mb-4">Select a Lexicon File</h2>
                {loadingBlobs ? (
                  <div className="text-center py-4">Loading...</div>
                ) : error ? (
                  <div className="text-red-500 mb-4">
                    {error}
                    {blobErrorDetail && (
                      <div className="text-sm mt-2">{blobErrorDetail}</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blobList.map((blob) => (
                      <button
                        key={blob}
                        onClick={() => handleSelectBlob(blob)}
                        className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {blob}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* New Lexicon Modal */}
        {showNewLexiconModal && (
          <>
            <div className="modal-backdrop" onClick={() => setShowNewLexiconModal(false)} />
            <div className="modal-container">
              <div className="modal-content">
                <h2 className="text-xl font-semibold mb-4">Create New Lexicon</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="new-lexicon-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Lexicon Name
                    </label>
                    <input
                      type="text"
                      id="new-lexicon-name"
                      value={newLexiconName}
                      onChange={(e) => setNewLexiconName(e.target.value)}
                      placeholder="Enter lexicon name (e.g., my-lexicon.xml)"
                      className="w-full p-2.5 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-white text-base shadow-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Lexicon names must use only letters, numbers, hyphens, and underscores. The <code>.xml</code> extension will be added automatically if omitted.
                    </p>
                    {newLexiconError && (
                      <p className="mt-1 text-sm text-red-500">{newLexiconError}</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowNewLexiconModal(false)}
                      className="px-4 py-2 text-base rounded-lg font-medium transition-all duration-200 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateNewLexicon}
                      className="px-4 py-2 text-base rounded-lg font-medium transition-all duration-200 bg-gray-700 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
