// ============================================
// Sequence Panel Component
// ============================================

import React from 'react';
import { ViewerState, ViewerAction } from '../types';
import { aminoAcidProperties } from '../utils/constants';
import styles from '../styles/SequencePanel.module.css';

interface SequencePanelProps {
  state: ViewerState;
  dispatch: React.Dispatch<ViewerAction>;
  toggleResidueSelection: (chain: string, resi: number, resn: string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

export const SequencePanel: React.FC<SequencePanelProps> = ({
  state,
  dispatch,
  toggleResidueSelection
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const handleChainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    dispatch({ type: 'SET_SELECTED_CHAIN', payload: value === '' ? null : value });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current) {
      e.preventDefault();
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleResidueClick = (
    chain: string,
    resi: number,
    resn: string,
    event: React.MouseEvent
  ) => {
    const ctrlKey = event.ctrlKey || event.metaKey;
    const shiftKey = event.shiftKey;
    toggleResidueSelection(chain, resi, resn, ctrlKey, shiftKey);
  };

  const renderSequence = () => {
    const chains = Object.keys(state.sequenceData).sort();

    // "모든 서열" 모드: 모든 체인을 횡으로 나열
    if (!state.selectedChain) {
      return (
        <>
          <div
            className={styles.allChainsContainer}
            ref={scrollContainerRef}
            onWheel={handleWheel}
          >
            {chains.map(chain => {
              const residues = state.sequenceData[chain];
              if (!residues) return null;

              return (
                <div key={chain} className={styles.sequenceChain} data-chain={chain}>
                  <div className={styles.stickyChainLabel}>
                    <div className={styles.chainInfo}>
                      Chain {chain}
                      {renderHelpButton()}
                      <span className={styles.proteinName}>protein name</span>
                    </div>
                  </div>
                  <div className={styles.sequenceResidues}>
                  {residues.map((res, idx) => {
                      const property = aminoAcidProperties[res.oneLetterCode] || 'special';
                      const resKey = `${chain}:${res.resSeq}`;
                      const isSelected = state.selectedResidues.has(resKey);
                      const isNearby = state.nearbyResidues.has(resKey);

                      let className = `${styles.sequenceResidue} ${styles[property]}`;
                      if (isSelected) className += ` ${styles.selected}`;
                      else if (isNearby) className += ` ${styles.nearby}`;

                      const showNumber = (idx + 1) % 10 === 0;
                      const showSpace = (idx + 1) % 10 === 0 && idx < residues.length - 1;

                      return (
                        <React.Fragment key={resKey}>
                          <span className={styles.sequenceBlock}>
                            {showNumber && (
                              <span className={styles.sequenceNumber}>{res.resSeq}</span>
                            )}
                            <span
                              className={className}
                              onClick={(e) => handleResidueClick(chain, res.resSeq, res.resName, e)}
                              title={`${res.resName}${res.resSeq}`}
                            >
                              {res.oneLetterCode}
                            </span>
                          </span>
                          {showSpace && (
                            <span className={styles.sequenceSpace}> </span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      );
    }

    // 개별 체인 모드: 선택된 체인만 표시
    const residues = state.sequenceData[state.selectedChain];
    if (!residues) return null;

    return (
      <div className={styles.sequenceChain}>
        <div className={styles.sequenceChainLabel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Chain {state.selectedChain}
            {renderHelpButton()}
          </div>
        </div>
        <div className={styles.sequenceResidues}>
          {residues.map((res, idx) => {
            const property = aminoAcidProperties[res.oneLetterCode] || 'special';
            const resKey = `${state.selectedChain}:${res.resSeq}`;
            const isSelected = state.selectedResidues.has(resKey);
            const isNearby = state.nearbyResidues.has(resKey);

            let className = `${styles.sequenceResidue} ${styles[property]}`;
            if (isSelected) className += ` ${styles.selected}`;
            else if (isNearby) className += ` ${styles.nearby}`;

            const showNumber = (idx + 1) % 10 === 0;
            const showSpace = (idx + 1) % 10 === 0 && idx < residues.length - 1;

            return (
              <React.Fragment key={resKey}>
                <span className={styles.sequenceBlock}>
                  {showNumber && (
                    <span className={styles.sequenceNumber}>{res.resSeq}</span>
                  )}
                  <span
                    className={className}
                    onClick={(e) => handleResidueClick(state.selectedChain!, res.resSeq, res.resName, e)}
                    title={`${res.resName}${res.resSeq}`}
                  >
                    {res.oneLetterCode}
                  </span>
                </span>
                {showSpace && (
                  <span className={styles.sequenceSpace}> </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const chains = Object.keys(state.sequenceData).sort();

  const renderHelpButton = () => (
    <div className={styles.helpButton}>
      <i className="fas fa-question-circle"></i>
      <div className={styles.helpTooltip}>
        <span className={`${styles.legendItem} ${styles.hydrophobic}`}>소수성</span>
        <span className={`${styles.legendItem} ${styles.polar}`}>극성</span>
        <span className={`${styles.legendItem} ${styles.positive}`}>양전하</span>
        <span className={`${styles.legendItem} ${styles.negative}`}>음전하</span>
        <span className={`${styles.legendItem} ${styles.special}`}>특수</span>
      </div>
    </div>
  );

  const renderChainSelect = () => (
    <select
      className={styles.chainSelect}
      value={state.selectedChain || ''}
      onChange={handleChainChange}
    >
      <option value="">All</option>
      {chains.map(chain => (
        <option key={chain} value={chain}>
          Chain {chain}
        </option>
      ))}
    </select>
  );

  return (
    <div className={styles.sequencePanel}>
      <div className={styles.sequencePanelWrapper}>
        {chains.length > 0 && (
          <>
            <div className={styles.chainSelectWrapper}>
              {renderChainSelect()}
            </div>
            <div className={styles.sequenceContent}>
              <div className={styles.sequenceDisplay}>
                {renderSequence()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
