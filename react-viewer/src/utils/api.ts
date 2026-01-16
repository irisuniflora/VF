// ============================================
// API Utility Functions
// ============================================

import { API_BASE_URL } from './constants';

export interface ReadPDBResponse {
  success: boolean;
  content?: string;
  path?: string;
  error?: string;
}

export const readPDBFile = async (pdbPath: string): Promise<ReadPDBResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/read_pdb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdb_path: pdbPath })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: 'API 서버에 연결할 수 없습니다'
    };
  }
};

export const loadFromRCSB = async (pdbId: string): Promise<string> => {
  const url = `https://files.rcsb.org/download/${pdbId}.pdb`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`PDB ID ${pdbId.toUpperCase()}를 찾을 수 없습니다`);
  }

  return await response.text();
};
