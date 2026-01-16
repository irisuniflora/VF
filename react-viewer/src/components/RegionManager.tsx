// ============================================
// Region Manager Component
// ============================================

import React from 'react';
import { ViewerState, ViewerAction, Region, StyleType, ColorScheme } from '../types';
import styles from '../styles/RegionManager.module.css';

interface RegionManagerProps {
  state: ViewerState;
  dispatch: React.Dispatch<ViewerAction>;
  applyViewerStyle: () => void;
}

export const RegionManager: React.FC<RegionManagerProps> = ({
  state,
  dispatch,
  applyViewerStyle
}) => {
  const handleAddRegion = () => {
    const newRegion: Region = {
      id: state.regionCounter + 1,
      selectedResidues: state.activeRegion === null
        ? new Set(state.selectedResidues)
        : new Set(),
      nearbyResidues: state.activeRegion === null
        ? new Set(state.nearbyResidues)
        : new Set(),
      style: 'cartoon',
      color: 'spectrum'
    };

    dispatch({ type: 'ADD_REGION', payload: newRegion });

    // Auto-select the new region
    selectRegion(newRegion.id);
  };

  const selectRegion = (regionId: number) => {
    // Save current region before switching
    if (state.activeRegion !== null) {
      saveActiveRegion();
    }

    dispatch({ type: 'SET_ACTIVE_REGION', payload: regionId });

    // Load region's residues
    const region = state.regions.find(r => r.id === regionId);
    if (region) {
      dispatch({ type: 'SET_SELECTED_RESIDUES', payload: new Set(region.selectedResidues) });
      dispatch({ type: 'SET_NEARBY_RESIDUES', payload: new Set(region.nearbyResidues) });
    }

    applyViewerStyle();
  };

  const selectGlobalView = () => {
    // Save current region before switching
    if (state.activeRegion !== null) {
      saveActiveRegion();
    }

    dispatch({ type: 'SET_ACTIVE_REGION', payload: null });
    dispatch({ type: 'SET_SELECTED_RESIDUES', payload: new Set() });
    dispatch({ type: 'SET_NEARBY_RESIDUES', payload: new Set() });

    applyViewerStyle();
  };

  const saveActiveRegion = () => {
    if (state.activeRegion === null) return;

    dispatch({
      type: 'UPDATE_REGION',
      payload: {
        id: state.activeRegion,
        selectedResidues: new Set(state.selectedResidues),
        nearbyResidues: new Set(state.nearbyResidues)
      }
    });
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStyle = e.target.value as StyleType;

    console.log('[RegionManager] Style change:', newStyle);

    if (state.activeRegion !== null) {
      // Region mode: update region's style
      dispatch({ type: 'UPDATE_REGION_STYLE', payload: { id: state.activeRegion, style: newStyle } });
    } else {
      // Global mode: update global style
      // If silhouette is selected, enable silhouette flag and set style to silhouette
      if (newStyle === 'silhouette') {
        console.log('[RegionManager] Silhouette selected, dispatching SET_STYLE with silhouette');
        if (!state.showSilhouette) {
          dispatch({ type: 'TOGGLE_SILHOUETTE' });
        }
        dispatch({ type: 'SET_STYLE', payload: 'silhouette' });
      } else {
        // If silhouette was previously on, turn it off
        if (state.showSilhouette) {
          dispatch({ type: 'TOGGLE_SILHOUETTE' });
        }
        dispatch({ type: 'SET_STYLE', payload: newStyle });
      }
    }
    applyViewerStyle();
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newColor = e.target.value as ColorScheme;

    if (state.activeRegion !== null) {
      // Region mode: update region's color
      dispatch({ type: 'UPDATE_REGION_COLOR', payload: { id: state.activeRegion, color: newColor } });
    } else {
      // Global mode: update global color
      dispatch({ type: 'SET_COLOR', payload: newColor });
    }
    applyViewerStyle();
  };

  const handleResetStyle = () => {
    dispatch({ type: 'SET_STYLE', payload: 'cartoon' });
    dispatch({ type: 'SET_COLOR', payload: 'spectrum' });
    dispatch({ type: 'CLEAR_SELECTED_RESIDUES' });
    applyViewerStyle();
  };

  return (
    <>
      {/* Appearance Controls Menu (A button) */}
      <div className={styles.appearanceMenu}>
        <button
          className={`${styles.appearanceTrigger} ${state.activeRegion === null ? styles.active : ''}`}
          onClick={selectGlobalView}
          title="전체 뷰"
        >
          <i className="fas fa-font"></i>
        </button>
        <div className={styles.appearancePanel}>
          <div className={styles.appearanceItem}>
            <span className={styles.appearanceLabel}>스타일</span>
            <select
              className={styles.appearanceSelect}
              value={
                state.activeRegion !== null
                  ? state.regions.find(r => r.id === state.activeRegion)?.style || 'cartoon'
                  : (state.showSilhouette ? 'silhouette' : state.currentStyle)
              }
              onChange={handleStyleChange}
            >
              <option value="cartoon">Cartoon</option>
              <option value="stick">Stick</option>
              <option value="sphere">Sphere</option>
              <option value="line">Line</option>
              <option value="ribbon">Ribbon</option>
              <option value="silhouette">Silhouette</option>
            </select>
          </div>
          <div className={styles.appearanceItem}>
            <span className={styles.appearanceLabel}>색상</span>
            <select
              className={styles.appearanceSelect}
              value={
                state.activeRegion !== null
                  ? state.regions.find(r => r.id === state.activeRegion)?.color || 'spectrum'
                  : state.currentColor
              }
              onChange={handleColorChange}
            >
              <option value="spectrum">스펙트럼</option>
              <option value="chain">체인별</option>
              <option value="element">원자별</option>
              <option value="ss">이차구조</option>
              <option value="bfactor">B-factor</option>
            </select>
          </div>
          <div className={styles.appearanceItem}>
            <button
              className={styles.appearanceResetBtn}
              onClick={handleResetStyle}
              title="초기화"
            >
              <i className="fas fa-undo"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Region Buttons Container */}
      {state.regions.length > 0 && (
        <div className={styles.regionButtons}>
          {state.regions.map((region) => (
            <div key={region.id} className={styles.regionContainer}>
              <button
                className={`${styles.regionBtn} ${state.activeRegion === region.id ? styles.active : ''}`}
                onClick={() => selectRegion(region.id)}
                title={`영역 ${region.id}`}
              >
                {region.id}
              </button>
              <div className={styles.regionPanel}>
                <div className={styles.regionPanelItem}>
                  <span className={styles.appearanceLabel}>스타일</span>
                  <select
                    className={styles.regionSelect}
                    value={region.style}
                    onChange={(e) => {
                      dispatch({
                        type: 'UPDATE_REGION_STYLE',
                        payload: { id: region.id, style: e.target.value as StyleType }
                      });
                      applyViewerStyle();
                    }}
                  >
                    <option value="cartoon">Cartoon</option>
                    <option value="stick">Stick</option>
                    <option value="sphere">Sphere</option>
                    <option value="line">Line</option>
                    <option value="ribbon">Ribbon</option>
                    <option value="silhouette">Silhouette</option>
                  </select>
                </div>
                <div className={styles.regionPanelItem}>
                  <span className={styles.appearanceLabel}>색상</span>
                  <select
                    className={styles.regionSelect}
                    value={region.color}
                    onChange={(e) => {
                      dispatch({
                        type: 'UPDATE_REGION_COLOR',
                        payload: { id: region.id, color: e.target.value as ColorScheme }
                      });
                      applyViewerStyle();
                    }}
                  >
                    <option value="spectrum">스펙트럼</option>
                    <option value="chain">체인별</option>
                    <option value="element">원자별</option>
                    <option value="ss">이차구조</option>
                    <option value="bfactor">B-factor</option>
                  </select>
                </div>
                <div className={styles.regionPanelItem}>
                  <button
                    className={styles.appearanceResetBtn}
                    onClick={() => {
                      dispatch({
                        type: 'UPDATE_REGION_STYLE',
                        payload: { id: region.id, style: 'cartoon' }
                      });
                      dispatch({
                        type: 'UPDATE_REGION_COLOR',
                        payload: { id: region.id, color: 'spectrum' }
                      });
                      applyViewerStyle();
                    }}
                    title="초기화"
                  >
                    <i className="fas fa-undo"></i>
                  </button>
                </div>
                <div className={styles.regionPanelItem}>
                  <button
                    className={styles.regionDeleteBtn}
                    onClick={() => {
                      dispatch({ type: 'DELETE_REGION', payload: region.id });
                      applyViewerStyle();
                    }}
                    title="영역 삭제"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Region Button */}
      <button
        className={styles.addRegionBtn}
        onClick={handleAddRegion}
        title="영역 추가"
      >
        <i className="fas fa-plus"></i>
      </button>
    </>
  );
};
