// ============================================
// Constants for 3Dmol Viewer
// ============================================

import { CMYKColors, AminoAcidProperties, AA3to1 } from '../types';

export const API_BASE_URL = 'http://localhost:8082/api';

// CMYK-style soft color palettes
export const cmykColors: CMYKColors = {
  // Spectrum colors (rainbow gradient)
  spectrum: ['#ca4a4a', '#ca6a4a', '#ca9a4a', '#8aca4a', '#4acaca', '#4a7aca', '#9a6aca'],
  // Chain colors
  chain: ['#4a9aca', '#ca6a4a', '#6aca6a', '#ca9a4a', '#9a6aca', '#4acaca', '#ca4a9a', '#8aca4a'],
  // Element colors (CMYK-style atom colors)
  element: {
    'C': '#a0a0a0',  // Carbon - gray
    'N': '#4a7aca',  // Nitrogen - blue
    'O': '#ff0000',  // Oxygen - red
    'S': '#caca4a',  // Sulfur - yellow
    'P': '#ca9a4a',  // Phosphorus - orange
    'H': '#e0e0e0',  // Hydrogen - light gray
    'default': '#ca4aca'  // Other - magenta
  },
  // Secondary structure colors
  ss: {
    helix: '#e891b0',  // soft pink
    sheet: '#7ab0d4',  // soft blue
    coil: '#a0a0a0'    // gray
  },
  // B-factor gradient (blue -> cyan -> green -> yellow -> orange -> red)
  bfactor: ['#4a7aca', '#4acaca', '#4aca6a', '#caca4a', '#ca9a4a', '#ca4a4a']
};

// Amino acid properties for coloring
export const aminoAcidProperties: AminoAcidProperties = {
  // Hydrophobic
  'A': 'hydrophobic', 'V': 'hydrophobic', 'I': 'hydrophobic', 'L': 'hydrophobic',
  'M': 'hydrophobic', 'F': 'hydrophobic', 'W': 'hydrophobic', 'P': 'hydrophobic',
  // Polar
  'S': 'polar', 'T': 'polar', 'N': 'polar', 'Q': 'polar', 'Y': 'polar', 'C': 'polar',
  // Positive charge
  'K': 'positive', 'R': 'positive', 'H': 'positive',
  // Negative charge
  'D': 'negative', 'E': 'negative',
  // Special
  'G': 'special'
};

// 3-letter to 1-letter amino acid conversion
export const aa3to1: AA3to1 = {
  'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
  'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
  'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
  'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V'
};

// Charged residues for salt bridge detection
export const positiveResidues = ['ARG', 'LYS', 'HIS'];
export const negativeResidues = ['ASP', 'GLU'];

// Ion residues
export const ionResidues = ['NA', 'CL', 'CA', 'MG', 'FE', 'ZN', 'MN', 'K', 'CU'];

// ============================================
// Glycan (Sugar) Definitions - SNFG Standard
// ============================================

// Common sugar residue names found in PDB files
export const glycanResidues = [
  // Hexoses
  'GLC', 'GAL', 'MAN', 'GUL', 'ALT', 'ALL', 'TRA', 'IDO',
  // Deoxy hexoses
  'FUC', 'FUL', 'RHA', 'QUI',
  // HexNAc (N-acetyl hexosamines)
  'NAG', 'NDG', 'A2G', 'GLC-NAC', 'GAL-NAC',
  // Pentoses
  'ARA', 'LYX', 'RIB', 'XYL', 'XYS',
  // Deoxy pentoses
  'DHA',
  // Acidic sugars (sialic acids, uronic acids)
  'SIA', 'NEU', 'NEU5AC', 'NEU5GC', 'KDN', 'KDO',
  'GLC-A', 'GAL-A', 'MAN-A', 'IDO-A',
  // Di/oligosaccharides
  'LAT', 'MAL', 'SUC', 'TRE',
  // Other common forms
  'BGC', 'BMA', 'MAN', 'FRU', 'SOR'
];

// SNFG (Symbol Nomenclature for Glycans) color and shape mapping
export interface SNFGStyle {
  shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'pentagon';
  color: string;
  label: string;
}

