// ============================================
// PV Molecular Viewer with Pastel Colors
// ============================================

// Viewer state
const viewerState = {
    viewerInstance: null,
    currentStyle: 'cartoon',
    currentColor: 'chainid',
    silhouetteEnabled: true,
    selectedChain: 'all',
    sequenceData: {},
    currentStructure: null,
    structure: null
};

// Pastel color scheme for chains
const pastelColors = [
    [1.0, 0.7, 0.73],  // Pastel Pink
    [1.0, 0.87, 0.73], // Pastel Peach
    [1.0, 1.0, 0.73],  // Pastel Yellow
    [0.73, 1.0, 0.79], // Pastel Mint
    [0.73, 0.88, 1.0], // Pastel Blue
    [0.88, 0.73, 0.89], // Pastel Lavender
    [1.0, 0.87, 0.83], // Pastel Coral
    [0.78, 0.81, 0.92], // Pastel Periwinkle
    [0.71, 0.92, 0.84], // Pastel Seafoam
    [1.0, 0.71, 0.91]  // Pastel Magenta
];

// Initialize viewer on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeViewer();
});

// Initialize PV viewer
function initializeViewer() {
    const viewerContainer = document.getElementById('viewer3d');
    if (!viewerContainer) {
        console.error('Viewer container not found');
        return;
    }

    // Check if pv is loaded
    if (typeof pv === 'undefined') {
        console.error('PV library not loaded');
        showError('PV 라이브러리를 로드할 수 없습니다');
        return;
    }

    // Create PV viewer instance
    const options = {
        width: 'auto',
        height: 'auto',
        antialias: true,
        quality: 'high',
        background: '#f5f5f5',
        outline: true,
        outlineColor: [0.1, 0.1, 0.1],
        outlineWidth: 1.5
    };

    viewerState.viewerInstance = pv.Viewer(viewerContainer, options);

    console.log('PV Viewer initialized successfully');
}

