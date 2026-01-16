// ============================================
// Custom Hook for Viewer State Management
// ============================================

import { useReducer } from 'react';
import { ViewerState, ViewerAction } from '../types';

const initialState: ViewerState = {
  viewer: null,
  pdbData: null,
  currentStyle: 'cartoon',
  currentColor: 'spectrum',
  isSpinning: false,
  selectedResidues: new Set(),
  nearbyResidues: new Set(),
  showNearby: true,
  showResidueVisualization: true,
  showHetAtoms: true,
  showGlycans: false,  // Default to false for better initial loading performance
  showSilhouette: false,  // Default to false, user can enable for better visibility
  showLabels: false,  // Default to false, user can enable to show residue labels
  selectedChain: null,
  activeAnalysisCard: null,
  sequenceData: {},
  hetAtoms: [],
  glycans: [],
  hoverLabel: null,
  lastSelectedResidue: null,
  skipVisualization: false,
  regions: [],
  regionCounter: 0,
  activeRegion: null
};

const viewerReducer = (state: ViewerState, action: ViewerAction): ViewerState => {
  switch (action.type) {
    case 'SET_VIEWER':
      return { ...state, viewer: action.payload };

    case 'SET_PDB_DATA':
      return { ...state, pdbData: action.payload };

    case 'SET_STYLE':
      return { ...state, currentStyle: action.payload };

    case 'SET_COLOR':
      return { ...state, currentColor: action.payload };

    case 'TOGGLE_SPIN':
      return { ...state, isSpinning: !state.isSpinning };

    case 'ADD_SELECTED_RESIDUE':
      return {
        ...state,
        selectedResidues: new Set([...state.selectedResidues, action.payload])
      };

    case 'REMOVE_SELECTED_RESIDUE': {
      const newSelected = new Set(state.selectedResidues);
      newSelected.delete(action.payload);
      return { ...state, selectedResidues: newSelected };
    }

    case 'SET_SELECTED_RESIDUES':
      return { ...state, selectedResidues: action.payload };

    case 'CLEAR_SELECTED_RESIDUES':
      return {
        ...state,
        selectedResidues: new Set(),
        nearbyResidues: new Set(),
        activeAnalysisCard: null
      };

    case 'SET_NEARBY_RESIDUES':
      return { ...state, nearbyResidues: action.payload };

    case 'TOGGLE_SHOW_NEARBY':
      return { ...state, showNearby: !state.showNearby };

    case 'TOGGLE_RESIDUE_VISUALIZATION':
      return { ...state, showResidueVisualization: !state.showResidueVisualization };

    case 'TOGGLE_HETATOMS':
      return { ...state, showHetAtoms: !state.showHetAtoms };

    case 'TOGGLE_GLYCANS':
      return { ...state, showGlycans: !state.showGlycans };

    case 'TOGGLE_SILHOUETTE':
      return { ...state, showSilhouette: !state.showSilhouette };

    case 'TOGGLE_LABELS':
      return { ...state, showLabels: !state.showLabels };

    case 'SET_SELECTED_CHAIN':
      return { ...state, selectedChain: action.payload };

    case 'SET_SEQUENCE_DATA':
      return { ...state, sequenceData: action.payload };

    case 'SET_HET_ATOMS':
      return { ...state, hetAtoms: action.payload };

    case 'SET_GLYCANS':
      return { ...state, glycans: action.payload };

    case 'SET_LAST_SELECTED_RESIDUE':
      return { ...state, lastSelectedResidue: action.payload };

    case 'SET_SKIP_VISUALIZATION':
      return { ...state, skipVisualization: action.payload };

    case 'ADD_REGION':
      return {
        ...state,
        regions: [...state.regions, action.payload],
        regionCounter: state.regionCounter + 1
      };

    case 'SET_ACTIVE_REGION':
      return { ...state, activeRegion: action.payload };

    case 'UPDATE_REGION': {
      const updatedRegions = state.regions.map(r =>
        r.id === action.payload.id
          ? {
              ...r,
              selectedResidues: action.payload.selectedResidues,
              nearbyResidues: action.payload.nearbyResidues
            }
          : r
      );
      return { ...state, regions: updatedRegions };
    }

    case 'UPDATE_REGION_STYLE': {
      const updatedRegions = state.regions.map(r =>
        r.id === action.payload.id
          ? { ...r, style: action.payload.style }
          : r
      );
      return { ...state, regions: updatedRegions };
    }

    case 'UPDATE_REGION_COLOR': {
      const updatedRegions = state.regions.map(r =>
        r.id === action.payload.id
          ? { ...r, color: action.payload.color }
          : r
      );
      return { ...state, regions: updatedRegions };
    }

    case 'DELETE_REGION': {
      const filteredRegions = state.regions.filter(r => r.id !== action.payload);
      // If the deleted region was active, set activeRegion to null
      const newActiveRegion = state.activeRegion === action.payload ? null : state.activeRegion;
      return {
        ...state,
        regions: filteredRegions,
        activeRegion: newActiveRegion,
        // Clear selections if the deleted region was active
        ...(state.activeRegion === action.payload && {
          selectedResidues: new Set(),
          nearbyResidues: new Set()
        })
      };
    }

    case 'RESET':
      return initialState;

    default:
      return state;
  }
};

export const useViewerState = () => {
  const [state, dispatch] = useReducer(viewerReducer, initialState);

  return { state, dispatch };
};