export const snfgMapping: Record<string, SNFGStyle> = {
  // Hexoses - Circles
  'GLC': { shape: 'circle', color: '#0090ff', label: 'Glc' },  // Glucose - blue circle
  'GAL': { shape: 'circle', color: '#ffff00', label: 'Gal' },  // Galactose - yellow circle
  'MAN': { shape: 'circle', color: '#00ff00', label: 'Man' },  // Mannose - green circle
  'GUL': { shape: 'circle', color: '#ff8800', label: 'Gul' },  // Gulose - orange circle
  'ALT': { shape: 'circle', color: '#ff00ff', label: 'Alt' },  // Altrose - pink circle
  'ALL': { shape: 'circle', color: '#a0a0ff', label: 'All' },  // Allose - purple circle
  'TRA': { shape: 'circle', color: '#00ffff', label: 'Tal' },  // Talose - cyan circle
  'IDO': { shape: 'circle', color: '#883300', label: 'Ido' },  // Idose - brown circle

  // Deoxy hexoses - Triangles
  'FUC': { shape: 'triangle', color: '#ff0000', label: 'Fuc' },  // Fucose - red triangle
  'FUL': { shape: 'triangle', color: '#ff0000', label: 'Fuc' },  // Fucose variant
  'RHA': { shape: 'triangle', color: '#ff00ff', label: 'Rha' },  // Rhamnose - purple triangle
  'QUI': { shape: 'triangle', color: '#0090ff', label: 'Qui' },  // Quinovose - blue triangle

  // N-acetyl hexosamines - Squares
  'NAG': { shape: 'square', color: '#0090ff', label: 'GlcNAc' },  // GlcNAc - blue square
  'NDG': { shape: 'square', color: '#0090ff', label: 'GlcNAc' },  // GlcNAc variant
  'A2G': { shape: 'square', color: '#ffff00', label: 'GalNAc' },  // GalNAc - yellow square
  'BMA': { shape: 'circle', color: '#00ff00', label: 'Man' },     // Beta-mannose
  'BGC': { shape: 'circle', color: '#0090ff', label: 'Glc' },     // Beta-glucose

  // Pentoses - Stars
  'ARA': { shape: 'star', color: '#00ff00', label: 'Ara' },    // Arabinose - green star
  'LYX': { shape: 'star', color: '#ffff00', label: 'Lyx' },    // Lyxose - yellow star
  'RIB': { shape: 'star', color: '#ff00ff', label: 'Rib' },    // Ribose - pink star
  'XYL': { shape: 'star', color: '#ff8800', label: 'Xyl' },    // Xylose - orange star
  'XYS': { shape: 'star', color: '#ff8800', label: 'Xyl' },    // Xylose variant

  // Acidic sugars - Diamonds
  'SIA': { shape: 'diamond', color: '#aa00ff', label: 'Sia' },     // Sialic acid - purple diamond
  'NEU': { shape: 'diamond', color: '#aa00ff', label: 'Neu5Ac' },  // Neu5Ac - purple diamond
  'NEU5AC': { shape: 'diamond', color: '#aa00ff', label: 'Neu5Ac' },
  'NEU5GC': { shape: 'diamond', color: '#00aaff', label: 'Neu5Gc' },
  'KDN': { shape: 'diamond', color: '#00ff00', label: 'Kdn' },
  'KDO': { shape: 'diamond', color: '#00ff00', label: 'Kdo' },

  // Uronic acids - Diamonds with different colors
  'GLC-A': { shape: 'diamond', color: '#0090ff', label: 'GlcA' },  // Glucuronic acid
  'GAL-A': { shape: 'diamond', color: '#ffff00', label: 'GalA' },  // Galacturonic acid
  'MAN-A': { shape: 'diamond', color: '#00ff00', label: 'ManA' },  // Mannuronic acid
  'IDO-A': { shape: 'diamond', color: '#883300', label: 'IdoA' },  // Iduronic acid

  // Default for unknown sugars
  'default': { shape: 'circle', color: '#cccccc', label: '?' }
};

// Size of glycan shapes (in Angstroms)
export const glycanShapeSize = 1.5;
