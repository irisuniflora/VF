// ============================================
// Glycan Visualization Utilities
// ============================================

import { GlycanResidue } from '../types';
import { glycanShapeSize } from './constants';

// 3DMol.js viewer type
type Viewer3DMol = any;

/**
 * Render glycan residues as 3D shapes in the viewer
 * Optimized for performance with simplified shapes
 */
export const renderGlycans = (viewer: Viewer3DMol, glycans: GlycanResidue[], showGlycans: boolean) => {
  if (!viewer || !showGlycans || glycans.length === 0) return;

  glycans.forEach(glycan => {
    const { x, y, z, shape, color } = glycan;

    // Create shape specification based on glycan type
    // Simplified shapes for better performance
    switch (shape) {
      case 'circle':
        // Render as sphere
        viewer.addSphere({
          center: { x, y, z },
          radius: glycanShapeSize,
          color: color,
          alpha: 0.9
        });
        break;

      case 'square':
        // Render as cube
        viewer.addBox({
          center: { x, y, z },
          dimensions: { w: glycanShapeSize * 2, h: glycanShapeSize * 2, d: glycanShapeSize * 2 },
          color: color,
          alpha: 0.9
        });
        break;

      case 'triangle':
        // Render as cone (approximation of triangle)
        viewer.addCylinder({
          start: { x, y: y - glycanShapeSize, z },
          end: { x, y: y + glycanShapeSize, z },
          radius: glycanShapeSize * 0.8,
          fromCap: 1,
          toCap: 2,
          color: color,
          alpha: 0.9
        });
        break;

      case 'diamond':
        // Simplified diamond as single octahedron-like cylinder
        viewer.addCylinder({
          start: { x, y: y - glycanShapeSize, z },
          end: { x, y: y + glycanShapeSize, z },
          radius: glycanShapeSize * 0.6,
          fromCap: 2,
          toCap: 2,
          color: color,
          alpha: 0.9
        });
        break;

      case 'star':
        // Simplified star as slightly larger sphere (removed extra spheres for performance)
        viewer.addSphere({
          center: { x, y, z },
          radius: glycanShapeSize * 1.3,
          color: color,
          alpha: 0.85
        });
        break;

      case 'pentagon':
        // Render as cylinder (pentagon approximation)
        viewer.addCylinder({
          start: { x, y: y - glycanShapeSize * 0.5, z },
          end: { x, y: y + glycanShapeSize * 0.5, z },
          radius: glycanShapeSize,
          fromCap: 1,
          toCap: 1,
          color: color,
          alpha: 0.9
        });
        break;

      default:
        // Default: sphere
        viewer.addSphere({
          center: { x, y, z },
          radius: glycanShapeSize,
          color: color,
          alpha: 0.9
        });
    }
  });
};

/**
 * Clear all glycan shapes from the viewer
 */
export const clearGlycans = (viewer: Viewer3DMol) => {
  if (!viewer) return;

  // Remove all custom shapes (spheres, boxes, cylinders)
  viewer.removeAllShapes();
};

/**
 * Get glycan residues for a specific chain
 */
export const getGlycansForChain = (glycans: GlycanResidue[], chain: string | null): GlycanResidue[] => {
  if (!chain) return glycans;
  return glycans.filter(g => g.chain === chain);
};
