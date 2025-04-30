import React from 'react';

function App() {
  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Lexicon Editor</h1>
        <div className="form-group">
          <label className="label">
            Select Lexicon File
          </label>
          <select
            className="select"
            disabled
          >
            <option value="">Select a file...</option>
            <option value="sample.xml">sample.xml</option>
          </select>
        </div>

        <div className="entry">
          <div className="grid">
            <div className="form-group">
              <label className="label">
                Word
              </label>
              <input
                type="text"
                className="input"
                value="example"
                readOnly
              />
            </div>
            <div className="form-group">
              <label className="label">
                Pronunciation
              </label>
              <input
                type="text"
                className="input"
                value="ɪɡˈzæmpəl"
                readOnly
              />
            </div>
          </div>
          <div className="form-group">
            <label className="label">
              Attributes
            </label>
            <div className="grid">
              <input
                type="text"
                className="input"
                value="partOfSpeech"
                readOnly
              />
              <input
                type="text"
                className="input"
                value="noun"
                readOnly
              />
            </div>
          </div>
        </div>

        <button
          className="button"
          disabled
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

export default App;
