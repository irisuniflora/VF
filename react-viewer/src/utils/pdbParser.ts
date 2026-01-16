// ============================================
// PDB Parsing Utilities
// ============================================

import { SequenceData, HetAtom, GlycanResidue } from '../types';
import { aa3to1, glycanResidues, snfgMapping } from './constants';

export interface ParsePDBResult {
  sequenceData: SequenceData;
  hetAtoms: HetAtom[];
  glycans: GlycanResidue[];
}

const parsePDBFormat = (lines: string[]): ParsePDBResult => {
  const sequenceData: SequenceData = {};
  const hetAtoms: HetAtom[] = [];
  const glycans: GlycanResidue[] = [];
  const seenResidues = new Set<string>();
  const seenHetAtoms = new Set<string>();
  const glycanAtoms: Map<string, { x: number[]; y: number[]; z: number[] }> = new Map();

  lines.forEach(line => {
    if (line.startsWith('ATOM')) {
      const chain = line.substring(21, 22).trim() || 'A';
      const resName = line.substring(17, 20).trim();
      const resSeq = parseInt(line.substring(22, 26).trim());

      const key = `${chain}:${resSeq}`;
      if (!seenResidues.has(key) && aa3to1[resName]) {
        seenResidues.add(key);

        if (!sequenceData[chain]) {
          sequenceData[chain] = [];
        }
        sequenceData[chain].push({
          resSeq: resSeq,
          resName: resName,
          oneLetterCode: aa3to1[resName]
        });
      }
    } else if (line.startsWith('HETATM')) {
      const chain = line.substring(21, 22).trim() || 'A';
      const resName = line.substring(17, 20).trim();
      const resSeq = parseInt(line.substring(22, 26).trim());

      if (resName === 'HOH' || resName === 'WAT') return;

      const isGlycan = glycanResidues.includes(resName);

      if (isGlycan) {
        const x = parseFloat(line.substring(30, 38).trim());
        const y = parseFloat(line.substring(38, 46).trim());
        const z = parseFloat(line.substring(46, 54).trim());

        const glycanKey = `${chain}:${resSeq}:${resName}`;
        if (!glycanAtoms.has(glycanKey)) {
          glycanAtoms.set(glycanKey, { x: [], y: [], z: [] });
        }
        const coords = glycanAtoms.get(glycanKey)!;
        coords.x.push(x);
        coords.y.push(y);
        coords.z.push(z);
      }

      const key = `${chain}:${resSeq}:${resName}`;
      if (!seenHetAtoms.has(key)) {
        seenHetAtoms.add(key);
        hetAtoms.push({
          chain: chain,
          resSeq: resSeq,
          resName: resName
        });
      }
    }
  });

  glycanAtoms.forEach((coords, key) => {
    const [chain, resSeqStr, resName] = key.split(':');
    const resSeq = parseInt(resSeqStr);

    const x = coords.x.reduce((a, b) => a + b, 0) / coords.x.length;
    const y = coords.y.reduce((a, b) => a + b, 0) / coords.y.length;
    const z = coords.z.reduce((a, b) => a + b, 0) / coords.z.length;

    const snfgStyle = snfgMapping[resName] || snfgMapping['default'];

    glycans.push({
      chain,
      resSeq,
      resName,
      x,
      y,
      z,
      shape: snfgStyle.shape,
      color: snfgStyle.color,
      label: snfgStyle.label
    });
  });

  Object.keys(sequenceData).forEach(chain => {
    sequenceData[chain].sort((a, b) => a.resSeq - b.resSeq);
  });

  return { sequenceData, hetAtoms, glycans };
};

