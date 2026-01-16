// ============================================
// Custom Hook for 3Dmol Viewer Initialization
// ============================================

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    $3Dmol: any;
  }
}

export const use3DMol = (containerRef: React.RefObject<HTMLDivElement>) => {
  const [viewer, setViewer] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if 3Dmol library is loaded
    if (typeof window.$3Dmol === 'undefined') {
      console.error('3Dmol.js library not loaded');
      return;
    }

    // Check if already initialized
    if (viewer) {
      viewer.resize();
      return;
    }

    // Create viewer
    const newViewer = window.$3Dmol.createViewer(containerRef.current, {
      backgroundColor: '#ffffff',
      antialias: true,
      hoverDuration: 50  // Reduce hover delay to 50ms
    });

    setViewer(newViewer);
    setIsReady(true);

    // Cleanup
    return () => {
      if (newViewer) {
        newViewer.clear();
      }
    };
  }, [containerRef.current]);

  return { viewer, isReady };
};
