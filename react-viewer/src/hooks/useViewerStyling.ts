// ============================================
// Custom Hook for Viewer Styling
// ============================================

import { useCallback } from 'react';
import { ViewerState, Region, ColorScheme } from '../types';
import { cmykColors, positiveResidues, negativeResidues, ionResidues } from '../utils/constants';
import { renderGlycans, getGlycansForChain } from '../utils/glycanVisualizer';

export const useViewerStyling = (
  viewer: any,
  state: ViewerState
) => {
  // Apply current style to viewer
  const applyViewerStyle = useCallback(() => {
    if (!viewer) return;

    viewer.removeAllShapes();

    const style = state.currentStyle;
    const colorScheme = state.currentColor;

    console.log('[useViewerStyling] Applying style:', style, 'showSilhouette:', state.showSilhouette);

    // For silhouette mode, completely override lighting system
    if (style === 'silhouette') {
      if (viewer.glviewer && viewer.glviewer.scene) {
        const THREE = (window as any).THREE;
        if (THREE) {
          // Remove ALL existing lights
          const lightsToRemove: any[] = [];
          viewer.glviewer.scene.traverse((object: any) => {
            if (object.isLight) {
              lightsToRemove.push(object);
            }
          });
          lightsToRemove.forEach(light => viewer.glviewer.scene.remove(light));

          // Add only a single, ultra-bright ambient light (no shadows, no direction)
          const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
          viewer.glviewer.scene.add(ambientLight);

          // Store reference for cleanup
          (viewer as any).__silhouetteLight = ambientLight;
        }
      }
    } else {
      // Restore original lighting
      if (viewer.glviewer && viewer.glviewer.scene && (viewer as any).__silhouetteLight) {
        viewer.glviewer.scene.remove((viewer as any).__silhouetteLight);
        delete (viewer as any).__silhouetteLight;

        // Re-add default 3DMol lights
        const THREE = (window as any).THREE;
        if (THREE) {
          const light1 = new THREE.DirectionalLight(0xFFFFFF, 0.8);
          light1.position.set(0.2, 0.2, 1);
          viewer.glviewer.scene.add(light1);

          const light2 = new THREE.DirectionalLight(0xFFFFFF, 0.5);
          light2.position.set(-1, -1, -1);
          viewer.glviewer.scene.add(light2);
        }
      }
    }

    // Build style specification
    const styleSpec: any = {};

    switch (style) {
      case 'cartoon':
        styleSpec.cartoon = {
          style: 'oval',
          opacity: 1.0,           // Full opacity for solid look
          shininess: 0,           // No shininess
          ambient: 1.0,           // Maximum ambient (flat lighting)
          diffuse: 0.0,           // No diffuse (no directional shading)
          specular: 0.0,          // No specular highlights
          emissive: 0.0,          // No emissive glow
          // Add outline/silhouette effect if enabled
          ...(state.showSilhouette && {
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.02
          })
        };
        break;
      case 'stick':
        styleSpec.stick = {
          colorscheme: 'default',  // Use element colors
          ...(state.showSilhouette && {
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.02
          })
        };
        break;
      case 'sphere':
        styleSpec.sphere = {
          scale: 0.25,
          ...(state.showSilhouette && {
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.02
          })
        };
        break;
      case 'line':
        styleSpec.line = {
          colorscheme: 'default',  // Use element colors
          ...(state.showSilhouette && {
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.02
          })
        };
        break;
      case 'ribbon':
        styleSpec.ribbon = {
          ...(state.showSilhouette && {
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.02
          })
        };
        break;
      case 'silhouette':
        console.log('[useViewerStyling] Silhouette case - applying 2D-like rendering');
        // Silhouette style: 2D-like rendering with strong outline and NO lighting/shadows
        styleSpec.cartoon = {
          style: 'oval',
          outline: true,
          outlineColor: 'black',
          outlineWidth: 0.2,      // Very thick outline for strong 2D effect
          opacity: 1.0,           // Full opacity for solid look
          shininess: 0,           // No shininess
          ambient: 1.0,           // Maximum ambient (flat lighting)
          diffuse: 0.0,           // No diffuse (no directional shading)
          specular: 0.0,          // No specular highlights
          emissive: 0.0           // No emissive glow
        };
        break;
    }

    console.log('[useViewerStyling] styleSpec:', JSON.stringify(styleSpec, null, 2));

    // If a chain is selected, hide all chains first, then show only selected chain
    if (state.selectedChain) {
      viewer.setStyle({}, {}); // Hide all
      viewer.setStyle({ chain: state.selectedChain }, styleSpec); // Show selected chain
    } else {
      // Show all chains
      viewer.setStyle({}, styleSpec);
    }

    // Apply color scheme for global style
    applyColorScheme(style, colorScheme);

    // Apply region-specific styles (always overlay region styles on top of global style)
    state.regions.forEach(region => {
      applyRegionStyle(region);
    });

    // Re-apply selection styles
    applySelectionStyles();

    // Visualize HETATMs
    visualizeHetAtoms();

    // Render glycans
    visualizeGlycans();

    // Re-draw interaction lines after all other visualizations
    addInteractionLines();

    // For silhouette mode, patch the render function to override colors
    if (style === 'silhouette' && viewer.glviewer) {
      // Store original render if not already stored
      if (!(viewer as any).__originalRender) {
        (viewer as any).__originalRender = viewer.glviewer.render.bind(viewer.glviewer);
      }

      // Override render function to force uniform colors
      const glviewer = viewer.glviewer;
      viewer.glviewer.render = function(this: any) {
        // Call original render
        (viewer as any).__originalRender();

        // After rendering, override all mesh materials
        const THREE = (window as any).THREE;
        if (THREE && glviewer.scene) {
          glviewer.scene.traverse((object: any) => {
            if (object.isMesh && object.material) {
              const materials = Array.isArray(object.material) ? object.material : [object.material];

              materials.forEach((mat: any, idx: number) => {
                // Skip outline materials
                if (mat.type === 'LineBasicMaterial') return;

                // Get base color from material
                const baseColor = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);

                // Replace with unlit material
                const newMat = new THREE.MeshBasicMaterial({
                  color: baseColor,
                  vertexColors: false,
                  opacity: mat.opacity || 1.0,
                  transparent: mat.transparent || false,
                  side: THREE.DoubleSide,
                  flatShading: true
                });

                if (Array.isArray(object.material)) {
                  object.material[idx] = newMat;
                } else {
                  object.material = newMat;
                }
              });
            }
          });
        }
      }.bind(glviewer);
    } else if ((viewer as any).__originalRender) {
      // Restore original render function
      viewer.glviewer.render = (viewer as any).__originalRender;
      delete (viewer as any).__originalRender;
    }

    viewer.render();
  }, [viewer, state.currentStyle, state.currentColor, state.selectedResidues, state.nearbyResidues, state.regions, state.activeRegion, state.showNearby, state.showResidueVisualization, state.skipVisualization, state.hetAtoms, state.showHetAtoms, state.selectedChain, state.glycans, state.showGlycans, state.showSilhouette]);

  // Apply color scheme
  const applyColorScheme = (style: string, colorScheme: string) => {
    if (!viewer) return;

    switch (colorScheme) {
      case 'spectrum':
        applySpectrumColors(style);
        break;
      case 'chain':
        applyChainColors(style);
        break;
      case 'element':
        applyElementColors(style);
        break;
      case 'ss':
        applySSColors(style);
        break;
      case 'bfactor':
        applyBFactorColors(style);
        break;
    }
  };

  // Apply spectrum colors
  const applySpectrumColors = (style: string) => {
    const model = viewer.getModel();
    if (!model) return;

    const selector = state.selectedChain ? { chain: state.selectedChain } : {};
    const atoms = model.selectedAtoms(selector);
    if (atoms.length === 0) return;

    let minResi = Infinity, maxResi = -Infinity;
    atoms.forEach((atom: any) => {
      if (atom.resi < minResi) minResi = atom.resi;
      if (atom.resi > maxResi) maxResi = atom.resi;
    });

    const range = maxResi - minResi || 1;

    atoms.forEach((atom: any) => {
      const progress = (atom.resi - minResi) / range;
      const colorIndex = Math.floor(progress * (cmykColors.spectrum.length - 1));
      const color = cmykColors.spectrum[colorIndex];

      const styleSpec: any = {};
      switch (style) {
        case 'cartoon':
          styleSpec.cartoon = {
            style: 'oval',
            color,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
        case 'stick':
          // For stick, use cartoon color for C atoms, element colors for others
          styleSpec.stick = {
            colorscheme: {
              prop: 'elem',
              map: { 'C': color }
            }
          };
          break;
        case 'sphere':
          styleSpec.sphere = { color, scale: 0.25 };
          break;
        case 'line':
          styleSpec.line = { colorscheme: 'default' };  // Use element colors
          break;
        case 'ribbon':
          styleSpec.ribbon = { color };
          break;
        case 'silhouette':
          styleSpec.cartoon = {
            style: 'oval',
            color,
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.2,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
      }

      viewer.setStyle({ chain: atom.chain, resi: atom.resi }, styleSpec);
    });
  };

  // Apply chain colors
  const applyChainColors = (style: string) => {
    const chains = state.selectedChain ? [state.selectedChain] : Object.keys(state.sequenceData);
    chains.forEach((chain, idx) => {
      const color = cmykColors.chain[idx % cmykColors.chain.length];
      const chainStyleSpec: any = {};

      switch (style) {
        case 'cartoon':
          chainStyleSpec.cartoon = {
            style: 'oval',
            color,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
        case 'stick':
          // For stick, use cartoon color for C atoms, element colors for others
          chainStyleSpec.stick = {
            colorscheme: {
              prop: 'elem',
              map: { 'C': color }
            }
          };
          break;
        case 'sphere':
          chainStyleSpec.sphere = { color, scale: 0.25 };
          break;
        case 'line':
          chainStyleSpec.line = { colorscheme: 'default' };  // Use element colors
          break;
        case 'ribbon':
          chainStyleSpec.ribbon = { color };
          break;
        case 'silhouette':
          chainStyleSpec.cartoon = {
            style: 'oval',
            color,
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.2,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
      }

      viewer.setStyle({ chain }, chainStyleSpec);
    });
  };

  // Apply element colors
  const applyElementColors = (style: string) => {
    Object.keys(cmykColors.element).forEach(elem => {
      if (elem === 'default') return;

      const color = cmykColors.element[elem];
      const styleSpec: any = {};

      switch (style) {
        case 'cartoon':
          styleSpec.cartoon = {
            style: 'oval',
            color,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
        case 'stick':
          // For stick, use cartoon color for C atoms, element colors for others
          styleSpec.stick = {
            colorscheme: {
              prop: 'elem',
              map: { 'C': color }
            }
          };
          break;
        case 'sphere':
          styleSpec.sphere = { color, scale: 0.25 };
          break;
        case 'line':
          styleSpec.line = { colorscheme: 'default' };  // Use element colors
          break;
        case 'ribbon':
          styleSpec.ribbon = { color };
          break;
        case 'silhouette':
          styleSpec.cartoon = {
            style: 'oval',
            color,
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.2,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
      }

      const selector = state.selectedChain ? { chain: state.selectedChain, elem } : { elem };
      viewer.setStyle(selector, styleSpec);
    });
  };

  // Apply secondary structure colors
  const applySSColors = (style: string) => {
    const ssStyles = [
      { ss: 'h', color: cmykColors.ss.helix },
      { ss: 's', color: cmykColors.ss.sheet },
      { ss: 'c', color: cmykColors.ss.coil }
    ];

    ssStyles.forEach(({ ss, color }) => {
      const ssStyleSpec: any = {};

      switch (style) {
        case 'cartoon':
          ssStyleSpec.cartoon = {
            style: 'oval',
            color,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
        case 'stick':
          // For stick, use cartoon color for C atoms, element colors for others
          ssStyleSpec.stick = {
            colorscheme: {
              prop: 'elem',
              map: { 'C': color }
            }
          };
          break;
        case 'sphere':
          ssStyleSpec.sphere = { color, scale: 0.25 };
          break;
        case 'line':
          ssStyleSpec.line = { colorscheme: 'default' };  // Use element colors
          break;
        case 'ribbon':
          ssStyleSpec.ribbon = { color };
          break;
        case 'silhouette':
          ssStyleSpec.cartoon = {
            color,
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.15,
            style: 'edged',
            thickness: 0.3,
            arrows: true,
            tubes: false,
            opacity: 1.0
          };
          break;
      }

      const selector = state.selectedChain ? { chain: state.selectedChain, ss } : { ss };
      viewer.setStyle(selector, ssStyleSpec);
    });
  };

  // Apply B-factor colors
  const applyBFactorColors = (style: string) => {
    const model = viewer.getModel();
    if (!model) return;

    const selector = state.selectedChain ? { chain: state.selectedChain } : {};
    const atoms = model.selectedAtoms(selector);
    if (atoms.length === 0) return;

    let minB = Infinity, maxB = -Infinity;
    atoms.forEach((atom: any) => {
      if (atom.b !== undefined) {
        if (atom.b < minB) minB = atom.b;
        if (atom.b > maxB) maxB = atom.b;
      }
    });

    const range = maxB - minB || 1;

    atoms.forEach((atom: any) => {
      if (atom.b === undefined) return;

      const progress = (atom.b - minB) / range;
      const colorIndex = Math.floor(progress * (cmykColors.bfactor.length - 1));
      const color = cmykColors.bfactor[colorIndex];

      const styleSpec: any = {};
      switch (style) {
        case 'cartoon':
          styleSpec.cartoon = {
            style: 'oval',
            color,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
        case 'stick':
          // For stick, use cartoon color for C atoms, element colors for others
          styleSpec.stick = {
            colorscheme: {
              prop: 'elem',
              map: { 'C': color }
            }
          };
          break;
        case 'sphere':
          styleSpec.sphere = { color, scale: 0.25 };
          break;
        case 'line':
          styleSpec.line = { colorscheme: 'default' };  // Use element colors
          break;
        case 'ribbon':
          styleSpec.ribbon = { color };
          break;
        case 'silhouette':
          styleSpec.cartoon = {
            style: 'oval',
            color,
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.2,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
      }

      viewer.setStyle({ chain: atom.chain, resi: atom.resi }, styleSpec);
    });
  };

  // Apply region-specific style
  const applyRegionStyle = (region: Region) => {
    if (!viewer) return;

    const model = viewer.getModel();
    if (!model) return;

    // Get all residues in this region (both selected and nearby)
    const allResidues = new Set([...region.selectedResidues, ...region.nearbyResidues]);

    allResidues.forEach(resKey => {
      const [chain, resi] = resKey.split(':');
      const resiNum = parseInt(resi);

      // Build style spec based on region's style
      let regionStyleSpec: any = {};

      switch (region.style) {
        case 'cartoon':
          regionStyleSpec.cartoon = {
            style: 'oval',
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
        case 'stick':
          regionStyleSpec.stick = { colorscheme: 'default' };
          break;
        case 'sphere':
          regionStyleSpec.sphere = { scale: 0.25 };
          break;
        case 'line':
          regionStyleSpec.line = { colorscheme: 'default' };
          break;
        case 'ribbon':
          regionStyleSpec.ribbon = {};
          break;
        case 'silhouette':
          regionStyleSpec.cartoon = {
            style: 'oval',
            outline: true,
            outlineColor: 'black',
            outlineWidth: 0.2,
            opacity: 1.0,
            shininess: 0,
            ambient: 1.0,
            diffuse: 0.0,
            specular: 0.0,
            emissive: 0.0
          };
          break;
      }

      // Apply color based on region's color scheme
      const color = getRegionResidueColor(chain, resiNum, region.color);

      // Add color to style spec
      if (region.style === 'cartoon' || region.style === 'silhouette') {
        regionStyleSpec.cartoon = { ...regionStyleSpec.cartoon, color };
      } else if (region.style === 'stick') {
        // For stick, use cartoon color for C atoms, element colors for others
        regionStyleSpec.stick = {
          colorscheme: {
            prop: 'elem',
            map: {
              'C': color,  // Carbon uses cartoon color
              // Other elements use default colors (handled by 3Dmol)
            }
          }
        };
      } else if (region.style === 'sphere') {
        regionStyleSpec.sphere = { ...regionStyleSpec.sphere, color };
      } else if (region.style === 'line') {
        // Line always uses element colors (colorscheme: 'default')
      } else if (region.style === 'ribbon') {
        regionStyleSpec.ribbon = { ...regionStyleSpec.ribbon, color };
      }

      // Use addStyle to overlay on top of global style instead of replacing it
      viewer.addStyle({ chain, resi: resiNum }, regionStyleSpec);
    });
  };

  // Get color for residue in region based on color scheme
  const getRegionResidueColor = (chain: string, resi: number, colorScheme: ColorScheme): string => {
    const model = viewer?.getModel();
    if (!model) return cmykColors.spectrum[0];

    const atoms = model.selectedAtoms({ chain, resi });
    if (atoms.length === 0) return cmykColors.spectrum[0];

    switch (colorScheme) {
      case 'spectrum': {
        const selector = state.selectedChain ? { chain: state.selectedChain } : {};
        const allAtoms = model.selectedAtoms(selector);
        if (allAtoms.length === 0) return cmykColors.spectrum[0];

        let minResi = Infinity, maxResi = -Infinity;
        allAtoms.forEach((atom: any) => {
          if (atom.resi < minResi) minResi = atom.resi;
          if (atom.resi > maxResi) maxResi = atom.resi;
        });

        const range = maxResi - minResi || 1;
        const progress = (resi - minResi) / range;
        const colorIndex = Math.floor(progress * (cmykColors.spectrum.length - 1));
        return cmykColors.spectrum[colorIndex];
      }
      case 'chain': {
        const chains = state.selectedChain ? [state.selectedChain] : Object.keys(state.sequenceData);
        const chainIdx = chains.indexOf(chain);
        return cmykColors.chain[chainIdx % cmykColors.chain.length];
      }
      case 'element': {
        const elem = atoms[0].elem || 'C';
        return cmykColors.element[elem] || cmykColors.element['C'];
      }
      case 'ss': {
        const ss = atoms[0].ss || 'c';
        if (ss === 'h') return cmykColors.ss.helix;
        if (ss === 's') return cmykColors.ss.sheet;
        return cmykColors.ss.coil;
      }
      case 'bfactor': {
        const bfactor = atoms[0].b || 0;
        const bIndex = Math.min(Math.floor(bfactor / 10), cmykColors.bfactor.length - 1);
        return cmykColors.bfactor[bIndex];
      }
      default:
        return cmykColors.spectrum[0];
    }
  };

  // Apply selection styles
  const applySelectionStyles = () => {
    if (!viewer || state.skipVisualization) return;

    const model = viewer.getModel();
    if (!model) return;

    // Only apply ball and stick if visualization is enabled
    if (state.showResidueVisualization) {
      // Render selections based on active region or global mode
      if (state.activeRegion !== null) {
        const region = state.regions.find(r => r.id === state.activeRegion);
        if (region) {
          region.selectedResidues.forEach(resKey => {
            const [chain, resi] = resKey.split(':');
            const resiNum = parseInt(resi);
            const residueColor = getResidueColor(chain, resiNum, region.color);
            applyBallAndStick(chain, resiNum, residueColor);
          });

          if (state.showNearby) {
            region.nearbyResidues.forEach(resKey => {
              if (!region.selectedResidues.has(resKey)) {
                const [chain, resi] = resKey.split(':');
                const resiNum = parseInt(resi);
                const residueColor = getResidueColor(chain, resiNum, region.color);
                applyBallAndStick(chain, resiNum, residueColor);
              }
            });
          }
        }
      } else {
        state.selectedResidues.forEach(resKey => {
          const [chain, resi] = resKey.split(':');
          const resiNum = parseInt(resi);
          const residueColor = getResidueColor(chain, resiNum);
          applyBallAndStick(chain, resiNum, residueColor);
        });

        if (state.showNearby) {
          state.nearbyResidues.forEach(resKey => {
            if (!state.selectedResidues.has(resKey)) {
              const [chain, resi] = resKey.split(':');
              const resiNum = parseInt(resi);
              const residueColor = getResidueColor(chain, resiNum);
              applyBallAndStick(chain, resiNum, residueColor);
            }
          });
        }
      }
    }

    // Always draw interaction lines if residues are selected
    addInteractionLines();
  };

  // Apply ball and stick visualization
  const applyBallAndStick = (chain: string, resi: number, baseColor: string) => {
    const model = viewer.getModel();
    if (!model) return;

    const selector = { chain, resi, hetflag: false };
    const atoms = model.selectedAtoms(selector);

    const stickRadius = 0.2;
    const sphereRadius = 0.3;
    const hStickRadius = 0.1;
    const hSphereRadius = 0.2;

    atoms.forEach((atom: any) => {
      const element = atom.elem || 'C';
      let color;

      if (element === 'C') {
        color = baseColor;
      } else {
        color = cmykColors.element[element] || cmykColors.element.default;
      }

      viewer.addStyle(
        { chain: atom.chain, resi: atom.resi, serial: atom.serial, hetflag: false },
        {
          stick: {
            color,
            radius: element === 'H' ? hStickRadius : stickRadius,
            hidden: false
          },
          sphere: {
            color,
            radius: element === 'H' ? hSphereRadius : sphereRadius
          }
        }
      );
    });
  };

  // Add interaction lines (hydrogen bonds and salt bridges)
  const addInteractionLines = () => {
    const model = viewer.getModel();
    if (!model) return;

    const drawInteractions = (selectedResidues: Set<string>, nearbyResidues: Set<string>) => {
      console.log('[Interactions] Selected:', selectedResidues.size, 'Nearby:', nearbyResidues.size);

      if (selectedResidues.size === 0 || nearbyResidues.size === 0) {
        console.log('[Interactions] Skipping - no residues');
        return;
      }

      const selectedAtoms: any[] = [];
      selectedResidues.forEach(resKey => {
        const [chain, resi] = resKey.split(':');
        const atoms = model.selectedAtoms({ chain, resi: parseInt(resi), hetflag: false });
        atoms.forEach((atom: any) => {
          atom.resKey = resKey;
          selectedAtoms.push(atom);
        });
      });

      const nearbyAtoms: any[] = [];
      nearbyResidues.forEach(resKey => {
        if (!selectedResidues.has(resKey)) {
          const [chain, resi] = resKey.split(':');
          const atoms = model.selectedAtoms({ chain, resi: parseInt(resi), hetflag: false });
          atoms.forEach((atom: any) => {
            atom.resKey = resKey;
            nearbyAtoms.push(atom);
          });
        }
      });

      console.log('[Interactions] Selected atoms:', selectedAtoms.length, 'Nearby atoms:', nearbyAtoms.length);

      // Debug: Log first atom's properties
      if (selectedAtoms.length > 0) {
        console.log('[Debug] First selected atom properties:', Object.keys(selectedAtoms[0]));
        console.log('[Debug] First selected atom:', selectedAtoms[0]);
      }
      if (nearbyAtoms.length > 0) {
        console.log('[Debug] First nearby atom properties:', Object.keys(nearbyAtoms[0]));
      }

      let saltBridgeCount = 0;
      let hBondCount = 0;
      let candidateCount = 0;

      selectedAtoms.forEach(atom1 => {
        nearbyAtoms.forEach(atom2 => {
          const dx = atom1.x - atom2.x;
          const dy = atom1.y - atom2.y;
          const dz = atom1.z - atom2.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Debug: check for close interactions
          if (distance < 4.0 && distance > 0.1) {
            candidateCount++;
            if (candidateCount <= 5) {  // Only log first 5 to avoid spam
              console.log(`[Debug] Distance: ${distance.toFixed(2)} Å, Atom1: ${atom1.resn}-${atom1.atom}, Atom2: ${atom2.resn}-${atom2.atom}`);
            }
          }

          // Check for salt bridges (4.0 Å cutoff)
          if (distance < 4.0 && distance > 0.1) {
            const res1 = atom1.resn;
            const res2 = atom2.resn;
            const isPositive1 = positiveResidues.includes(res1);
            const isNegative1 = negativeResidues.includes(res1);
            const isPositive2 = positiveResidues.includes(res2);
            const isNegative2 = negativeResidues.includes(res2);

            if ((isPositive1 && isNegative2) || (isNegative1 && isPositive2)) {
              const atom1Name = atom1.atom || '';
              const atom2Name = atom2.atom || '';

              const isPositiveAtom1 = (res1 === 'LYS' && atom1Name === 'NZ') ||
                                    (res1 === 'ARG' && (atom1Name === 'NH1' || atom1Name === 'NH2')) ||
                                    (res1 === 'HIS' && (atom1Name === 'ND1' || atom1Name === 'NE2'));
              const isPositiveAtom2 = (res2 === 'LYS' && atom2Name === 'NZ') ||
                                    (res2 === 'ARG' && (atom2Name === 'NH1' || atom2Name === 'NH2')) ||
                                    (res2 === 'HIS' && (atom2Name === 'ND1' || atom2Name === 'NE2'));

              const isNegativeAtom1 = (res1 === 'ASP' && (atom1Name === 'OD1' || atom1Name === 'OD2')) ||
                                    (res1 === 'GLU' && (atom1Name === 'OE1' || atom1Name === 'OE2'));
              const isNegativeAtom2 = (res2 === 'ASP' && (atom2Name === 'OD1' || atom2Name === 'OD2')) ||
                                    (res2 === 'GLU' && (atom2Name === 'OE1' || atom2Name === 'OE2'));

              if ((isPositiveAtom1 && isNegativeAtom2) || (isNegativeAtom1 && isPositiveAtom2)) {
                viewer.addCylinder({
                  start: { x: atom1.x, y: atom1.y, z: atom1.z },
                  end: { x: atom2.x, y: atom2.y, z: atom2.z },
                  radius: 0.1,
                  color: '#FFA500',
                  dashed: true,
                  fromCap: 1,
                  toCap: 1
                });
                saltBridgeCount++;
              }
            }
          }

          // Check for hydrogen bonds (3.5 Å cutoff)
          if (distance < 3.5 && distance > 0.1) {
            const elem1 = atom1.elem;
            const elem2 = atom2.elem;
            const atom1Name = atom1.atom || '';
            const atom2Name = atom2.atom || '';

            // Check if both atoms are N or O
            const isDonorAcceptor = ((elem1 === 'N' || elem1 === 'O') && (elem2 === 'N' || elem2 === 'O'));

            if (isDonorAcceptor) {
              // Exclude backbone-backbone hydrogen bonds
              const isBackbone1 = (atom1Name === 'N' || atom1Name === 'O' || atom1Name === 'C' || atom1Name === 'CA');
              const isBackbone2 = (atom2Name === 'N' || atom2Name === 'O' || atom2Name === 'C' || atom2Name === 'CA');

              // Allow if at least one is side chain
              if (!isBackbone1 || !isBackbone2) {
                viewer.addCylinder({
                  start: { x: atom1.x, y: atom1.y, z: atom1.z },
                  end: { x: atom2.x, y: atom2.y, z: atom2.z },
                  radius: 0.08,
                  color: '#4169E1',
                  dashed: true,
                  fromCap: 1,
                  toCap: 1
                });
                hBondCount++;
              }
            }
          }
        });
      });

      console.log(`[Interactions] Salt bridges: ${saltBridgeCount}, H-bonds: ${hBondCount}`);
    };

    if (state.activeRegion !== null) {
      const region = state.regions.find(r => r.id === state.activeRegion);
      if (region) {
        drawInteractions(region.selectedResidues, region.nearbyResidues);
      }
    } else {
      drawInteractions(state.selectedResidues, state.nearbyResidues);
    }
  };

  // Visualize HETATM residues
  const visualizeHetAtoms = () => {
    if (!state.showHetAtoms || state.hetAtoms.length === 0) return;

    const model = viewer.getModel();
    if (!model) return;

    state.hetAtoms.forEach(het => {
      // Skip if not in selected chain
      if (state.selectedChain && het.chain !== state.selectedChain) return;
      const selector = {
        chain: het.chain,
        resi: het.resSeq,
        hetflag: true
      };

      const atoms = model.selectedAtoms(selector);

      if (atoms.length > 0) {
        const isIon = ionResidues.includes(het.resName);

        atoms.forEach((atom: any) => {
          const element = atom.elem || 'C';
          const color = cmykColors.element[element] || cmykColors.element.default;

          if (isIon) {
            viewer.addStyle(
              { chain: atom.chain, resi: atom.resi, serial: atom.serial },
              {
                sphere: {
                  color,
                  radius: 1.0,
                  opacity: 0.9
                }
              }
            );
          } else {
            viewer.addStyle(
              { chain: atom.chain, resi: atom.resi, serial: atom.serial, hetflag: true },
              {
                stick: {
                  color,
                  radius: 0.25,
                  hidden: false
                },
                sphere: {
                  color,
                  radius: 0.35
                }
              }
            );
          }
        });
      }
    });
  };

  // Visualize glycans
  const visualizeGlycans = () => {
    if (!viewer || state.skipVisualization) return;

    // Only render glycans if showGlycans is true
    if (!state.showGlycans) return;

    // Get glycans for selected chain (or all if no chain selected)
    const glycansToRender = getGlycansForChain(state.glycans, state.selectedChain);

    // Render glycans as 3D shapes
    renderGlycans(viewer, glycansToRender, state.showGlycans);
  };

  // Get residue color based on color scheme
  const getResidueColor = (chain: string, resi: number, colorScheme?: ColorScheme): string => {
    const scheme = colorScheme || state.currentColor;
    const model = viewer.getModel();

    if (!model) return '#a0a0a0';

    switch (scheme) {
      case 'spectrum': {
        const atoms = model.selectedAtoms({});
        let minResi = Infinity, maxResi = -Infinity;
        atoms.forEach((atom: any) => {
          if (atom.resi < minResi) minResi = atom.resi;
          if (atom.resi > maxResi) maxResi = atom.resi;
        });
        const range = maxResi - minResi || 1;
        const progress = (resi - minResi) / range;
        const colorIndex = Math.floor(progress * (cmykColors.spectrum.length - 1));
        return cmykColors.spectrum[colorIndex];
      }
      case 'chain': {
        const chains = Object.keys(state.sequenceData);
        const chainIdx = chains.indexOf(chain);
        return cmykColors.chain[chainIdx % cmykColors.chain.length];
      }
      case 'ss': {
        const atoms = model.selectedAtoms({ chain, resi });
        if (atoms.length > 0) {
          const ss = atoms[0].ss;
          if (ss === 'h') return cmykColors.ss.helix;
          if (ss === 's') return cmykColors.ss.sheet;
        }
        return cmykColors.ss.coil;
      }
      case 'bfactor': {
        const atoms = model.selectedAtoms({});
        let minB = Infinity, maxB = -Infinity;
        atoms.forEach((atom: any) => {
          if (atom.b !== undefined) {
            if (atom.b < minB) minB = atom.b;
            if (atom.b > maxB) maxB = atom.b;
          }
        });
        const range = maxB - minB || 1;
        const residueAtoms = model.selectedAtoms({ chain, resi });
        if (residueAtoms.length > 0 && residueAtoms[0].b !== undefined) {
          const progress = (residueAtoms[0].b - minB) / range;
          const colorIndex = Math.floor(progress * (cmykColors.bfactor.length - 1));
          return cmykColors.bfactor[colorIndex];
        }
        return '#a0a0a0';
      }
      case 'element':
        return cmykColors.element['C'] || cmykColors.element.default;
      default:
        return '#a0a0a0';
    }
  };

  return { applyViewerStyle };
};
