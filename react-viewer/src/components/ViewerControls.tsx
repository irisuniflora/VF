// ============================================
// Viewer Controls Component
// ============================================

import React from 'react';
import { ViewerState, ViewerAction } from '../types';
import styles from '../styles/ViewerControls.module.css';

interface ViewerControlsProps {
  viewer: any;
  state: ViewerState;
  dispatch: React.Dispatch<ViewerAction>;
}

export const ViewerControls: React.FC<ViewerControlsProps> = ({
  viewer,
  state,
  dispatch
}) => {
  const handleResetZoom = () => {
    if (viewer) {
      viewer.zoomTo(undefined, 1000); // 1000ms animation
      viewer.render();
    }
  };

  const handleResetAxes = () => {
    if (viewer) {
      // Animate rotation reset smoothly using camera rotation
      const duration = 1000; // 1 second
      const steps = 60; // 60 frames
      const stepTime = duration / steps;

      const currentView = viewer.getView();
      const startRotation = [currentView[3], currentView[4], currentView[5], currentView[6], currentView[7]];
      const targetRotation = [0, 0, 0, 0, 1];

      let currentStep = 0;

      const animate = () => {
        currentStep++;
        const progress = currentStep / steps;

        // Linear interpolation
        const newRotation = startRotation.map((start, i) =>
          start + (targetRotation[i] - start) * progress
        );

        viewer.setView([
          currentView[0],
          currentView[1],
          currentView[2],
          ...newRotation
        ]);
        viewer.render();

        if (currentStep < steps) {
          setTimeout(animate, stepTime);
        }
      };

      animate();
    }
  };

  const handleToggleSpin = () => {
    if (!viewer) return;
    dispatch({ type: 'TOGGLE_SPIN' });
    viewer.spin(!state.isSpinning);
  };

  const handleZoomIn = () => {
    if (viewer) {
      viewer.zoom(1.2);
      viewer.render();
    }
  };

  const handleZoomOut = () => {
    if (viewer) {
      viewer.zoom(0.8);
      viewer.render();
    }
  };

  const handleToggleHetAtoms = () => {
    dispatch({ type: 'TOGGLE_HETATOMS' });
  };

  const handleToggleGlycans = () => {
    dispatch({ type: 'TOGGLE_GLYCANS' });
  };

  const handleToggleResidueVisualization = () => {
    dispatch({ type: 'TOGGLE_RESIDUE_VISUALIZATION' });
  };

  const handleToggleNearby = () => {
    dispatch({ type: 'TOGGLE_SHOW_NEARBY' });
  };

  const handleScreenshot = () => {
    if (!viewer) return;

    // Get PNG data from viewer
    const imgData = viewer.pngURI();

    // Create download link
    const link = document.createElement('a');
    link.href = imgData;
    link.download = `molecule_${new Date().getTime()}.png`;
    link.click();
  };

  return (
    <>
      {/* Zoom Controls */}
      <div className={styles.viewerZoomControls}>
        {/* Reset View Menu */}
        <div className={styles.resetMenu}>
          <button
            className={styles.zoomBtn}
            onClick={handleResetZoom}
            title="뷰 리셋"
          >
            <i className="fas fa-home"></i>
          </button>
          <div className={styles.resetPanel}>
            <button
              className={styles.resetOptionBtn}
              onClick={handleResetZoom}
              title="Reset Zoom"
            >
              Reset Zoom
            </button>
            <button
              className={styles.resetOptionBtn}
              onClick={handleResetAxes}
              title="Reset Axes"
            >
              Reset Axes
            </button>
          </div>
        </div>

        <button
          className={`${styles.zoomBtn} ${state.isSpinning ? styles.active : ''}`}
          onClick={handleToggleSpin}
          title="자동 회전"
        >
          <i className="fas fa-sync-alt"></i>
        </button>
        <button
          className={styles.zoomBtn}
          onClick={handleScreenshot}
          title="스크린샷 저장 (PNG)"
        >
          <i className="fas fa-camera"></i>
        </button>

        {/* Display Options Menu */}
        <div className={styles.displayMenu}>
          <button
            className={styles.zoomBtn}
            title="표시 옵션"
          >
            <i className="fas fa-eye"></i>
          </button>
          <div className={styles.displayPanel}>
            <button
              className={`${styles.displayToggleBtn} ${state.showHetAtoms ? styles.active : ''}`}
              onClick={handleToggleHetAtoms}
            >
              <span>HETATM</span>
              <i className={state.showHetAtoms ? "fas fa-check" : "fas fa-times"}></i>
            </button>
            <button
              className={`${styles.displayToggleBtn} ${state.showGlycans ? styles.active : ''}`}
              onClick={handleToggleGlycans}
            >
              <span>당분자</span>
              <i className={state.showGlycans ? "fas fa-check" : "fas fa-times"}></i>
            </button>
            <button
              className={`${styles.displayToggleBtn} ${state.showResidueVisualization ? styles.active : ''}`}
              onClick={handleToggleResidueVisualization}
            >
              <span>잔기 시각화</span>
              <i className={state.showResidueVisualization ? "fas fa-check" : "fas fa-times"}></i>
            </button>
            <button
              className={`${styles.displayToggleBtn} ${state.showNearby ? styles.active : ''}`}
              onClick={handleToggleNearby}
            >
              <span>주변 잔기</span>
              <i className={state.showNearby ? "fas fa-check" : "fas fa-times"}></i>
            </button>
          </div>
        </div>

        <button
          className={styles.zoomBtn}
          onClick={handleZoomIn}
          title="확대"
        >
          <i className="fas fa-plus"></i>
        </button>
        <button
          className={styles.zoomBtn}
          onClick={handleZoomOut}
          title="축소"
        >
          <i className="fas fa-minus"></i>
        </button>
      </div>
    </>
  );
};