// Load structure from RCSB PDB
async function loadFromRCSB() {
    const pdbId = document.getElementById('pdbId').value.trim().toLowerCase();

    if (!pdbId) {
        showError('PDB ID를 입력해주세요');
        return;
    }

    if (pdbId.length !== 4) {
        showError('PDB ID는 4자리여야 합니다');
        return;
    }

    try {
        showLoading('구조를 불러오는 중...');

        // Fetch PDB file directly
        const rcsb_url = `https://files.rcsb.org/download/${pdbId}.pdb`;
        const response = await fetch(rcsb_url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: PDB ID를 찾을 수 없습니다`);
        }

        const pdbData = await response.text();

        // Load from string
        await loadStructureFromString(pdbData, pdbId.toUpperCase(), 'pdb');

        hideLoading();
    } catch (error) {
        console.error('Error loading structure:', error);
        showError(`구조를 불러올 수 없습니다: ${error.message || 'Unknown error'}`);
        hideLoading();
    }
}

// Load structure from local file
async function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        showLoading('파일을 로드하는 중...');

        const fileContent = await readFile(file);

        // Determine file extension
        const fileName = file.name.toLowerCase();
        let ext = 'pdb';
        if (fileName.endsWith('.cif')) ext = 'cif';

        await loadStructureFromString(fileContent, file.name, ext);

        hideLoading();
    } catch (error) {
        console.error('Error loading file:', error);
        showError(`파일을 불러올 수 없습니다: ${error.message}`);
        hideLoading();
    }
}

// Read file as text
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// Load structure from string data
async function loadStructureFromString(data, name, ext) {
    if (!viewerState.viewerInstance) {
        throw new Error('Viewer not initialized');
    }

    // Parse structure based on format
    let structure;
    if (ext === 'pdb') {
        structure = pv.io.pdb(data);
    } else if (ext === 'cif') {
        structure = pv.io.cif(data);
    } else {
        throw new Error(`Unsupported format: ${ext}`);
    }

    // Store structure
    viewerState.structure = structure;
    viewerState.currentStructure = { data, name, ext };

    // Clear previous rendering
    viewerState.viewerInstance.clear();

    // Apply representation
    applyRepresentation();

    // Center view
    viewerState.viewerInstance.autoZoom();

    // Extract sequence
    extractSequenceFromStructure(structure);
}

// Apply representation style
function applyRepresentation() {
    if (!viewerState.viewerInstance || !viewerState.structure) return;

    const viewer = viewerState.viewerInstance;
    const structure = viewerState.structure;
    const style = viewerState.currentStyle;
    const colorScheme = viewerState.currentColor;

    // Clear previous rendering
    viewer.clear();

    // Create custom color function
    let colorFunc = pv.color.bySS();

    if (colorScheme === 'chainid') {
        colorFunc = pv.color.byChain();
    } else if (colorScheme === 'ss') {
        colorFunc = pv.color.bySS();
    } else if (colorScheme === 'residueindex') {
        colorFunc = pv.color.rainbow();
    }

    // Render based on style using correct PV API
    if (style === 'cartoon') {
        viewer.cartoon('structure', structure, { color: colorFunc });
    } else if (style === 'ribbon') {
        viewer.tube('structure', structure, { color: colorFunc });
    } else if (style === 'stick') {
        viewer.ballsAndSticks('structure', structure, { color: colorFunc });
    } else if (style === 'sphere') {
        viewer.spheres('structure', structure, { color: colorFunc });
    } else if (style === 'line') {
        viewer.lines('structure', structure, { color: colorFunc });
    } else if (style === 'mesh') {
        viewer.trace('structure', structure, { color: colorFunc });
    }

    // Request render
    viewer.requestRedraw();
}

// Get color function based on scheme
function getColorFunction() {
    const colorScheme = viewerState.currentColor;

    if (colorScheme === 'chainid') {
        return pv.color.byChain();
    } else if (colorScheme === 'ss') {
        return pv.color.bySS();
    } else if (colorScheme === 'residueindex') {
        return pv.color.rainbow();
    }

    return pv.color.uniform([0.8, 0.8, 0.8]);
}

// Extract sequence from structure
function extractSequenceFromStructure(structure) {
    const chains = {};

    structure.eachChain(function(chain) {
        const chainName = chain.name();
        const residues = [];

        chain.eachResidue(function(residue) {
            const resName = residue.name();
            const resNum = residue.num();
            residues.push({
                resno: resNum,
                resname: resName,
                resname1: aa3to1[resName] || 'X'
            });
        });

        chains[chainName] = residues;
    });

    viewerState.sequenceData = chains;
    updateChainSelector();
    displaySequence();
}

// 3-letter to 1-letter amino acid conversion
const aa3to1 = {
    'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
    'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
    'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
    'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V'
};

// Amino acid properties for coloring
const aminoAcidProperties = {
    'A': 'hydrophobic', 'V': 'hydrophobic', 'I': 'hydrophobic', 'L': 'hydrophobic',
    'M': 'hydrophobic', 'F': 'hydrophobic', 'W': 'hydrophobic', 'P': 'hydrophobic',
    'S': 'polar', 'T': 'polar', 'N': 'polar', 'Q': 'polar', 'Y': 'polar', 'C': 'polar',
    'K': 'positive', 'R': 'positive', 'H': 'positive',
    'D': 'negative', 'E': 'negative',
    'G': 'special'
};

// Update chain selector
function updateChainSelector() {
    const chainSelect = document.getElementById('chainSelect');
    if (!chainSelect) return;

    // Clear existing options
    chainSelect.innerHTML = '<option value="all">모든 체인</option>';

    // Add chain options
    Object.keys(viewerState.sequenceData).forEach((chain) => {
        const option = document.createElement('option');
        option.value = chain;
        option.textContent = `체인 ${chain}`;
        chainSelect.appendChild(option);
    });
}

// Display sequence
function displaySequence() {
    const sequenceDisplay = document.getElementById('sequenceDisplay');
    if (!sequenceDisplay) return;

    const selectedChain = viewerState.selectedChain;

    // If no sequence data, show placeholder
    if (Object.keys(viewerState.sequenceData).length === 0) {
        sequenceDisplay.innerHTML = `
            <div class="sequence-placeholder">
                <i class="fas fa-info-circle"></i> 구조를 불러와주세요
            </div>
        `;
        return;
    }

    // Get sequences to display
    let sequencesToDisplay = [];
    if (selectedChain === 'all') {
        sequencesToDisplay = Object.entries(viewerState.sequenceData);
    } else if (viewerState.sequenceData[selectedChain]) {
        sequencesToDisplay = [[selectedChain, viewerState.sequenceData[selectedChain]]];
    }

    // Build HTML
    let html = '';
    sequencesToDisplay.forEach(([chainName, sequence]) => {
        html += `<div class="sequence-chain">
            <div class="sequence-chain-header">체인 ${chainName} (${sequence.length} 잔기)</div>
            <div class="sequence-residues">`;

        sequence.forEach(residue => {
            const property = aminoAcidProperties[residue.resname1] || '';
            html += `<span class="sequence-residue ${property}" title="${residue.resname} ${residue.resno}">${residue.resname1}</span>`;
        });

        html += `</div></div>`;
    });

    sequenceDisplay.innerHTML = html;
}

// Set viewer style
function setStyle(style) {
    viewerState.currentStyle = style;

    // Update button states
    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.style === style);
    });

    applyRepresentation();
}

// Set viewer color scheme
function setColor(color) {
    viewerState.currentColor = color;

    // Update button states
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
    });

    applyRepresentation();
}

// Toggle silhouette effect
function toggleSilhouette() {
    viewerState.silhouetteEnabled = !viewerState.silhouetteEnabled;

    // Update button state
    const btn = document.querySelector('.silhouette-btn');
    if (btn) {
        btn.classList.toggle('active', viewerState.silhouetteEnabled);
    }

    // Toggle outline in PV
    if (viewerState.viewerInstance) {
        viewerState.viewerInstance.options('outline', viewerState.silhouetteEnabled);
        viewerState.viewerInstance.requestRedraw();
    }
}

// Set outline color
function setOutlineColor(hexColor) {
    if (!viewerState.viewerInstance) return;

    // Convert hex to RGB array (0-1 range)
    const r = parseInt(hexColor.substr(1, 2), 16) / 255;
    const g = parseInt(hexColor.substr(3, 2), 16) / 255;
    const b = parseInt(hexColor.substr(5, 2), 16) / 255;

    viewerState.viewerInstance.options('outlineColor', [r, g, b]);
    viewerState.viewerInstance.requestRedraw();
}

// Set outline width
function setOutlineWidth(width) {
    if (!viewerState.viewerInstance) return;

    document.getElementById('outlineWidthValue').textContent = width;
    viewerState.viewerInstance.options('outlineWidth', parseFloat(width));
    viewerState.viewerInstance.requestRedraw();
}

// Set custom color (for palette)
function setCustomColor(hexColor) {
    if (!viewerState.viewerInstance || !viewerState.structure) return;

    // Convert hex to RGB array (0-1 range)
    const r = parseInt(hexColor.substr(1, 2), 16) / 255;
    const g = parseInt(hexColor.substr(3, 2), 16) / 255;
    const b = parseInt(hexColor.substr(5, 2), 16) / 255;

    const viewer = viewerState.viewerInstance;
    const structure = viewerState.structure;
    const style = viewerState.currentStyle;

    viewer.clear();

    const colorFunc = pv.color.uniform([r, g, b]);

    if (style === 'cartoon') {
        viewer.cartoon('structure', structure, { color: colorFunc });
    } else if (style === 'ribbon') {
        viewer.tube('structure', structure, { color: colorFunc });
    } else if (style === 'stick') {
        viewer.ballsAndSticks('structure', structure, { color: colorFunc });
    } else if (style === 'sphere') {
        viewer.spheres('structure', structure, { color: colorFunc });
    } else if (style === 'line') {
        viewer.lines('structure', structure, { color: colorFunc });
    } else if (style === 'mesh') {
        viewer.trace('structure', structure, { color: colorFunc });
    }

    viewer.requestRedraw();
}

// Open custom color picker
function openCustomColorPicker() {
    document.getElementById('customColorPicker').click();
}

// Add custom palette color
function addCustomPaletteColor(hexColor) {
    const palette = document.querySelector('.color-palette');
    const customBtn = palette.querySelector('.palette-custom');

    // Check if color already exists
    const existing = Array.from(palette.querySelectorAll('.palette-color:not(.palette-custom)')).find(
        el => el.style.background === hexColor
    );

    if (!existing) {
        // Create new color button
        const newColor = document.createElement('div');
        newColor.className = 'palette-color';
        newColor.style.background = hexColor;
        newColor.onclick = () => setCustomColor(hexColor);
        newColor.title = 'Custom Color';

        // Insert before custom button
        palette.insertBefore(newColor, customBtn);
    }

    // Apply the color
    setCustomColor(hexColor);
}

// Reset viewer view
function resetViewerView() {
    if (viewerState.viewerInstance) {
        viewerState.viewerInstance.autoZoom();
    }
}

// Toggle viewer spin
function toggleViewerSpin() {
    if (viewerState.viewerInstance) {
        const currentSpin = viewerState.viewerInstance.rockAndRoll();
        viewerState.viewerInstance.rockAndRoll(!currentSpin);
    }
}

// Zoom in
function viewerZoomIn() {
    if (viewerState.viewerInstance) {
        viewerState.viewerInstance.setZoom(viewerState.viewerInstance.zoom() * 1.2);
    }
}

// Zoom out
function viewerZoomOut() {
    if (viewerState.viewerInstance) {
        viewerState.viewerInstance.setZoom(viewerState.viewerInstance.zoom() * 0.8);
    }
}

// Toggle sequence panel
function toggleSequencePanel() {
    const panel = document.querySelector('.sequence-panel');
    const icon = document.querySelector('.toggle-icon');

    if (panel && icon) {
        panel.classList.toggle('collapsed');
        icon.classList.toggle('fa-chevron-up');
        icon.classList.toggle('fa-chevron-down');
    }
}

// Change sequence chain
function changeSequenceChain() {
    const chainSelect = document.getElementById('chainSelect');
    if (!chainSelect) return;

    viewerState.selectedChain = chainSelect.value;
    displaySequence();
}

// Show loading overlay
function showLoading(message) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <i class="fas fa-spinner fa-spin"></i>
            <p class="loading-text">${message}</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

// Show error message
function showError(message) {
    const overlay = document.createElement('div');
    overlay.className = 'error-overlay';
    overlay.id = 'errorOverlay';
    overlay.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-circle"></i>
            <p class="error-text">${message}</p>
            <button class="error-close" onclick="document.getElementById('errorOverlay').remove()">닫기</button>
        </div>
    `;
    document.body.appendChild(overlay);
}
