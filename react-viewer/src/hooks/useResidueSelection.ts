// ============================================
// Custom Hook for Residue Selection
// ============================================

import { useCallback, useEffect } from 'react';
import { ViewerState, ViewerAction } from '../types';

export const useResidueSelection = (
  viewer: any,
  state: ViewerState,
  dispatch: React.Dispatch<ViewerAction>,
  applyViewerStyle: () => void
) => {
  // Show residue label on hover
  const showResidueLabel = useCallback((atom: any) => {
    if (!viewer) return;

    // Remove all labels and re-add
    viewer.removeAllLabels?.();

    // Add labels for all selected residues (same style as hover)
    const residuesToLabel = state.activeRegion !== null
      ? (state.regions.find(r => r.id === state.activeRegion)?.selectedResidues || new Set())
      : state.selectedResidues;

    residuesToLabel.forEach(resKey => {
      const [chain, resi] = resKey.split(':');
      const resiNum = parseInt(resi);

      const model = viewer.getModel();
      if (!model) return;

      const atoms = model.selectedAtoms({ chain, resi: resiNum, atom: 'CA', hetflag: false });
      if (atoms.length > 0) {
        const caAtom = atoms[0];
        const atomName = caAtom.atom || caAtom.elem || '';
        const label = atomName ? `${caAtom.resn}${resiNum} (${atomName})` : `${caAtom.resn}${resiNum}`;

        viewer.addLabel(label, {
          position: { x: caAtom.x, y: caAtom.y, z: caAtom.z },
          backgroundColor: 'rgba(0,0,0,0.7)',
          fontColor: 'white',
          fontSize: 12,
          showBackground: true,
          backgroundOpacity: 0.7
        });
      }
    });

    // Add hover label for current atom
    const atomName = atom.atom || atom.elem || '';
    const label = atomName ? `${atom.resn}${atom.resi} (${atomName})` : `${atom.resn}${atom.resi}`;

    viewer.addLabel(label, {
      position: { x: atom.x, y: atom.y, z: atom.z },
      backgroundColor: 'rgba(0,0,0,0.7)',
      fontColor: 'white',
      fontSize: 12,
      showBackground: true,
      backgroundOpacity: 0.7
    });

    viewer.render();
  }, [viewer, state.selectedResidues, state.activeRegion, state.regions]);

  // Hide residue label (but keep labels for selected residues)
  const hideResidueLabel = useCallback(() => {
    if (!viewer) return;

    // Remove all labels first
    viewer.removeAllLabels?.();

    // Re-add labels for selected residues (same style as hover)
    const residuesToLabel = state.activeRegion !== null
      ? (state.regions.find(r => r.id === state.activeRegion)?.selectedResidues || new Set())
      : state.selectedResidues;

    residuesToLabel.forEach(resKey => {
      const [chain, resi] = resKey.split(':');
      const resiNum = parseInt(resi);

      const model = viewer.getModel();
      if (!model) return;

      const atoms = model.selectedAtoms({ chain, resi: resiNum, atom: 'CA', hetflag: false });
      if (atoms.length > 0) {
        const caAtom = atoms[0];
        const atomName = caAtom.atom || caAtom.elem || '';
        const label = atomName ? `${caAtom.resn}${resiNum} (${atomName})` : `${caAtom.resn}${resiNum}`;

        viewer.addLabel(label, {
          position: { x: caAtom.x, y: caAtom.y, z: caAtom.z },
          backgroundColor: 'rgba(0,0,0,0.7)',
          fontColor: 'white',
          fontSize: 12,
          showBackground: true,
          backgroundOpacity: 0.7
        });
      }
    });

    viewer.render();
  }, [viewer, state.selectedResidues, state.activeRegion, state.regions]);

  // Setup click and hover interactions
  // Re-run whenever applyViewerStyle might have reset the handlers
  useEffect(() => {
    if (!viewer) {
      console.log('[useResidueSelection] Viewer not ready');
      return;
    }

    console.log('[useResidueSelection] Setting up click and hover handlers');

    let atomClicked = false;
    let mouseDownPos: { x: number; y: number } | null = null;
    let currentModifiers = { ctrl: false, shift: false };
    let mouseButton = 0;

    // Setup click handler for residue selection
    viewer.setClickable({}, true, (atom: any) => {
      console.log('[useResidueSelection] Click detected on atom:', atom);
      if (atom) {
        atomClicked = true;

        // Middle button (wheel click): same behavior but skip visualization
        if (mouseButton === 1) {
          dispatch({ type: 'SET_SKIP_VISUALIZATION', payload: true });
        } else {
          dispatch({ type: 'SET_SKIP_VISUALIZATION', payload: false });
        }

        toggleResidueSelection(atom.chain, atom.resi, atom.resn, currentModifiers.ctrl, currentModifiers.shift);
      }
    });

    // Setup hover handler for residue labels
    viewer.setHoverable(
      {},
      true,
      (atom: any) => {
        console.log('[useResidueSelection] Hover on atom:', atom);
        if (atom) {
          showResidueLabel(atom);
        }
      },
      () => {
        console.log('[useResidueSelection] Hover off');
        hideResidueLabel();
      }
    );

    // Track mouse events
    const viewerContainer = viewer.container;
    if (viewerContainer) {
      const handleMouseDown = (event: MouseEvent) => {
        mouseDownPos = { x: event.clientX, y: event.clientY };
        mouseButton = event.button;
        currentModifiers.ctrl = event.ctrlKey || event.metaKey;
        currentModifiers.shift = event.shiftKey;
      };

      const handleMouseUp = (event: MouseEvent) => {
        if (!mouseDownPos) return;

        const dx = event.clientX - mouseDownPos.x;
        const dy = event.clientY - mouseDownPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 5) {
          setTimeout(() => {
            if (!atomClicked && state.selectedResidues.size > 0) {
              if (!currentModifiers.ctrl && !currentModifiers.shift) {
                clearSelection();
              }
            }
            atomClicked = false;
          }, 10);
        } else {
          atomClicked = false;
        }

        mouseDownPos = null;
      };

      viewerContainer.addEventListener('mousedown', handleMouseDown);
      viewerContainer.addEventListener('mouseup', handleMouseUp);

      return () => {
        viewerContainer.removeEventListener('mousedown', handleMouseDown);
        viewerContainer.removeEventListener('mouseup', handleMouseUp);
      };
    }
    // Re-run when applyViewerStyle changes to restore handlers after setStyle() calls
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, showResidueLabel, hideResidueLabel, applyViewerStyle]);

  // Apply styles when selection or nearby residues change
  useEffect(() => {
    if (!viewer || !state.pdbData) return;

    // Small delay to batch state updates
    const timer = setTimeout(() => {
      applyViewerStyle();
    }, 10);

    return () => clearTimeout(timer);
  }, [viewer, state.pdbData, state.selectedResidues, state.nearbyResidues, applyViewerStyle]);

  // Toggle residue selection
  const toggleResidueSelection = useCallback(
    (chain: string, resi: number, _resn: string, ctrlKey = false, shiftKey = false) => {
      const resKey = `${chain}:${resi}`;
      let newSelected: Set<string>;

      if (shiftKey && state.lastSelectedResidue) {
        // Shift-click: select range
        newSelected = selectResidueRangeSync(state.lastSelectedResidue, { chain, resi });
        dispatch({ type: 'SET_SELECTED_RESIDUES', payload: newSelected });
        dispatch({ type: 'SET_LAST_SELECTED_RESIDUE', payload: { chain, resi } });
      } else if (ctrlKey) {
        // Ctrl-click: toggle selection
        newSelected = new Set(state.selectedResidues);
        if (newSelected.has(resKey)) {
          newSelected.delete(resKey);
          dispatch({ type: 'SET_SELECTED_RESIDUES', payload: newSelected });
        } else {
          newSelected.add(resKey);
          dispatch({ type: 'SET_SELECTED_RESIDUES', payload: newSelected });
          dispatch({ type: 'SET_LAST_SELECTED_RESIDUE', payload: { chain, resi } });
        }
      } else {
        // Normal click: clear previous and select new
        newSelected = new Set<string>();
        newSelected.add(resKey);
        dispatch({ type: 'SET_SELECTED_RESIDUES', payload: newSelected });
        dispatch({ type: 'SET_LAST_SELECTED_RESIDUE', payload: { chain, resi } });
      }

      // Update nearby residues with new selection
      let nearbySet = new Set<string>();
      if (state.showNearby && newSelected.size > 0) {
        nearbySet = updateNearbyResiduesSync(newSelected);
        dispatch({ type: 'SET_NEARBY_RESIDUES', payload: nearbySet });
      } else {
        dispatch({ type: 'SET_NEARBY_RESIDUES', payload: new Set() });
      }

      // Save to active region
      if (state.activeRegion !== null) {
        dispatch({
          type: 'UPDATE_REGION',
          payload: {
            id: state.activeRegion,
            selectedResidues: newSelected,
            nearbyResidues: nearbySet
          }
        });
      }

      // Zoom to selection immediately (don't wait for state update)
      if (viewer && newSelected.size > 0) {
        setTimeout(() => {
          const selection: any[] = [];
          newSelected.forEach(resKey => {
            const [chain, resi] = resKey.split(':');
            selection.push({ chain, resi: parseInt(resi) });
          });
          console.log('[toggleResidueSelection] Zooming to', selection.length, 'residues');
          viewer.zoomTo({ or: selection }, 1000);
          viewer.render();
        }, 50);
      }
    },
    [viewer, state, dispatch]
  );

  // Select range of residues (synchronous version that returns the set)
  const selectResidueRangeSync = (start: { chain: string; resi: number }, end: { chain: string; resi: number }): Set<string> => {
    const newSelected = new Set(state.selectedResidues);

    if (start.chain !== end.chain) {
      newSelected.add(`${end.chain}:${end.resi}`);
      return newSelected;
    }

    const chain = start.chain;
    const minResi = Math.min(start.resi, end.resi);
    const maxResi = Math.max(start.resi, end.resi);

    if (state.sequenceData[chain]) {
      state.sequenceData[chain].forEach(res => {
        if (res.resSeq >= minResi && res.resSeq <= maxResi) {
          newSelected.add(`${chain}:${res.resSeq}`);
        }
      });
    }

    return newSelected;
  };

  // Update nearby residues (synchronous version that returns the set)
  const updateNearbyResiduesSync = (selectedResidues: Set<string>): Set<string> => {
    if (!viewer || selectedResidues.size === 0) {
      return new Set();
    }

    const selectedAtoms: any[] = [];
    selectedResidues.forEach(resKey => {
      const [chain, resi] = resKey.split(':');
      const atoms = viewer.selectedAtoms({ chain, resi: parseInt(resi) });
      selectedAtoms.push(...atoms);
    });

    const allAtoms = viewer.selectedAtoms({ hetflag: false });
    const cutoff = 4.0;
    const nearby = new Set<string>();

    allAtoms.forEach((atom: any) => {
      const resKey = `${atom.chain}:${atom.resi}`;
      if (selectedResidues.has(resKey)) return;

      for (const selAtom of selectedAtoms) {
        const dist = Math.sqrt(
          Math.pow(atom.x - selAtom.x, 2) +
          Math.pow(atom.y - selAtom.y, 2) +
          Math.pow(atom.z - selAtom.z, 2)
        );
        if (dist <= cutoff) {
          nearby.add(resKey);
          break;
        }
      }
    });

    return nearby;
  };

  // Update nearby residues (async version for external calls)
  const updateNearbyResidues = () => {
    const nearby = updateNearbyResiduesSync(state.selectedResidues);
    dispatch({ type: 'SET_NEARBY_RESIDUES', payload: nearby });
  };

  // Clear selection
  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTED_RESIDUES' });
    dispatch({ type: 'SET_NEARBY_RESIDUES', payload: new Set() });

    if (state.activeRegion !== null) {
      dispatch({
        type: 'UPDATE_REGION',
        payload: {
          id: state.activeRegion,
          selectedResidues: new Set(),
          nearbyResidues: new Set()
        }
      });
    }
    // useEffect will automatically apply styles when state changes
  }, [dispatch, state.activeRegion]);

  return {
    toggleResidueSelection,
    clearSelection,
    updateNearbyResidues
  };
};
