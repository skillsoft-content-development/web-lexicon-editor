/**
 * Lexicon Editor Application
 * 
 * IMPORTANT: Before making any changes to this codebase, please review the AI_CONSTRAINTS.md file
 * in the root directory. It contains important guidelines and rules that must be followed
 * when modifying this application.
 */

import React, { useState, useEffect } from 'react';
import './index.css';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

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
  const [newLexiconLang, setNewLexiconLang] = useState('en-US');
  const [blobList, setBlobList] = useState<string[]>([]);
  const [loadingBlobs, setLoadingBlobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobErrorDetail, setBlobErrorDetail] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Backend API endpoints
  const BACKEND_URL = process.env.NODE_ENV === 'production' 
    ? ''  // In production, use relative path to Vercel API
    : 'http://localhost:4000';

  async function listBlobsFromBackend() {
    const apiKey = localStorage.getItem('azureStorageKey');
    const response = await fetch(`${BACKEND_URL}/api/blobs`, {
      headers: {
        'x-api-key': apiKey || ''
      }
    });
    if (response.status === 401) throw new Error('API key not set');
    if (!response.ok) throw new Error('Failed to list blobs');
    return await response.json();
  }

  async function downloadBlobFromBackend(blobName: string) {
    const apiKey = localStorage.getItem('azureStorageKey');
    const response = await fetch(`${BACKEND_URL}/api/blob/${encodeURIComponent(blobName)}`, {
      headers: {
        'x-api-key': apiKey || ''
      }
    });
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

      const apiKey = localStorage.getItem('azureStorageKey');
      // Send the XML string to the backend
      const response = await fetch(`${BACKEND_URL}/api/blob/${encodeURIComponent(blobName)}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/xml',
          'Accept': 'application/json',
          'x-api-key': apiKey || ''
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

  // useEffect for document title (always at top level)
  useEffect(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      document.title = '(local) Skillsoft Lexicon Editor';
    } else {
      document.title = 'Skillsoft Lexicon Editor';
    }
  }, []);

  // useEffect for API key check and blob list
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadBlobs = async () => {
      if (!checkApiKey()) return;
      
      try {
        setLoadingBlobs(true);
        const blobs = await listBlobsFromBackend();
        if (mounted) {
          setBlobList(blobs);
          setError(null);
          setBlobErrorDetail(null);
          setIsInitialLoad(false);
        }
      } catch (e: any) {
        if (mounted) {
          console.error('Error loading blobs:', e);
          if (e.message === 'API key not set') {
            setShowKeyModal(true);
          } else if (retryCount < MAX_RETRIES) {
            // Retry after a delay
            timeoutId = setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, 1000 * (retryCount + 1)); // Exponential backoff
          } else {
            setError('Failed to load blobs. Please try again.');
            setBlobErrorDetail(e.message);
          }
        }
      } finally {
        if (mounted) {
          setLoadingBlobs(false);
        }
      }
    };

    loadBlobs();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [retryCount]); // Only depend on retryCount

  const handleOpenLexicon = async () => {
    if (!checkApiKey()) return;
    setShowFileModal(true);
    setError(null);
    setBlobErrorDetail(null);
    setRetryCount(0); // Reset retry count when manually opening
  };

  const handleSelectBlob = async (blobName: string) => {
    setLoadingBlobs(true);
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
    setLoadingBlobs(false);
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
      setError('No file loaded.');
      return;
    }
    setSaving(true);
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
          '@_xml:lang': newLexiconLang || 'en-US',
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
      setSavedEntries(entries);
    } catch (e: any) {
      console.error('Save error:', e);
      setError(e.message || 'Failed to save lexicon.');
    }
    setSaving(false);
  };

  const handleExportXML = () => {
    if (!currentFile) {
      setError('No file loaded.');
      return;
    }

    try {
      // Build XML from state using the same logic as save
      const builder = new XMLBuilder({ 
        ignoreAttributes: false,
        format: true,
        attributeNamePrefix: '@_',
        suppressBooleanAttributes: false,
        indentBy: '    ',
        processEntities: true,
        suppressEmptyNode: false
      });
      
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
          '@_xml:lang': newLexiconLang || 'en-US',
          lexeme: lexemeXml
        }
      };

      const xmlString = builder.build(xmlObj);
      
      // Create a blob and download link
      const blob = new Blob([xmlString], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFile;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      console.error('Export error:', e);
      setError(e.message || 'Failed to export lexicon.');
    }
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

    // Add spoof entry to blobList if not present
    setBlobList((prev) => prev.includes(finalName) ? prev : [finalName, ...prev]);
  };

  // Add the handleDuplicateLexicon function
  const handleDuplicateLexicon = () => {
    if (!currentFile) return;
    // Remove .xml if present for base name
    const baseName = currentFile.replace(/\.xml$/i, '');
    const newName = `duplicate-of-${baseName}.xml`;
    // Deep copy entries
    const duplicatedEntries = entries.map(entry => ({
      graphemes: [...entry.graphemes],
      alias: entry.alias,
      phoneme: entry.phoneme
    }));
    setEntries(duplicatedEntries);
    setSavedEntries([]); // Mark as unsaved
    setSelectedIndex(duplicatedEntries.length > 0 ? 0 : null);
    setCurrentFile(newName);
    setBlobList((prev) => prev.includes(newName) ? prev : [newName, ...prev]);
    setNewLexiconName(newName); // Pre-populate save dialog with this name
  };

  // Filtered entries based on search
  const filteredEntries = searchQuery.trim() === ''
    ? entries.map((entry, idx) => ({ entry, originalIndex: idx }))
    : entries
        .map((entry, idx) => ({ entry, originalIndex: idx }))
        .filter(({ entry }) => {
          const q = searchQuery.toLowerCase();
          return (
            entry.graphemes.some(g => g.toLowerCase().includes(q)) ||
            (entry.alias && entry.alias.toLowerCase().includes(q)) ||
            (entry.phoneme && entry.phoneme.toLowerCase().includes(q))
          );
        });

  // Shared style for all input-like elements
  const unifiedInputStyle = { height: '36px', minHeight: '36px', maxHeight: '36px', borderRadius: '0.5rem', padding: '0 1rem', fontSize: '0.875rem', lineHeight: '1.5' };
  const unifiedButtonStyle = { minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px' };
  const entryBoxStyle = { ...unifiedInputStyle, background: 'white', border: '1px solid #e5e7eb', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', boxSizing: 'border-box', fontWeight: 400 };

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
                onClick={async () => {
                  setValidatingKey(true);
                  setKeyError(null);
                  try {
                    await setApiKeyOnBackend(keyInput.trim());
                    localStorage.setItem('azureStorageKey', keyInput.trim());
                    setShowKeyModal(false);
                    setKeyInput('');
                    setLoadingBlobs(true);
                    const blobs = await listBlobsFromBackend();
                    setBlobList(blobs);
                    setLoadingBlobs(false);
                  } catch (e: any) {
                    setKeyError('Failed to set API key.');
                    setLoadingBlobs(false);
                  }
                  setValidatingKey(false);
                }}
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-8">
      <div className={`max-w-[900px] mx-auto bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col ${!currentFile ? 'h-[664px]' : ''}`}>
        {/* Header Section */}
        <div className="relative h-[120px] flex items-center justify-between px-6" style={{height: '120px', paddingLeft: '24px', paddingRight: '24px'}}>
          <div className="flex items-center h-full">
            <img
              src={process.env.PUBLIC_URL + '/images/4.jpg'}
              alt="Skillsoft Lexicon Editor header"
              className="absolute inset-0 w-full h-full object-cover rounded-t-xl"
              style={{height: '120px', width: '100%', objectFit: 'cover', transform: 'scaleX(-1)'}}
              draggable="false"
            />
            <div className="absolute inset-0 rounded-t-xl" style={{background: 'linear-gradient(to right, rgba(17,24,39,0.85) 0%, rgba(17,24,39,0.0) 100%)'}} />
            <div className="relative h-full flex items-center">
              <div className="text-white">
                <h1 style={{fontSize: '30px', fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.1}}>Skillsoft Lexicon Editor</h1>
                <p style={{fontSize: '14px', color: '#e5e7eb', marginTop: 4, marginBottom: 0, lineHeight: 1.2}}>Edit and manage your lexicon entries</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar Ribbon */}
        <div className="flex flex-col w-full px-0 py-0.5 border-b border-gray-200 bg-white sticky top-0 z-10">
          {/* Button Row + File Info Row */}
          <div className="flex items-center w-full">
            {/* Left group: Open, Save, New, Duplicate */}
            <div className="flex items-center gap-4 ml-6">
              <div className="flex flex-col items-center">
                <button
                  onClick={handleOpenLexicon}
                  className="w-9 h-9 flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                  style={{ minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3.172a2 2 0 011.414.586l1.828 1.828A2 2 0 0012.828 8H19a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                </button>
                <span className="w-10 text-[10px] leading-tight text-center mt-0.5 mb-1 text-gray-600">Open</span>
              </div>
              <div className="flex flex-col items-center">
                <button
                  onClick={handleSaveLexicon}
                  disabled={saving || !hasUnsavedChanges}
                  className="w-9 h-9 flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </button>
                <span className="w-10 text-[10px] leading-tight text-center mt-0.5 mb-1 text-gray-600">Save</span>
              </div>
              <div className="flex flex-col items-center">
                <button
                  onClick={handleExportXML}
                  disabled={!currentFile}
                  className="w-9 h-9 flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <span className="w-10 text-[10px] leading-tight text-center mt-0.5 mb-1 text-gray-600">Export</span>
              </div>
              <div className="h-8 w-px bg-gray-300 mx-2" style={{alignSelf: 'center'}} />
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setShowNewLexiconModal(true)}
                  className="w-9 h-9 flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                  style={{ minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
                <span className="w-10 text-[10px] leading-tight text-center mt-0.5 mb-1 text-gray-600">New</span>
              </div>
              <div className="flex flex-col items-center">
                <button
                  onClick={handleDuplicateLexicon}
                  disabled={!currentFile}
                  className="w-9 h-9 flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none" /><rect x="3" y="3" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
                </button>
                <span className="w-10 text-[10px] leading-tight text-center mt-0.5 mb-1 text-gray-600">Duplicate</span>
              </div>
            </div>
            {/* Divider aligned with main content split */}
            {currentFile && (
              <div className="flex items-center ml-auto mr-6 h-full">
                <span className="text-xs text-gray-700 font-mono flex items-center h-11" style={{fontSize: '1rem', height: '44px', lineHeight: '44px', padding: 0}}>
                </span>
              </div>
            )}
            {/* Reset API Key Button */}
            <div className="flex items-center ml-auto mr-6">
              <button
                onClick={async () => {
                  await resetApiKeyOnBackend();
                  localStorage.removeItem('azureStorageKey');
                  setShowKeyModal(true);
                  setKeyInput('');
                  setBlobList([]);
                  setCurrentFile('');
                  setEntries([]);
                  setSelectedIndex(null);
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
                style={{fontFamily: 'inherit'}}>
                <span className="inline-block align-middle" style={{fontSize: '14px', lineHeight: 1, marginRight: '2px'}}>&#9881;</span>
                Reset API Key
              </button>
            </div>
          </div>
        </div>

        {/* Language Banner */}
        {currentFile && (
          <div className="w-full bg-gradient-to-r from-red-400 to-red-500 py-1.5 px-6">
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-sm">
                {currentFile}
              </span>
              <span className="text-white font-mono text-sm">|</span>
              <span className="text-white font-mono text-sm">
                {newLexiconLang === 'en-US' ? 'English (United States)' : 
                 newLexiconLang === 'en-GB' ? 'English (United Kingdom)' :
                 newLexiconLang === 'en-CA' ? 'English (Canada)' :
                 newLexiconLang === 'en-AU' ? 'English (Australia)' :
                 newLexiconLang === 'en-NZ' ? 'English (New Zealand)' :
                 newLexiconLang === 'en-IN' ? 'English (India)' :
                 newLexiconLang === 'en-IE' ? 'English (Ireland)' :
                 newLexiconLang === 'zh-CN' ? 'Chinese (Mandarin, Simplified)' :
                 newLexiconLang === 'fr-CA' ? 'French (Canada)' :
                 newLexiconLang === 'fr-FR' ? 'French (France)' :
                 newLexiconLang === 'de-DE' ? 'German (Germany)' :
                 newLexiconLang === 'ja-JP' ? 'Japanese (Japan)' :
                 newLexiconLang === 'pt-BR' ? 'Portuguese (Brazil)' :
                 newLexiconLang === 'es-MX' ? 'Spanish (Mexico)' :
                 newLexiconLang === 'es-ES' ? 'Spanish (Spain)' :
                 newLexiconLang === 'nl-NL' ? 'Dutch (Netherlands)' :
                 newLexiconLang === 'it-IT' ? 'Italian (Italy)' :
                 newLexiconLang === 'ko-KR' ? 'Korean (Korea)' :
                 newLexiconLang === 'id-ID' ? 'Indonesian (Indonesia)' :
                 newLexiconLang}
              </span>
            </div>
          </div>
        )}

        <div className="px-6 py-3 space-y-4 flex-1 flex flex-col">
          {/* Main Grid Layout */}
          <div className="md:grid md:grid-cols-2 gap-4 mt-1 flex-1">
            {/* Sidebar */}
            <aside className="flex flex-col h-full">
              <div className={`flex-1 rounded-lg bg-gray-50 border border-gray-200 min-h-[220px] p-0 relative ${entries.length > 0 ? 'overflow-y-auto' : ''}`} style={{display: 'flex', flexDirection: 'column'}}>
                <div className="mb-2 flex justify-end items-center p-4" style={{minHeight: '56px'}}>
                  {currentFile && (
                    <>
                      <div className="flex gap-2">
                        <button
                          onClick={handleNewEntry}
                          disabled={!currentFile}
                          className="flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-gray-500 focus:outline-none border border-gray-300 disabled:opacity-70 disabled:cursor-not-allowed"
                          style={unifiedButtonStyle}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                        <button
                          onClick={handleDeleteEntry}
                          disabled={!currentFile || selectedIndex === null}
                          className="flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 bg-red-200 text-red-700 hover:bg-red-300 focus:ring-2 focus:ring-red-500 focus:outline-none border border-red-200 disabled:opacity-70 disabled:cursor-not-allowed"
                          style={unifiedButtonStyle}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22" /></svg>
                        </button>
                      </div>
                      {/* Collapsible Search Bar */}
                      <div className="ml-auto flex items-center" style={{transition: 'width 0.2s'}}>
                        <div className="flex items-center" style={{height: '36px'}}>
                          {searchExpanded && (
                            <div className="flex items-center bg-gray-200 rounded-lg px-2 mr-2" style={{height: '36px', maxWidth: 260, transition: 'max-width 0.2s'}}>
                              {searchQuery && (
                                <button
                                  onClick={() => setSearchQuery('')}
                                  className="mr-1 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 focus:outline-none"
                                  style={{width: '32px', height: '32px'}}
                                  tabIndex={-1}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                autoFocus
                                placeholder="Search..."
                                className="bg-transparent outline-none border-none text-gray-900 flex-1 px-1 min-w-0"
                                style={{fontSize: '15px', height: '32px'}}
                              />
                            </div>
                          )}
                          <button
                            onClick={() => setSearchExpanded(v => !v)}
                            className={`flex items-center justify-center rounded-lg border border-gray-300 focus:outline-none ml-2 ${searchExpanded ? 'bg-gray-700 text-white hover:bg-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                            style={{width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px', transition: 'background 0.2s'}}
                            aria-label="Toggle search"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 20 20" stroke="currentColor"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" fill="none"/><line x1="15" y1="15" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {filteredEntries.length === 0 ? (
                  <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
                    <span className="text-gray-400 text-sm text-center">No entries</span>
                  </div>
                ) : (
                  filteredEntries.map(({ entry, originalIndex }) => (
                    <div
                      key={originalIndex}
                      onClick={() => setSelectedIndex(originalIndex)}
                      className={`cursor-pointer text-base transition-all duration-200 border-y mb-0 last:mb-0 px-4 py-2"
                         style={{...entryBoxStyle, ...(selectedIndex === originalIndex ? {background: '#374151', color: 'white', border: '#374151 1px solid'} : {background: 'white', color: '#1f2937', border: '#e5e7eb 1px solid'})}}
                          ${selectedIndex === originalIndex
                            ? 'border-gray-700'
                            : 'hover:bg-gray-100 border-gray-200'
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
              <div className="bg-gray-50 rounded-lg p-4 shadow-inner flex-1 flex flex-col min-h-[220px]">
                {selectedIndex !== null ? (
                  <div className="space-y-4">
                    <div className="form-group">
                      <label className="form-label group relative inline-flex items-center gap-1">
                        Graphemes
                        {activeTooltip === 'graphemes' && (
                          <div className="absolute left-0 -bottom-2 translate-y-[100%] bg-gray-800 text-white text-sm rounded-lg px-3 py-2 w-64 shadow-lg z-10">
                            <div className="flex justify-between items-start gap-2">
                              <span>The written form of a word or phrase. For example, "hello" is a grapheme.</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTooltip(null);
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTooltip(activeTooltip === 'graphemes' ? null : 'graphemes');
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors flex items-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </label>
                      <div style={{marginBottom: '0.5rem'}} />
                      {entries[selectedIndex].graphemes.map((grapheme, gIdx) => (
                        <div key={gIdx} className="flex gap-2 mb-2 items-center" style={{ alignItems: 'center', height: '36px' }}>
                          <input
                            type="text"
                            value={grapheme}
                            onChange={(e) => handleGraphemeChange(gIdx, e.target.value)}
                            className="input flex-grow"
                            style={unifiedInputStyle}
                          />
                          <div style={{ width: '36px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '36px' }}>
                            {gIdx > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveGrapheme(gIdx);
                                }}
                                className="flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 bg-red-200 text-red-700 hover:bg-red-300 focus:ring-2 focus:ring-red-500 focus:outline-none border border-red-200"
                                style={unifiedButtonStyle}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={handleAddGrapheme}
                        className="flex items-center justify-center text-base rounded-lg font-medium transition-all duration-200 text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-gray-500 focus:outline-none border border-gray-300 mt-2"
                        style={unifiedButtonStyle}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                    <div className="form-group">
                      <label className="form-label group relative inline-flex items-center gap-1">
                        Alias
                        {activeTooltip === 'alias' && (
                          <div className="absolute left-0 -bottom-2 translate-y-[100%] bg-gray-800 text-white text-sm rounded-lg px-3 py-2 w-64 shadow-lg z-10">
                            <div className="flex justify-between items-start gap-2">
                              <span>A shorter or alternative form of the word. For example, "USA" could be an alias for "United States of America", or "Dr." for "Doctor".</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTooltip(null);
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTooltip(activeTooltip === 'alias' ? null : 'alias');
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={entries[selectedIndex].alias || ''}
                          onChange={(e) => handleAliasChange(e.target.value)}
                          className="input"
                          style={unifiedInputStyle}
                        />
                        <div style={{ width: '36px', flexShrink: 0 }} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label group relative inline-flex items-center gap-1">
                        Phoneme
                        {activeTooltip === 'phoneme' && (
                          <div className="absolute left-0 -bottom-2 translate-y-[100%] bg-gray-800 text-white text-sm rounded-lg px-3 py-2 w-64 shadow-lg z-10">
                            <div className="flex justify-between items-start gap-2">
                              <span>The pronunciation of the word using IPA symbols. For example, "hello" would be /həˈloʊ/, "cat" would be /kæt/, and "night" would be /naɪt/.</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTooltip(null);
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTooltip(activeTooltip === 'phoneme' ? null : 'phoneme');
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={entries[selectedIndex].phoneme || ''}
                          onChange={(e) => handlePhonemeChange(e.target.value)}
                          className="input"
                          style={unifiedInputStyle}
                        />
                        <div style={{ width: '36px', flexShrink: 0 }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm text-center">
                    Select an entry or create a new one to begin editing
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>

        {/* File Selection Modal */}
        {showFileModal && (
          <>
            <div className="modal-backdrop" onClick={() => setShowFileModal(false)} />
            <div className="modal-container">
              <div className="modal-content">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Select a Lexicon File</h2>
                  <button
                    onClick={() => setShowFileModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {loadingBlobs ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading lexicons...</p>
                  </div>
                ) : error ? (
                  <div className="text-red-500 mb-4">
                    {error}
                    {blobErrorDetail && (
                      <div className="text-sm mt-2">{blobErrorDetail}</div>
                    )}
                    <button
                      onClick={() => setRetryCount(0)}
                      className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                    >
                      Retry
                    </button>
                  </div>
                ) : blobList.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No lexicons found. Create a new one to get started.
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
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Create New Lexicon</h2>
                  <button
                    onClick={() => setShowNewLexiconModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
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
                  <div>
                    <label htmlFor="new-lexicon-lang" className="block text-sm font-medium text-gray-700 mb-1">
                      Language
                    </label>
                    <select
                      id="new-lexicon-lang"
                      value={newLexiconLang}
                      onChange={e => setNewLexiconLang(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-white text-base shadow-sm"
                    >
                      <option value="" className="text-gray-500" disabled>Select a language</option>
                      <option value="en-US" className="text-gray-800">English (United States)</option>
                      <option value="en-GB" className="text-gray-800">English (United Kingdom)</option>
                      <option value="en-CA" className="text-gray-800">English (Canada)</option>
                      <option value="en-AU" className="text-gray-800">English (Australia)</option>
                      <option value="en-NZ" className="text-gray-800">English (New Zealand)</option>
                      <option value="en-IN" className="text-gray-800">English (India)</option>
                      <option value="en-IE" className="text-gray-800">English (Ireland)</option>
                      <option value="zh-CN" className="text-gray-800">Chinese (Mandarin, Simplified)</option>
                      <option value="fr-CA" className="text-gray-800">French (Canada)</option>
                      <option value="fr-FR" className="text-gray-800">French (France)</option>
                      <option value="de-DE" className="text-gray-800">German (Germany)</option>
                      <option value="ja-JP" className="text-gray-800">Japanese (Japan)</option>
                      <option value="pt-BR" className="text-gray-800">Portuguese (Brazil)</option>
                      <option value="es-MX" className="text-gray-800">Spanish (Mexico)</option>
                      <option value="es-ES" className="text-gray-800">Spanish (Spain)</option>
                      <option value="nl-NL" className="text-gray-800">Dutch (Netherlands)</option>
                      <option value="it-IT" className="text-gray-800">Italian (Italy)</option>
                      <option value="ko-KR" className="text-gray-800">Korean (Korea)</option>
                      <option value="id-ID" className="text-gray-800">Indonesian (Indonesia)</option>
                      <option value="ms-MY" className="text-gray-800">Malay (Malaysia)</option>
                      <option value="zh-HK" className="text-gray-800">Chinese (Cantonese, Traditional)</option>
                      <option value="cs-CZ" className="text-gray-800">Czech (Czech)</option>
                      <option value="da-DK" className="text-gray-800">Danish (Denmark)</option>
                      <option value="fi-FI" className="text-gray-800">Finnish (Finland)</option>
                      <option value="el-GR" className="text-gray-800">Greek (Greece)</option>
                      <option value="hi-IN" className="text-gray-800">Hindi (India)</option>
                      <option value="hu-HU" className="text-gray-800">Hungarian (Hungary)</option>
                      <option value="nb-NO" className="text-gray-800">Norwegian (Norway)</option>
                      <option value="pl-PL" className="text-gray-800">Polish (Poland)</option>
                      <option value="ro-RO" className="text-gray-800">Romanian (Romania)</option>
                      <option value="ru-RU" className="text-gray-800">Russian (Russia)</option>
                      <option value="sv-SE" className="text-gray-800">Swedish (Sweden)</option>
                      <option value="th-TH" className="text-gray-800">Thai (Thailand)</option>
                      <option value="tr-TR" className="text-gray-800">Turkish (Turkey)</option>
                      <option value="vi-VN" className="text-gray-800">Vietnamese (Vietnam)</option>
                      <option value="bg-BG" className="text-gray-800">Bulgarian (Bulgaria)</option>
                      <option value="ar-EG" className="text-gray-800">Arabic (Egypt)</option>
                    </select>
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