const parseCIFFormat = (content: string): ParsePDBResult => {
  const sequenceData: SequenceData = {};
  const hetAtoms: HetAtom[] = [];
  const glycans: GlycanResidue[] = [];
  const seenResidues = new Set<string>();
  const seenHetAtoms = new Set<string>();
  const glycanAtoms: Map<string, { x: number[]; y: number[]; z: number[] }> = new Map();

  // Find _atom_site section
  const atomSiteMatch = content.match(/loop_\s+_atom_site\.([\s\S]*?)(?=\nloop_|#|\s*$)/);
  if (!atomSiteMatch) {
    return { sequenceData, hetAtoms, glycans };
  }

  const lines = content.split('\n');
  let inAtomSite = false;
  let columnMap: { [key: string]: number } = {};
  let columnIndex = 0;

  lines.forEach(line => {
    const trimmed = line.trim();

    if (trimmed.startsWith('_atom_site.')) {
      inAtomSite = true;
      const columnName = trimmed.substring(11); // Remove '_atom_site.'
      columnMap[columnName] = columnIndex++;
    } else if (inAtomSite && trimmed && !trimmed.startsWith('_') && !trimmed.startsWith('#')) {
      const fields = trimmed.match(/\S+/g);
      if (!fields) return;

      const group = fields[columnMap['group_PDB']] || '';
      const labelCompId = fields[columnMap['label_comp_id']] || fields[columnMap['auth_comp_id']] || '';
      const labelAsymId = fields[columnMap['label_asym_id']] || fields[columnMap['auth_asym_id']] || 'A';
      const labelSeqId = parseInt(fields[columnMap['label_seq_id']] || fields[columnMap['auth_seq_id']] || '0');
      const cartnX = parseFloat(fields[columnMap['Cartn_x']] || '0');
      const cartnY = parseFloat(fields[columnMap['Cartn_y']] || '0');
      const cartnZ = parseFloat(fields[columnMap['Cartn_z']] || '0');

      if (group === 'ATOM' && aa3to1[labelCompId]) {
        const key = `${labelAsymId}:${labelSeqId}`;
        if (!seenResidues.has(key)) {
          seenResidues.add(key);
          if (!sequenceData[labelAsymId]) {
            sequenceData[labelAsymId] = [];
          }
          sequenceData[labelAsymId].push({
            resSeq: labelSeqId,
            resName: labelCompId,
            oneLetterCode: aa3to1[labelCompId]
          });
        }
      } else if (group === 'HETATM') {
        if (labelCompId === 'HOH' || labelCompId === 'WAT') return;

        const isGlycan = glycanResidues.includes(labelCompId);

        if (isGlycan) {
          const glycanKey = `${labelAsymId}:${labelSeqId}:${labelCompId}`;
          if (!glycanAtoms.has(glycanKey)) {
            glycanAtoms.set(glycanKey, { x: [], y: [], z: [] });
          }
          const coords = glycanAtoms.get(glycanKey)!;
          coords.x.push(cartnX);
          coords.y.push(cartnY);
          coords.z.push(cartnZ);
        }

        const key = `${labelAsymId}:${labelSeqId}:${labelCompId}`;
        if (!seenHetAtoms.has(key)) {
          seenHetAtoms.add(key);
          hetAtoms.push({
            chain: labelAsymId,
            resSeq: labelSeqId,
            resName: labelCompId
          });
        }
      }
    } else if (trimmed.startsWith('loop_') || trimmed.startsWith('#')) {
      inAtomSite = false;
    }
  });

  glycanAtoms.forEach((coords, key) => {
    const [chain, resSeqStr, resName] = key.split(':');
    const resSeq = parseInt(resSeqStr);

    const x = coords.x.reduce((a, b) => a + b, 0) / coords.x.length;
    const y = coords.y.reduce((a, b) => a + b, 0) / coords.y.length;
    const z = coords.z.reduce((a, b) => a + b, 0) / coords.z.length;

    const snfgStyle = snfgMapping[resName] || snfgMapping['default'];

    glycans.push({
      chain,
      resSeq,
      resName,
      x,
      y,
      z,
      shape: snfgStyle.shape,
      color: snfgStyle.color,
      label: snfgStyle.label
    });
  });

  Object.keys(sequenceData).forEach(chain => {
    sequenceData[chain].sort((a, b) => a.resSeq - b.resSeq);
  });

  return { sequenceData, hetAtoms, glycans };
};

const parseGenericFormat = (_content: string): ParsePDBResult => {
  // For GRO, SDF, MOL2 - these formats don't have standard residue info
  // We'll return empty data and let 3Dmol.js handle the visualization
  const sequenceData: SequenceData = {};
  const hetAtoms: HetAtom[] = [];
  const glycans: GlycanResidue[] = [];

  return { sequenceData, hetAtoms, glycans };
};

export const parsePDBSequence = (pdbData: string): ParsePDBResult => {
  // Detect file format
  const trimmed = pdbData.trim();

  if (trimmed.startsWith('data_') || pdbData.includes('_atom_site.')) {
    return parseCIFFormat(pdbData);
  } else if (trimmed.includes('@<TRIPOS>MOLECULE') ||
             trimmed.match(/^\s*\d+\s*$/m) ||
             trimmed.match(/^\s*\w+.*\n\s*\d+\s*$/m)) {
    // MOL2, SDF, or GRO format - return empty parsing result
    return parseGenericFormat(pdbData);
  } else {
    // PDB format
    const lines = pdbData.split('\n');
    return parsePDBFormat(lines);
  }
};
