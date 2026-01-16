// ============================================
// Main App Component
// ============================================

import React, { useEffect } from 'react';
import { MoleculeViewer } from './components/MoleculeViewer';
import './styles/App.css';

const App: React.FC = () => {
  // Get PDB path from URL parameters if provided
  const urlParams = new URLSearchParams(window.location.search);
  const pdbPath = urlParams.get('pdb') || undefined;

  // Load 3Dmol.js library from CDN
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://3dmol.org/build/3Dmol-min.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="app">
      <MoleculeViewer pdbPath={pdbPath} />
    </div>
  );
};

export default App;
