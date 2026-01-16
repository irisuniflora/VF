// ============================================
// PDB Input Component
// ============================================

import React, { useState, useRef } from 'react';
import styles from '../styles/PDBInput.module.css';

interface PDBInputProps {
  onLoadPDB: (pdbId: string) => Promise<void>;
  onLoadFile?: (content: string) => void;
}

export const PDBInput: React.FC<PDBInputProps> = ({ onLoadPDB, onLoadFile }) => {
  const [pdbId, setPdbId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoad = async () => {
    const trimmedId = pdbId.trim().toLowerCase();

    if (!trimmedId || trimmedId.length !== 4) {
      setError('유효한 PDB ID를 입력하세요 (예: 1CRN)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onLoadPDB(trimmedId);
      setPdbId('');
    } catch (err: any) {
      setError(err.message || 'PDB 로드에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoad();
    }
  };

  const handleFileRead = (file: File) => {
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.pdb', '.cif', '.gro', '.sdf', '.mol2'];
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      setError('지원되는 파일 형식: .pdb, .cif, .gro, .sdf, .mol2');
      setUploadedFileName(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content && onLoadFile) {
        onLoadFile(content);
        setError(null);
        setUploadedFileName(file.name);
      }
    };
    reader.onerror = () => {
      setError('파일 읽기에 실패했습니다');
      setUploadedFileName(null);
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.leftPanel}>
      <div className={styles.inputSection}>
        <h3>
          <i className="fas fa-database"></i> RCSB PDB 로드
        </h3>
        <div className={styles.inputGroup}>
          <label htmlFor="pdbId">PDB ID</label>
          <div className={styles.inputWithButton}>
            <input
              type="text"
              id="pdbId"
              placeholder="예: 1CRN"
              maxLength={4}
              value={pdbId}
              onChange={(e) => setPdbId(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button
              className={styles.squareBtn}
              onClick={handleLoad}
              disabled={loading}
              title="구조 불러오기"
            >
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-download"></i>
              )}
            </button>
          </div>
        </div>

        <div className={styles.divider}>
          <span>또는</span>
        </div>

        <div className={styles.inputGroup}>
          <label>구조 파일</label>
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
          >
            <i className="fas fa-upload"></i>
            <p>파일을 끌어놓거나 클릭하여 업로드</p>
            <span>.pdb, .cif, .gro, .sdf, .mol2</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdb,.cif,.gro,.sdf,.mol2"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {uploadedFileName && (
            <div className={styles.uploadedFile}>
              <i className="fas fa-file-alt"></i>
              <span>{uploadedFileName}</span>
            </div>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
};
