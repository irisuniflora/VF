// ============================================
// Main Molecule Viewer Component
// ============================================

import React, { useRef, useEffect } from 'react';
import { use3DMol } from '../hooks/use3DMol';
import { useViewerState } from '../hooks/useViewerState';
import { parsePDBSequence } from '../utils/pdbParser';
import { readPDBFile, loadFromRCSB } from '../utils/api';
import { SequencePanel } from './SequencePanel';
import { ViewerControls } from './ViewerControls';
import { RegionManager } from './RegionManager';
import { PDBInput } from './PDBInput';
import { useViewerStyling } from '../hooks/useViewerStyling';
import { useResidueSelection } from '../hooks/useResidueSelection';
import styles from '../styles/MoleculeViewer.module.css';

export interface MoleculeViewerProps {
  pdbPath?: string;
}

export const MoleculeViewer: React.FC<MoleculeViewerProps> = ({ pdbPath }) => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const { viewer, isReady } = use3DMol(viewerContainerRef);
  const { state, dispatch } = useViewerState();

  // Custom hooks for viewer functionality
  const { applyViewerStyle } = useViewerStyling(viewer, state);
  const { toggleResidueSelection } = useResidueSelection(
    viewer,
    state,
    dispatch,
    applyViewerStyle
  );

  // Update viewer in state when ready
  useEffect(() => {
    if (viewer && isReady) {
      dispatch({ type: 'SET_VIEWER', payload: viewer });
    }
  }, [viewer, isReady, dispatch]);

  // Load PDB file if path provided
  useEffect(() => {
    if (pdbPath && viewer && isReady) {
      loadPDBFile(pdbPath);
    }
  }, [pdbPath, viewer, isReady]);

  // Load PDB from file path
  const loadPDBFile = async (path: string) => {
    try {
      const result = await readPDBFile(path);
      if (result.success && result.content) {
        displayStructure(result.content);
      } else {
        console.error('Failed to read PDB file:', result.error);
      }
    } catch (error) {
      console.error('Failed to load PDB:', error);
    }
  };

  // Load PDB from RCSB
  const loadPDBFromRCSB = async (pdbId: string) => {
    try {
      const pdbData = await loadFromRCSB(pdbId);
      displayStructure(pdbData);
    } catch (error) {
      console.error('Failed to load from RCSB:', error);
      throw error;
    }
  };

  // Display structure in viewer
  const displayStructure = (fileData: string) => {
    if (!viewer) return;

    viewer.removeAllModels();

    // Detect file format
    let format = 'pdb';
    const trimmed = fileData.trim();

    if (trimmed.startsWith('data_') || fileData.includes('_atom_site.')) {
      format = 'cif';
    } else if (trimmed.includes('@<TRIPOS>MOLECULE')) {
      format = 'mol2';
    } else if (trimmed.match(/^\s*\d+\s*$/m)) {
      // SDF typically has count line as second line
      format = 'sdf';
    } else if (trimmed.match(/^\s*\w+.*\n\s*\d+\s*$/m)) {
      // GRO has title line then atom count
      format = 'gro';
    }

    viewer.addModel(fileData, format);

    // Parse sequence data, hetAtoms, and glycans
    const { sequenceData, hetAtoms, glycans } = parsePDBSequence(fileData);

    // Update state (this will trigger useEffect to apply styles)
    // Set selectedChain to null to show all chains by default
    dispatch({ type: 'SET_PDB_DATA', payload: fileData });
    dispatch({ type: 'SET_SEQUENCE_DATA', payload: sequenceData });
    dispatch({ type: 'SET_HET_ATOMS', payload: hetAtoms });
    dispatch({ type: 'SET_GLYCANS', payload: glycans });
    dispatch({ type: 'SET_SELECTED_CHAIN', payload: null });
  };

  // Apply viewer style when structure is loaded
  useEffect(() => {
    if (viewer && state.pdbData && state.sequenceData && Object.keys(state.sequenceData).length > 0) {
      console.log('[MoleculeViewer] Applying style after structure load');
      applyViewerStyle();
      viewer.zoomTo();
      viewer.render();
    }
    // Only run when pdbData or sequenceData changes (new structure loaded)
    // Don't include applyViewerStyle to avoid re-running when selections change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, state.pdbData, state.sequenceData, state.hetAtoms]);

  return (
    <div className={styles.mainContent}>
      {/* Left Panel: RCSB Input */}
      <PDBInput onLoadPDB={loadPDBFromRCSB} onLoadFile={displayStructure} />

      {/* Right Panel: 3Dmol.js Viewer */}
      <div className={styles.reviewRightPanel}>
        <div className={styles.viewerContainer}>
          {/* 3D Viewer Area */}
          <div className={styles.viewer3dWrapper}>
            <div ref={viewerContainerRef} className={styles.viewer3d} />

            {/* Empty State Message */}
            {!state.pdbData && (
              <div className={styles.emptyState}>
                <i className="fas fa-cube"></i>
                <p>업로드 되면 구조가 표시됩니다</p>
              </div>
            )}

            {/* Left Controls */}
            <div className={styles.leftControls}>
              <RegionManager
                state={state}
                dispatch={dispatch}
                applyViewerStyle={applyViewerStyle}
              />
            </div>

            {/* View and Zoom Controls */}
            <ViewerControls
              viewer={viewer}
              state={state}
              dispatch={dispatch}
            />

            {/* Selection Info Overlay */}
            <div
              className={styles.viewerSelectionInfo}
              style={{
                display: state.selectedResidues.size > 0 ? 'flex' : 'none'
              }}
            >
              <span className={styles.selectedCount}>
                선택: <b>{state.selectedResidues.size}</b>개 잔기
              </span>
              {state.showNearby && state.nearbyResidues.size > 0 && (
                <span className={styles.nearbyCount}>
                  주변: <b>{state.nearbyResidues.size}</b>개
                </span>
              )}
            </div>
          </div>

          {/* Sequence Panel */}
          <SequencePanel
            state={state}
            dispatch={dispatch}
            toggleResidueSelection={toggleResidueSelection}
          />
        </div>
      </div>
    </div>
  );
};
