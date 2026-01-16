// ============================================
// Type Definitions for 3Dmol Viewer
// ============================================

export interface AminoAcid {
  resSeq: number;
  resName: string;
  oneLetterCode: string;
}

export interface HetAtom {
  chain: string;
  resSeq: number;
  resName: string;
}

export interface GlycanResidue {
  chain: string;
  resSeq: number;
  resName: string;
  x: number;
  y: number;
  z: number;
  shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'pentagon';
  color: string;
  label: string;
}

export interface Region {
  id: number;
  selectedResidues: Set<string>;
  nearbyResidues: Set<string>;
  style: StyleType;
  color: ColorScheme;
}

export interface SequenceData {
  [chain: string]: AminoAcid[];
}

export type StyleType = 'cartoon' | 'stick' | 'sphere' | 'line' | 'ribbon' | 'silhouette';
export type ColorScheme = 'spectrum' | 'chain' | 'element' | 'ss' | 'bfactor';

export interface ViewerState {
  viewer: any | null; // 3Dmol.GLViewer type
  pdbData: string | null;
  currentStyle: StyleType;
  currentColor: ColorScheme;
  isSpinning: boolean;
  selectedResidues: Set<string>;
  nearbyResidues: Set<string>;
  showNearby: boolean;
  showResidueVisualization: boolean;
  showHetAtoms: boolean;
  showGlycans: boolean;
  showSilhouette: boolean;
  showLabels: boolean;
  selectedChain: string | null;
  activeAnalysisCard: string | null;
  sequenceData: SequenceData;
  hetAtoms: HetAtom[];
  glycans: GlycanResidue[];
  hoverLabel: any | null;
  lastSelectedResidue: { chain: string; resi: number } | null;
  skipVisualization: boolean;
  regions: Region[];
  regionCounter: number;
  activeRegion: number | null;
}

export interface Atom {
  chain: string;
  resi: number;
  resn: string;
  serial: number;
  elem: string;
  x: number;
  y: number;
  z: number;
  b?: number;
  ss?: 'h' | 's' | 'c';
  atom?: string;
  hetflag?: boolean;
  resKey?: string;
}

export interface CMYKColors {
  spectrum: string[];
  chain: string[];
  element: {
    [key: string]: string;
  };
  ss: {
    helix: string;
    sheet: string;
    coil: string;
  };
  bfactor: string[];
}

export interface AminoAcidProperties {
  [key: string]: 'hydrophobic' | 'polar' | 'positive' | 'negative' | 'special';
}

export interface AA3to1 {
  [key: string]: string;
}

export type ViewerAction =
  | { type: 'SET_VIEWER'; payload: any }
  | { type: 'SET_PDB_DATA'; payload: string }
  | { type: 'SET_STYLE'; payload: StyleType }
  | { type: 'SET_COLOR'; payload: ColorScheme }
  | { type: 'TOGGLE_SPIN' }
  | { type: 'ADD_SELECTED_RESIDUE'; payload: string }
  | { type: 'REMOVE_SELECTED_RESIDUE'; payload: string }
  | { type: 'SET_SELECTED_RESIDUES'; payload: Set<string> }
  | { type: 'CLEAR_SELECTED_RESIDUES' }
  | { type: 'SET_NEARBY_RESIDUES'; payload: Set<string> }
  | { type: 'TOGGLE_SHOW_NEARBY' }
  | { type: 'TOGGLE_RESIDUE_VISUALIZATION' }
  | { type: 'TOGGLE_HETATOMS' }
  | { type: 'TOGGLE_GLYCANS' }
  | { type: 'TOGGLE_SILHOUETTE' }
  | { type: 'TOGGLE_LABELS' }
  | { type: 'SET_SELECTED_CHAIN'; payload: string | null }
  | { type: 'SET_SEQUENCE_DATA'; payload: SequenceData }
  | { type: 'SET_HET_ATOMS'; payload: HetAtom[] }
  | { type: 'SET_GLYCANS'; payload: GlycanResidue[] }
  | { type: 'SET_LAST_SELECTED_RESIDUE'; payload: { chain: string; resi: number } | null }
  | { type: 'SET_SKIP_VISUALIZATION'; payload: boolean }
  | { type: 'ADD_REGION'; payload: Region }
  | { type: 'SET_ACTIVE_REGION'; payload: number | null }
  | { type: 'UPDATE_REGION'; payload: { id: number; selectedResidues: Set<string>; nearbyResidues: Set<string> } }
  | { type: 'UPDATE_REGION_STYLE'; payload: { id: number; style: StyleType } }
  | { type: 'UPDATE_REGION_COLOR'; payload: { id: number; color: ColorScheme } }
  | { type: 'DELETE_REGION'; payload: number }
  | { type: 'RESET' };
