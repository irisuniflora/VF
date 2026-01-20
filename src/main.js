// Mol* Viewer - Component-based coloring
// Each color group = separate component with its own representation

// Import Viewer from molstar app
import { Viewer } from 'molstar/lib/apps/viewer/app';

// Import for structure element handling
import { StructureElement } from 'molstar/lib/mol-model/structure';

// Import OrderedSet for building loci indices
import { OrderedSet } from 'molstar/lib/mol-data/int';

// Import MolScript builder for selection expressions
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';

// Import Color utility
import { Color } from 'molstar/lib/mol-util/color';

// ============================================
// Constants
// ============================================

// UI Colors
const COLORS = {
    SELECT: 0x00FF00,           // Green - selection highlight
    HIGHLIGHT: 0xFFFF00,        // Yellow - hover highlight
    OXYGEN: 0xFF4444,           // Red - oxygen atoms
    NITROGEN: 0x4444FF,         // Blue - nitrogen atoms
    SULFUR: 0xFFCC00            // Yellow - sulfur atoms
};

// Molecular interaction distances (Ångströms)
const INTERACTION_DISTANCES = {
    HYDROGEN_BOND: 4.0,
    IONIC_BOND: 3.5,
    HYDROPHOBIC: 4.5,
    PI_STACKING: 5.5
};

// Timing constants (milliseconds)
const TIMING = {
    POLL_INTERVAL: 50,          // Structure loading poll interval
    TOAST_ANIMATION: 300,       // Toast fade out animation
    TOAST_DURATION: 4000,       // Toast display duration
    NETWORK_TIMEOUT: 30000,     // Network request timeout
    STRUCTURE_LOAD_TIMEOUT: 5000, // Max wait for structure ready
    CAMERA_RESTORE_DELAY: 100   // Delay before restoring camera (needs time for render)
};

// Rendering parameters
const RENDER_PARAMS = {
    EDGE_STRENGTH: 1.5,         // Selection/highlight edge strength
    ATOM_SIZE_FACTOR: 0.15,     // Ball-and-stick atom size
    ATOM_ASPECT_RATIO: 0.88,    // Atom aspect ratio
    PROBE_RADIUS: 1.4,          // Molecular surface probe radius
    SURFACE_RESOLUTION: 2,      // Surface calculation resolution
    SURFACE_SMOOTHNESS: 1.5,    // Gaussian surface smoothness
    UNIFORM_SIZE: 0.4,          // Uniform representation size
    OUTLINE_SCALE: 1.0,         // Outline effect scale
    OUTLINE_THRESHOLD: 0.33     // Outline threshold
};

// File constraints
const FILE_CONSTRAINTS = {
    ALLOWED_EXTENSIONS: ['.pdb', '.cif', '.mcif', '.mol2'],
    MAX_FILE_SIZE: 50 * 1024 * 1024  // 50MB
};

// ============================================
// Centralized State Management
// ============================================
const AppState = {
    // Core viewer references
    viewer: null,
    plugin: null,

    // Current structure info
    currentStructure: null,
    loadedStructures: [],
    currentStructureIndex: -1,

    // UI state
    isSpinning: false,
    outlineEnabled: true,
    currentStyle: 'cartoon',
    currentColorScheme: 'chain-id',
    currentUniformColor: null,

    // Selection groups
    selectionGroups: [],

    // Representation visibility
    representationState: {
        atoms: false,
        cartoon: true,
        surface: false
    },
    representationComponents: {
        atoms: null,
        cartoon: null,
        surface: null
    },

    // Sequence and selection
    sequenceData: [],
    selectedResidues: new Set(),
    currentChainFilter: '',
    isSelecting: false,
    selectionStart: null,

    // Residue visibility per representation
    atomsVisibleResidues: new Set(),
    cartoonVisibleResidues: new Set(),
    surfaceVisibleResidues: new Set(),

    // Partial mode flags
    cartoonPartialMode: false,
    surfacePartialMode: false,

    // Event subscriptions for cleanup
    subscriptions: []
};

// Backwards compatibility - expose as individual variables
let viewer = null;
let plugin = null;
let currentStructure = null;
let isSpinning = false;
let outlineEnabled = true;
let currentStyle = 'cartoon';
let currentColorScheme = 'chain-id';
let currentUniformColor = null;
let loadedStructures = [];
let currentStructureIndex = -1;
let selectionGroups = [];
let representationState = AppState.representationState;
let representationComponents = AppState.representationComponents;
let sequenceData = [];
let selectedResidues = new Set();
let currentChainFilter = '';
let isSelecting = false;
let selectionStart = null;
let atomsVisibleResidues = new Set();
let cartoonVisibleResidues = new Set();
let surfaceVisibleResidues = new Set();
let cartoonPartialMode = false;
let surfacePartialMode = false;

// ============================================
// DOM Element Cache
// ============================================
const DOMCache = {
    elements: {},

    get(id) {
        if (!this.elements[id]) {
            this.elements[id] = document.getElementById(id);
        }
        return this.elements[id];
    },

    clear() {
        this.elements = {};
    }
};

// Helper function to get cached DOM elements
function $(id) {
    return DOMCache.get(id);
}

// Timeout wrapper for async operations
function withTimeout(promise, ms, errorMessage = 'Operation timed out') {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), ms)
    );
    return Promise.race([promise, timeout]);
}

// Wait for structure to be fully loaded and ready
async function waitForStructureReady(structureIndex, maxWait = TIMING.STRUCTURE_LOAD_TIMEOUT) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures[structureIndex]?.cell?.obj?.data) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, TIMING.POLL_INTERVAL));
    }
    return false;
}

// Restore camera state after operations (prevents auto-zoom)
// Uses multiple attempts to ensure camera is restored even after Mol* auto-focus
function restoreCamera(cameraSnapshot) {
    if (!cameraSnapshot || !plugin?.canvas3d) return;

    const restore = () => {
        if (plugin?.canvas3d) {
            plugin.canvas3d.camera.setState(cameraSnapshot, 0);
        }
    };

    // Restore multiple times to override any auto-focus behavior
    restore();
    setTimeout(restore, 50);
    setTimeout(restore, 150);
    setTimeout(() => {
        restore();
        plugin.canvas3d?.requestDraw(true);
    }, 300);
}

// Toast notification system
function showToast(message, type = 'info', duration = TIMING.TOAST_DURATION) {
    const container = $('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        error: 'fa-circle-exclamation',
        success: 'fa-circle-check',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };

    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), TIMING.TOAST_ANIMATION);
    }, duration);
}

// Amino acid mappings
const AA_MAP = {
    'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
    'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
    'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
    'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V',
    'SEC': 'U', 'PYL': 'O'
};

const AA_PROPERTY = {
    'A': 'hydrophobic', 'V': 'hydrophobic', 'I': 'hydrophobic', 'L': 'hydrophobic',
    'M': 'hydrophobic', 'F': 'hydrophobic', 'W': 'hydrophobic', 'P': 'hydrophobic',
    'G': 'hydrophobic',
    'K': 'positive', 'R': 'positive', 'H': 'positive',
    'D': 'negative', 'E': 'negative',
    'C': 'cysteine',
    'S': 'other', 'T': 'other', 'N': 'other', 'Q': 'other', 'Y': 'other'
};

// Initialize Viewer
async function initViewer() {
    const viewerElement = $('viewer');

    viewer = await Viewer.create(viewerElement, {
        layoutIsExpanded: false,
        layoutShowControls: false,
        layoutShowRemoteState: false,
        layoutShowSequence: false,
        layoutShowLog: false,
        layoutShowLeftPanel: false,
        viewportShowExpand: false,
        viewportShowSelectionMode: false,
        viewportShowAnimation: false,
        collapseLeftPanel: true,
        collapseRightPanel: true
    });

    plugin = viewer.plugin;

    // Set highlight/selection to edge-only (preserve original colors)
    if (plugin.canvas3d) {
        plugin.canvas3d.setProps({
            renderer: {
                // Make select/highlight colors transparent (only edge will show)
                selectColor: Color(COLORS.SELECT),
                highlightColor: Color(COLORS.HIGHLIGHT),
            },
            marking: {
                enabled: true,
                highlightEdgeColor: Color(COLORS.HIGHLIGHT),
                selectEdgeColor: Color(COLORS.SELECT),
                highlightEdgeStrength: RENDER_PARAMS.EDGE_STRENGTH,
                selectEdgeStrength: RENDER_PARAMS.EDGE_STRENGTH,
                // Use edge-only marking (no fill color change)
                ghostEdgeStrength: 0,
            }
        });

        // Override selection/highlight blend to minimal (keep original color)
        plugin.canvas3d.setProps({
            renderer: {
                selectStrength: 0,      // No color blend for selection
                highlightStrength: 0,   // No color blend for highlight
            }
        });

        // Disable auto-focus when adding/changing representations
        plugin.canvas3d.setProps({
            camera: {
                manualReset: true
            }
        });

        // Focus representation uses element-symbol theme by default
        // Color will be updated when user applies colors via setUniformColor or applyChainColor
    }

    // Add click listener for deselecting when clicking empty space
    const clickSub = plugin.canvas3d.input.click.subscribe(async (e) => {
        // Check if clicked on empty space (no structure)
        const pickResult = plugin.canvas3d.identify(e.x, e.y);
        // Empty space means no repr or repr is undefined/null
        const clickedEmptySpace = !pickResult || !pickResult.repr || pickResult.repr.ref === '';
        if (clickedEmptySpace) {
            await deselectAll();
        }
    });
    AppState.subscriptions.push(clickSub);

    // Add hover listener for residue info display
    const hoverSub = plugin.behaviors.interaction.hover.subscribe((event) => {
        updateHoverInfo(event);
    });
    AppState.subscriptions.push(hoverSub);
}

// Cleanup function for event subscriptions
function cleanup() {
    AppState.subscriptions.forEach(sub => {
        if (sub && typeof sub.unsubscribe === 'function') {
            sub.unsubscribe();
        }
    });
    AppState.subscriptions = [];
    DOMCache.clear();
}

// Show/hide loading
function showLoading(show) {
    const overlay = $('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// Load from PDB
async function loadFromPDB() {
    const pdbId = $('pdbId').value.trim().toUpperCase();
    if (!pdbId || pdbId.length !== 4) {
        showToast('Please enter a valid 4-character PDB ID', 'warning');
        return;
    }

    // Check for duplicate structure
    if (loadedStructures.find(s => s.id === pdbId)) {
        showToast(`Structure ${pdbId} is already loaded`, 'warning');
        $('pdbId').value = '';
        return;
    }

    showLoading(true);

    try {
        await withTimeout(viewer.loadPdb(pdbId), TIMING.NETWORK_TIMEOUT, `Loading ${pdbId} timed out`);
        currentStructure = pdbId;

        const structures = plugin.managers.structure.hierarchy.current.structures;
        const newIndex = structures.length - 1;

        addToStructuresList(pdbId, pdbId, newIndex);

        await waitForStructureReady(newIndex);
        extractSequenceFromIndex(newIndex);
        applyOutline(outlineEnabled);

        // Apply initial chain colors (skip camera restore, will reset after)
        await applyChainColor(true);

        // Reset camera to show the full structure
        plugin.canvas3d?.requestCameraReset();

        $('pdbId').value = '';
        showToast(`Loaded: ${pdbId}`, 'success');

    } catch (error) {
        console.error('Error loading structure:', error);
        showToast(`Failed to load structure: ${pdbId}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Load from file
async function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file extension
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!FILE_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(ext)) {
        showToast(`Unsupported file format. Use: ${FILE_CONSTRAINTS.ALLOWED_EXTENSIONS.join(', ')}`, 'warning');
        event.target.value = '';
        return;
    }

    // Validate file size
    if (file.size > FILE_CONSTRAINTS.MAX_FILE_SIZE) {
        showToast('File too large. Maximum size is 50MB', 'warning');
        event.target.value = '';
        return;
    }

    // Check for duplicate structure
    if (loadedStructures.find(s => s.id === file.name)) {
        showToast(`File ${file.name} is already loaded`, 'warning');
        event.target.value = '';
        return;
    }

    showLoading(true);

    try {
        const fileData = await file.text();
        let format = 'pdb';
        if (ext === '.cif' || ext === '.mcif') {
            format = 'mmcif';
        } else if (ext === '.mol2') {
            format = 'mol2';
        }

        await viewer.loadStructureFromData(fileData, format, {
            dataLabel: file.name
        });

        currentStructure = file.name;

        const structures = plugin.managers.structure.hierarchy.current.structures;
        const newIndex = structures.length - 1;

        const displayName = file.name.replace(/\.(pdb|cif|mcif|mol2)$/i, '');
        showToast(`Loaded: ${displayName}`, 'success');
        addToStructuresList(file.name, displayName, newIndex);

        await waitForStructureReady(newIndex);
        extractSequenceFromIndex(newIndex);
        applyOutline(outlineEnabled);

        // Apply initial chain colors (skip camera restore, will reset after)
        await applyChainColor(true);

        // Reset camera to show the full structure
        plugin.canvas3d?.requestCameraReset();

    } catch (error) {
        console.error('Error loading file:', error);
        showToast(`Failed to load file: ${file.name}`, 'error');
    } finally {
        showLoading(false);
        event.target.value = '';
    }
}

// Extract sequence
function extractSequenceFromIndex(index) {
    if (!plugin) return;

    const structures = plugin.managers.structure.hierarchy.current.structures;

    if (structures.length === 0 || index < 0 || index >= structures.length) {
        return;
    }

    currentStructureIndex = index;
    extractSequenceFromStructure(structures[index]);
}

function extractSequenceFromStructure(structObj) {
    if (!structObj) return;

    sequenceData = [];
    selectedResidues = new Set();

    try {
        const structure = structObj.cell.obj?.data;
        if (!structure) return;

        const chains = new Set();
        const { units } = structure;

        for (let i = 0; i < units.length; i++) {
            const unit = units[i];
            const { elements, model } = unit;

            const residueIndex = model.atomicHierarchy.residueAtomSegments.index;
            const chainIndex = model.atomicHierarchy.chainAtomSegments.index;
            const residueLabel = model.atomicHierarchy.atoms.label_comp_id;
            const residueSeqId = model.atomicHierarchy.residues.label_seq_id;
            const chainName = model.atomicHierarchy.chains.label_asym_id;

            const processedResidues = new Set();

            for (let j = 0; j < elements.length; j++) {
                const atomIndex = elements[j];
                const rI = residueIndex[atomIndex];
                const cI = chainIndex[atomIndex];

                const resKey = `${cI}:${rI}`;
                if (processedResidues.has(resKey)) continue;
                processedResidues.add(resKey);

                const chain = chainName.value(cI);
                const resno = residueSeqId.value(rI);
                const resname = residueLabel.value(atomIndex);

                if (AA_MAP[resname]) {
                    chains.add(chain);
                    sequenceData.push({
                        chain, resno, resname,
                        aa: AA_MAP[resname] || resname.charAt(0),
                        ss: ''
                    });
                }
            }
        }

        sequenceData.sort((a, b) => {
            if (a.chain !== b.chain) return a.chain.localeCompare(b.chain);
            return a.resno - b.resno;
        });

        const seen = new Set();
        sequenceData = sequenceData.filter(res => {
            const key = `${res.chain}:${res.resno}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        updateChainSelector(Array.from(chains));
        displaySequence();

        // Initialize chain colors if not already set for this structure
        if (previousChainColors.size === 0 && chains.size > 0) {
            initializeChainColors(Array.from(chains));
        }

    } catch (error) {
        console.error('Error extracting sequence:', error);
    }
}

// Initialize chain colors for the current structure
function initializeChainColors(chains) {
    const chainColors = getShuffledColorsAvoidingPrevious(chains, CHAIN_COLOR_PALETTE, new Map());
    previousChainColors = new Map(chainColors);
}

function updateChainSelector(chains) {
    const select = $('chainSelect');
    select.innerHTML = '<option value="">All Chains</option>';

    const sortedChains = chains.sort();
    sortedChains.forEach(chain => {
        const option = document.createElement('option');
        option.value = chain;
        option.textContent = `Chain ${chain}`;
        select.appendChild(option);
    });

    // Set first chain as default selection
    if (sortedChains.length > 0) {
        select.value = sortedChains[0];
        currentChainFilter = sortedChains[0];
    }
}

function displaySequence() {
    const container = $('sequenceDisplay');
    const chainInfoEl = $('chainInfo');
    if (!container) return;

    const filteredData = currentChainFilter
        ? sequenceData.filter(r => r.chain === currentChainFilter)
        : sequenceData;

    if (filteredData.length === 0) {
        container.innerHTML = '<span style="color: #9ca3af; font-style: italic;">No sequence data</span>';
        if (chainInfoEl) chainInfoEl.innerHTML = '';
        return;
    }

    if (chainInfoEl) {
        if (currentChainFilter) {
            chainInfoEl.innerHTML = `<span class="chain-name">Chain ${currentChainFilter}</span><span class="residue-count">${filteredData.length} residues</span>`;
        } else {
            chainInfoEl.innerHTML = `<span class="residue-count">${sequenceData.length} residues</span>`;
        }
    }

    let html = '';
    let lastChain = '';

    filteredData.forEach((res, index) => {
        if (res.chain !== lastChain) {
            if (lastChain !== '' && !currentChainFilter) {
                html += '<span class="chain-separator">|</span>';
            }
            lastChain = res.chain;
        }

        const key = `${res.chain}:${res.resno}`;
        const isSelected = selectedResidues.has(key);
        const propertyClass = AA_PROPERTY[res.aa] || 'other';
        const showNumber = res.resno % 10 === 0;
        const isDecade = res.resno % 10 === 0;

        html += `<span class="sequence-residue ${isSelected ? 'selected' : ''} ${propertyClass} ${isDecade ? 'decade-end' : ''}"
                       data-chain="${res.chain}"
                       data-resno="${res.resno}"
                       data-index="${index}">
            ${showNumber ? `<span class="num-marker">${res.resno}</span>` : ''}
            <span class="aa">${res.aa}</span>
        </span>`;
    });

    container.innerHTML = html;
    setupSequenceSelection();
}

function setupSequenceSelection() {
    const container = $('sequenceDisplay');
    if (!container) return;

    container.addEventListener('mousedown', (e) => {
        const residueEl = e.target.closest('.sequence-residue');
        if (!residueEl) return;

        isSelecting = true;
        selectionStart = residueEl;

        const chain = residueEl.dataset.chain;
        const resno = parseInt(residueEl.dataset.resno);
        const key = `${chain}:${resno}`;

        if (e.ctrlKey || e.metaKey) {
            if (selectedResidues.has(key)) {
                selectedResidues.delete(key);
            } else {
                selectedResidues.add(key);
            }
        } else {
            selectedResidues.add(key);
        }

        updateSequenceHighlight();
        updateSelectionInfo();
    });

    container.addEventListener('mousemove', (e) => {
        if (!isSelecting || !selectionStart) return;

        const residueEl = e.target.closest('.sequence-residue');
        if (!residueEl) return;

        const startChain = selectionStart.dataset.chain;
        const startResno = parseInt(selectionStart.dataset.resno);
        const currentChain = residueEl.dataset.chain;
        const currentResno = parseInt(residueEl.dataset.resno);

        if (startChain === currentChain) {
            const min = Math.min(startResno, currentResno);
            const max = Math.max(startResno, currentResno);

            for (let i = min; i <= max; i++) {
                selectedResidues.add(`${startChain}:${i}`);
            }

            updateSequenceHighlight();
            updateSelectionInfo();
        }
    });

    document.addEventListener('mouseup', () => {
        isSelecting = false;
    });
}

function updateSequenceHighlight() {
    document.querySelectorAll('.sequence-residue').forEach(el => {
        const key = `${el.dataset.chain}:${el.dataset.resno}`;
        el.classList.toggle('selected', selectedResidues.has(key));
    });

    updateSelButtonState();
    syncSelectionToViewer();
}

// =====================================================
// SELECTION & HIGHLIGHT - Using Mol* selection manager + overpaint
// =====================================================
async function syncSelectionToViewer() {
    if (!plugin) return;

    try {
        // Clear previous selection
        plugin.managers.structure.selection.clear();

        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const structureRef = structures[structIndex];
        const structure = structureRef.cell.obj?.data;
        if (!structure) return;

        if (selectedResidues.size === 0) return;

        const loci = buildSelectionLoci(structure);
        if (loci && loci.elements && loci.elements.length > 0) {
            // Set selection in manager (this shows the green highlight)
            plugin.managers.structure.selection.fromLoci('set', loci);
        }

    } catch (error) {
        console.error('Selection sync error:', error);
    }
}

function buildSelectionLoci(structure) {
    const chainResidues = new Map();
    selectedResidues.forEach(key => {
        const [chain, resno] = key.split(':');
        if (!chainResidues.has(chain)) chainResidues.set(chain, []);
        chainResidues.get(chain).push(parseInt(resno));
    });

    const lociElements = [];
    const { units } = structure;

    for (const unit of units) {
        const { elements, model } = unit;
        const { residueAtomSegments, chainAtomSegments, residues, chains } = model.atomicHierarchy;

        const matchingIndices = [];

        for (let i = 0; i < elements.length; i++) {
            const eI = elements[i];
            const rI = residueAtomSegments.index[eI];
            const cI = chainAtomSegments.index[eI];

            const chainId = chains.label_asym_id.value(cI);
            const resSeq = residues.label_seq_id.value(rI);

            if (chainResidues.has(chainId) && chainResidues.get(chainId).includes(resSeq)) {
                matchingIndices.push(i);
            }
        }

        if (matchingIndices.length > 0) {
            lociElements.push({ unit, indices: matchingIndices });
        }
    }

    if (lociElements.length === 0) return null;

    const elementsForLoci = lociElements.map(({ unit, indices }) => {
        const sortedIndices = indices.sort((a, b) => a - b);
        return {
            unit,
            indices: OrderedSet.ofSortedArray(sortedIndices)
        };
    });

    return StructureElement.Loci(structure, elementsForLoci);
}

function updateSelectionInfo() {
    const badge = $('selectionBadge');
    if (!badge) return;

    if (selectedResidues.size === 0) {
        badge.classList.remove('visible');
        badge.textContent = '';
        return;
    }

    const byChain = new Map();
    selectedResidues.forEach(key => {
        const [chain, resno] = key.split(':');
        if (!byChain.has(chain)) byChain.set(chain, []);
        byChain.get(chain).push(parseInt(resno));
    });

    const parts = [];
    byChain.forEach((residues, chain) => {
        residues.sort((a, b) => a - b);
        const ranges = [];
        let start = residues[0];
        let end = residues[0];

        for (let i = 1; i < residues.length; i++) {
            if (residues[i] === end + 1) {
                end = residues[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                start = end = residues[i];
            }
        }
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        parts.push(`${chain} (${ranges.join(', ')})`);
    });

    badge.textContent = parts.join(' | ');
    badge.classList.add('visible');
}

// Backbone atom names
const BACKBONE_ATOMS = new Set(['N', 'CA', 'C', 'O', 'H', 'HA']);

// Get atom info from unit and atom index
function getAtomInfo(unit, atomIndex) {
    const model = unit.model;
    const hierarchy = model.atomicHierarchy;

    const residueIndex = hierarchy.residueAtomSegments.index[atomIndex];
    const chainIndex = hierarchy.chainAtomSegments.index[atomIndex];

    const resName = hierarchy.atoms.auth_comp_id.value(atomIndex);
    const resNum = hierarchy.residues.auth_seq_id.value(residueIndex);
    const chainId = hierarchy.chains.auth_asym_id.value(chainIndex);
    const atomName = hierarchy.atoms.auth_atom_id.value(atomIndex);

    const isBackbone = BACKBONE_ATOMS.has(atomName);

    // Get coordinates
    const conformation = unit.conformation;
    const x = conformation.x(atomIndex);
    const y = conformation.y(atomIndex);
    const z = conformation.z(atomIndex);

    return {
        resName,
        resNum,
        chainId,
        atomName,
        isBackbone,
        x, y, z,
        label: `${resName} ${resNum}`,
        fullLabel: `${chainId}:${resName} ${resNum} (${atomName})`
    };
}

// Calculate distance between two atoms
function calcDistance(atom1, atom2) {
    const dx = atom1.x - atom2.x;
    const dy = atom1.y - atom2.y;
    const dz = atom1.z - atom2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Classify interaction type based on atoms involved
function classifyInteraction(atom1Info, atom2Info, distance) {
    const a1 = atom1Info.atomName;
    const a2 = atom2Info.atomName;

    // Check for hydrogen bond (N-H...O or O-H...O patterns)
    const isHBondDonor = (name) => name === 'N' || name === 'NE' || name === 'NH1' || name === 'NH2' ||
                                   name === 'NZ' || name === 'ND1' || name === 'ND2' || name === 'NE1' ||
                                   name === 'NE2' || name === 'OG' || name === 'OG1' || name === 'OH';
    const isHBondAcceptor = (name) => name === 'O' || name === 'OD1' || name === 'OD2' || name === 'OE1' ||
                                      name === 'OE2' || name === 'OG' || name === 'OG1' || name === 'OH' ||
                                      name === 'ND1' || name === 'NE2';

    // Salt bridge check (charged residues)
    const positiveRes = ['ARG', 'LYS', 'HIS'];
    const negativeRes = ['ASP', 'GLU'];
    const isPositive1 = positiveRes.includes(atom1Info.resName) && (a1.startsWith('N') && a1 !== 'N');
    const isNegative1 = negativeRes.includes(atom1Info.resName) && a1.startsWith('O') && a1 !== 'O';
    const isPositive2 = positiveRes.includes(atom2Info.resName) && (a2.startsWith('N') && a2 !== 'N');
    const isNegative2 = negativeRes.includes(atom2Info.resName) && a2.startsWith('O') && a2 !== 'O';

    if ((isPositive1 && isNegative2) || (isNegative1 && isPositive2)) {
        if (distance < INTERACTION_DISTANCES.HYDROGEN_BOND) {
            return { type: 'salt-bridge', label: 'Salt Bridge', color: '#FF6B6B' };
        }
    }

    // Hydrogen bond
    if ((isHBondDonor(a1) && isHBondAcceptor(a2)) || (isHBondAcceptor(a1) && isHBondDonor(a2))) {
        if (distance < INTERACTION_DISTANCES.IONIC_BOND) {
            // Backbone H-bond
            if (atom1Info.isBackbone && atom2Info.isBackbone) {
                return { type: 'h-bond-backbone', label: 'H-bond', color: '#888888' };
            }
            // Sidechain H-bond
            return { type: 'h-bond-sidechain', label: 'H-bond', color: '#4ECDC4' };
        }
    }

    // Hydrophobic contact
    const hydrophobicRes = ['ALA', 'VAL', 'LEU', 'ILE', 'MET', 'PHE', 'TRP', 'PRO'];
    const hydrophobicAtoms = (name) => name.startsWith('C') && name !== 'C' && name !== 'CA';
    if (hydrophobicRes.includes(atom1Info.resName) && hydrophobicRes.includes(atom2Info.resName)) {
        if (hydrophobicAtoms(a1) && hydrophobicAtoms(a2) && distance < INTERACTION_DISTANCES.HYDROPHOBIC) {
            return { type: 'hydrophobic', label: 'Hydrophobic', color: '#F7DC6F' };
        }
    }

    // Pi-Pi stacking (aromatic residues)
    const aromaticRes = ['PHE', 'TYR', 'TRP', 'HIS'];
    if (aromaticRes.includes(atom1Info.resName) && aromaticRes.includes(atom2Info.resName)) {
        if (distance < INTERACTION_DISTANCES.PI_STACKING) {
            return { type: 'pi-pi', label: 'π-π', color: '#BB8FCE' };
        }
    }

    // Default: Van der Waals contact
    return { type: 'vdw', label: 'VdW', color: '#95A5A6' };
}

// Update hover info display
function updateHoverInfo(event) {
    const hoverInfo = $('hoverInfo');
    if (!hoverInfo) return;

    if (!event.current || !event.current.loci) {
        hoverInfo.classList.remove('visible');
        return;
    }

    const loci = event.current.loci;

    try {
        // Handle data-loci with interactions tag (non-covalent interaction lines)
        if (loci.kind === 'data-loci' && loci.tag === 'interactions') {
            const elements = loci.elements;

            if (elements && elements.length >= 1) {
                // elements[0] has structure: {unitA, indexA, unitB, indexB}
                const loc = elements[0];
                const unitA = loc.unitA;
                const unitB = loc.unitB;
                const indexA = loc.indexA;
                const indexB = loc.indexB;

                if (unitA && unitB) {
                    // indexA/indexB are element indices, get actual atom indices
                    const atomIndexA = unitA.elements[indexA];
                    const atomIndexB = unitB.elements[indexB];

                    const atom1 = getAtomInfo(unitA, atomIndexA);
                    const atom2 = getAtomInfo(unitB, atomIndexB);

                    // Calculate actual distance
                    const distance = calcDistance(atom1, atom2);
                    const interaction = classifyInteraction(atom1, atom2, distance);
                    const distStr = distance.toFixed(1) + ' Å';

                    // A (VAL 8) ─ VdW ─ A (ARG 10) · 3.8 Å
                    hoverInfo.innerHTML = `
                        <span class="chain-label">${atom1.chainId}</span>
                        (<span class="residue-name">${atom1.resName}</span> <span class="residue-num">${atom1.resNum}</span>)
                        <span style="color:${interaction.color}; margin:0 4px">─ ${interaction.label} ─</span>
                        <span class="chain-label">${atom2.chainId}</span>
                        (<span class="residue-name">${atom2.resName}</span> <span class="residue-num">${atom2.resNum}</span>)
                        · <span style="color:#aaa; font-size:11px">${distStr}</span>
                    `;
                    hoverInfo.classList.add('visible');
                    return;
                }
            }
        }

        // Handle element loci (normal residue/atom hover)
        if (loci.kind === 'element-loci') {
            if (!loci.elements || loci.elements.length === 0) {
                hoverInfo.classList.remove('visible');
                return;
            }

            const element = loci.elements[0];
            const unit = element.unit;
            const structure = loci.structure;

            if (!unit || !structure) {
                hoverInfo.classList.remove('visible');
                return;
            }

            // Get the first element index using OrderedSet
            const indices = element.indices;
            const elementIndex = OrderedSet.getAt(indices, 0);
            if (elementIndex === undefined) {
                hoverInfo.classList.remove('visible');
                return;
            }

            // Get atom index in the model
            const atomIndex = unit.elements[elementIndex];
            const atomInfo = getAtomInfo(unit, atomIndex);

            // Update display
            hoverInfo.innerHTML = `<span class="chain-label">Chain ${atomInfo.chainId}</span> · <span class="residue-name">${atomInfo.resName}</span> <span class="residue-num">${atomInfo.resNum}</span>`;
            hoverInfo.classList.add('visible');
            return;
        }

        // Unknown loci type
        hoverInfo.classList.remove('visible');

    } catch (error) {
        // Silently fail - just hide the info
        hoverInfo.classList.remove('visible');
    }
}

async function deselectAll() {
    selectedResidues.clear();

    // Update UI
    document.querySelectorAll('.sequence-residue').forEach(el => {
        el.classList.remove('selected');
    });
    updateSelButtonState();
    updateSelectionInfo();

    if (plugin) {
        // Clear all selection-related visuals
        try {
            // 1. Clear selection manager (green selection outline)
            plugin.managers.structure.selection.clear();

            // 2. Clear loci highlights (yellow hover highlight)
            plugin.managers.interactivity.lociHighlights.clearHighlights();

            // 3. Clear any loci marks
            if (plugin.managers.interactivity.lociMarks) {
                plugin.managers.interactivity.lociMarks.clearMarks();
            }

            // 4. Clear loci selects if available
            if (plugin.managers.interactivity.lociSelects) {
                plugin.managers.interactivity.lociSelects.deselectAll();
            }

            // 5. Force the behavior subject to emit empty selection
            const sel = plugin.managers.structure.selection;
            if (sel.entries) {
                sel.entries.clear();
            }

            // 6. Force canvas repaint
            plugin.canvas3d?.requestDraw(true);

        } catch (e) {
            console.error('Error clearing selection:', e);
        }
    }
}

function changeSequenceChain() {
    currentChainFilter = $('chainSelect').value;
    displaySequence();
}

// =====================================================
// COLOR APPLICATION
// =====================================================
async function applyPaletteColor(hexColor) {
    if (selectedResidues.size > 0) {
        await applyColorToSelection(hexColor);
    } else {
        await setUniformColor(hexColor);
    }
}

// =====================================================
// SECONDARY STRUCTURE COLORING (Permanent)
// Helix: Pastel Green, Sheet: Pastel Purple, Loop: Pastel Gray
// =====================================================
async function applySecondaryStructureColoring() {
    if (!plugin || !currentStructure) return;

    showLoading(true);
    const cameraSnapshot = plugin.canvas3d?.camera.getSnapshot();

    try {
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const structureRef = structures[structIndex];

        // Remove existing polymer representations first
        const components = structureRef.components || [];
        for (const comp of components) {
            if (comp.key === 'polymer' && comp.representations) {
                for (const repr of comp.representations) {
                    try {
                        const update = plugin.build();
                        update.delete(repr.cell);
                        await update.commit();
                    } catch (e) {}
                }
            }
        }

        const reprBuilder = plugin.builders.structure.representation;

        // Create polymer component with built-in secondary-structure coloring
        const polymerComp = await plugin.builders.structure.tryCreateComponentStatic(structureRef.cell, 'polymer');
        if (polymerComp) {
            // Use the built-in secondary-structure color theme
            await reprBuilder.addRepresentation(polymerComp, {
                type: 'cartoon',
                color: 'secondary-structure'
            });
        }

        // Update representation state
        representationState.cartoon = true;

        // Restore camera (with delay to ensure rendering is complete)
        restoreCamera(cameraSnapshot);

    } catch (error) {
        console.error('Secondary structure coloring error:', error);
    } finally {
        showLoading(false);
    }
}

// =====================================================
// COLOR & STYLE APPLICATION - Component-based approach
// residueColorMaps stores color per residue, per structure
// When applying color or style, rebuild all representations by color groups
// =====================================================

// Map: structure ID -> Map(residue key "A:1" -> hex color "#FF0000")
const residueColorMaps = new Map();

// Helper: Get color map for current structure
function getResidueColorMap() {
    const structId = getCurrentStructureId();
    if (!structId) return new Map();
    if (!residueColorMaps.has(structId)) {
        residueColorMaps.set(structId, new Map());
    }
    return residueColorMaps.get(structId);
}

// Helper: Get current structure ID
function getCurrentStructureId() {
    if (currentStructureIndex >= 0 && currentStructureIndex < loadedStructures.length) {
        return loadedStructures[currentStructureIndex]?.id;
    }
    return currentStructure;
}

// Helper: Clear color map for a specific structure
function clearResidueColorMap(structId) {
    if (structId) {
        residueColorMaps.delete(structId);
    }
}

// Build MolScript query from residue keys
function buildSelectionQuery(residueSet) {
    const chainResidues = new Map();
    residueSet.forEach(key => {
        const [chain, resno] = key.split(':');
        if (!chainResidues.has(chain)) chainResidues.set(chain, []);
        chainResidues.get(chain).push(parseInt(resno));
    });

    const groups = [];
    chainResidues.forEach((residues, chain) => {
        groups.push(
            MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.ammp('label_asym_id'), chain]),
                'residue-test': MS.core.set.has([
                    MS.core.type.set(residues),
                    MS.ammp('label_seq_id')
                ])
            })
        );
    });

    return groups.length === 1 ? groups[0] : MS.struct.combinator.merge(groups);
}

// Core function: Rebuild all polymer representations with current colors
// COLOR and ATOMS are INDEPENDENT:
// - residueColorMap: tracks color (cartoon/surface color only)
// - atomsVisibleResidues: tracks which residues show ball-and-stick
// - cartoonVisibleResidues/surfaceVisibleResidues: partial mode for cartoon/surface
async function rebuildAllRepresentations(structureRef) {
    const reprBuilder = plugin.builders.structure.representation;

    // Get current structure's color map
    const colorMap = getResidueColorMap();

    // Get all residue keys
    const allResidueKeys = new Set();
    sequenceData.forEach(res => {
        allResidueKeys.add(`${res.chain}:${res.resno}`);
    });

    // Determine which residues should have cartoon
    let cartoonResidues = new Set();
    if (representationState.cartoon) {
        if (cartoonPartialMode && cartoonVisibleResidues.size > 0) {
            cartoonResidues = new Set(cartoonVisibleResidues);
        } else if (!cartoonPartialMode) {
            cartoonResidues = new Set(allResidueKeys);
        }
    }

    // Determine which residues should have surface
    let surfaceResidues = new Set();
    if (representationState.surface) {
        if (surfacePartialMode && surfaceVisibleResidues.size > 0) {
            surfaceResidues = new Set(surfaceVisibleResidues);
        } else if (!surfacePartialMode) {
            surfaceResidues = new Set(allResidueKeys);
        }
    }


    // Helper: create representations for a set of residues with a specific repr type
    const createReprForResidues = async (residueSet, reprType) => {
        if (residueSet.size === 0) return;

        // Group by color
        const colorGroups = new Map();
        const uncolored = new Set();

        residueSet.forEach(key => {
            if (colorMap.has(key)) {
                const color = colorMap.get(key);
                if (!colorGroups.has(color)) colorGroups.set(color, new Set());
                colorGroups.get(color).add(key);
            } else {
                uncolored.add(key);
            }
        });

        // Create for each color group
        for (const [color, keys] of colorGroups) {
            const colorValue = parseInt(color.replace('#', ''), 16);
            const query = buildSelectionQuery(keys);
            try {
                const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
                    structureRef.cell, query,
                    `${reprType}-${color.replace('#', '')}-${Date.now()}`,
                    { label: `${reprType} ${color}` }
                );
                if (comp) {
                    await addRepresentationWithColor(reprBuilder, comp, reprType, colorValue);
                }
            } catch (e) {
                console.error(`Failed to create ${reprType} for ${color}:`, e);
            }
        }

        // Create for uncolored
        if (uncolored.size > 0) {
            const query = buildSelectionQuery(uncolored);
            try {
                const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
                    structureRef.cell, query,
                    `${reprType}-uncolored-${Date.now()}`,
                    { label: `${reprType} uncolored` }
                );
                if (comp) {
                    if (currentUniformColor) {
                        const colorValue = parseInt(currentUniformColor.replace('#', ''), 16);
                        await addRepresentationWithColor(reprBuilder, comp, reprType, colorValue);
                    } else {
                        await addRepresentationWithScheme(reprBuilder, comp, reprType, currentColorScheme || 'chain-id');
                    }
                }
            } catch (e) {
                console.error(`Failed to create ${reprType} uncolored:`, e);
            }
        }
    };

    // 1. Create cartoon representations
    await createReprForResidues(cartoonResidues, 'cartoon');

    // 2. Create surface representations
    await createReprForResidues(surfaceResidues, 'molecular-surface');

    // 3. Create ball-and-stick for atomsVisibleResidues
    if (atomsVisibleResidues.size > 0) {
        const atomsByColor = new Map();
        const atomsUncolored = new Set();

        atomsVisibleResidues.forEach(key => {
            if (colorMap.has(key)) {
                const color = colorMap.get(key);
                if (!atomsByColor.has(color)) atomsByColor.set(color, new Set());
                atomsByColor.get(color).add(key);
            } else {
                atomsUncolored.add(key);
            }
        });

        // Create colored atoms (all atoms including O, N, S)
        for (const [color, residueSet] of atomsByColor) {
            const colorValue = parseInt(color.replace('#', ''), 16);
            const query = buildSelectionQuery(residueSet);
            try {
                const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
                    structureRef.cell, query,
                    `atoms-${color.replace('#', '')}-${Date.now()}`,
                    { label: `Atoms ${color}` }
                );
                if (comp) {
                    await addRepresentationWithColor(reprBuilder, comp, 'ball-and-stick', colorValue);
                }
            } catch (e) {
                console.error(`Failed to create atoms for ${color}:`, e);
            }
        }

        // Create uncolored atoms
        if (atomsUncolored.size > 0) {
            if (currentUniformColor) {
                // Uniform color mode
                const query = buildSelectionQuery(atomsUncolored);
                const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
                    structureRef.cell, query,
                    `atoms-uncolored-${Date.now()}`,
                    { label: 'Atoms (uncolored)' }
                );
                if (comp) {
                    const colorValue = parseInt(currentUniformColor.replace('#', ''), 16);
                    await addRepresentationWithColor(reprBuilder, comp, 'ball-and-stick', colorValue);
                }
            } else if (previousChainColors.size > 0) {
                // Chain color mode - group by chain and apply chain colors
                const atomsByChain = new Map();
                atomsUncolored.forEach(key => {
                    const chain = key.split(':')[0];
                    if (!atomsByChain.has(chain)) atomsByChain.set(chain, new Set());
                    atomsByChain.get(chain).add(key);
                });

                for (const [chain, residueSet] of atomsByChain) {
                    const chainColor = previousChainColors.get(chain);
                    if (chainColor) {
                        const colorValue = parseInt(chainColor.replace('#', ''), 16);
                        const query = buildSelectionQuery(residueSet);
                        try {
                            const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
                                structureRef.cell, query,
                                `atoms-chain-${chain}-${Date.now()}`,
                                { label: `Atoms Chain ${chain}` }
                            );
                            if (comp) {
                                await addRepresentationWithColor(reprBuilder, comp, 'ball-and-stick', colorValue);
                            }
                        } catch (e) {
                            console.error(`Failed to create atoms for chain ${chain}:`, e);
                        }
                    } else {
                        // No chain color, use default scheme
                        const query = buildSelectionQuery(residueSet);
                        const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
                            structureRef.cell, query,
                            `atoms-chain-${chain}-default-${Date.now()}`,
                            { label: `Atoms Chain ${chain}` }
                        );
                        if (comp) {
                            await addRepresentationWithScheme(reprBuilder, comp, 'ball-and-stick', currentColorScheme || 'chain-id');
                        }
                    }
                }
            } else {
                // No chain colors set, use color scheme
                const query = buildSelectionQuery(atomsUncolored);
                const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
                    structureRef.cell, query,
                    `atoms-uncolored-${Date.now()}`,
                    { label: 'Atoms (uncolored)' }
                );
                if (comp) {
                    await addRepresentationWithScheme(reprBuilder, comp, 'ball-and-stick', currentColorScheme || 'chain-id');
                }
            }
        }

        // Apply O, N, S with larger size so they appear on top
        await applyElementColorToAtoms(structureRef);
    }
}

// Apply element coloring (O=red, N=blue, S=yellow) to residues with visible atoms
// This overlays fixed colors on O, N, S atoms after main ball-and-stick is created
async function applyElementColorToAtoms(structureRef) {
    if (!plugin || atomsVisibleResidues.size === 0) return;

    const reprBuilder = plugin.builders.structure.representation;

    // Heteroatom colors (CPK-like)
    const heteroatomColors = [
        { element: 'O', color: COLORS.OXYGEN },
        { element: 'N', color: COLORS.NITROGEN },
        { element: 'S', color: COLORS.SULFUR }
    ];

    // Build residue filter from atomsVisibleResidues
    const residueTests = [];
    atomsVisibleResidues.forEach(key => {
        const [chain, resno] = key.split(':');
        residueTests.push(
            MS.core.logic.and([
                MS.core.rel.eq([MS.ammp('auth_asym_id'), chain]),
                MS.core.rel.eq([MS.ammp('auth_seq_id'), parseInt(resno)])
            ])
        );
    });

    for (const { element, color } of heteroatomColors) {
        // Combine: element match AND (residue in atomsVisibleResidues)
        const elementQuery = MS.struct.generator.atomGroups({
            'atom-test': MS.core.logic.and([
                MS.core.rel.eq([MS.acp('elementSymbol'), MS.es(element)]),
                MS.core.logic.or(residueTests)
            ])
        });

        try {
            const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
                structureRef.cell,
                elementQuery,
                `element-${element}-${Date.now()}`,
                { label: `${element} atoms` }
            );

            if (comp) {
                // Use slightly larger size so O, N, S appear on top of other atoms
                await reprBuilder.addRepresentation(comp, {
                    type: 'ball-and-stick',
                    color: 'uniform',
                    colorParams: { value: color },
                    typeParams: {
                        sizeFactor: RENDER_PARAMS.ATOM_SIZE_FACTOR * 1.05,
                        sizeAspectRatio: RENDER_PARAMS.ATOM_ASPECT_RATIO
                    }
                });
            }
        } catch (e) {
            // Silently ignore - element may not exist in selection
        }
    }
}

// Helper: Add representation with uniform color
async function addRepresentationWithColor(reprBuilder, component, reprType, colorValue) {
    try {
        if (reprType === 'molecular-surface') {
            try {
                await reprBuilder.addRepresentation(component, {
                    type: 'molecular-surface',
                    color: 'uniform',
                    colorParams: { value: colorValue }
                });
            } catch (e) {
                await reprBuilder.addRepresentation(component, {
                    type: 'gaussian-surface',
                    color: 'uniform',
                    colorParams: { value: colorValue }
                });
            }
        } else if (reprType === 'ball-and-stick') {
            await reprBuilder.addRepresentation(component, {
                type: 'ball-and-stick',
                color: 'uniform',
                colorParams: { value: colorValue },
                typeParams: { sizeFactor: RENDER_PARAMS.ATOM_SIZE_FACTOR, sizeAspectRatio: RENDER_PARAMS.ATOM_ASPECT_RATIO }
            });
        } else {
            await reprBuilder.addRepresentation(component, {
                type: reprType,
                color: 'uniform',
                colorParams: { value: colorValue }
            });
        }
    } catch (e) {
        console.error(`Failed to add ${reprType}:`, e);
    }
}

// Helper: Add representation with color scheme
async function addRepresentationWithScheme(reprBuilder, component, reprType, colorScheme) {
    try {
        if (reprType === 'molecular-surface') {
            try {
                await reprBuilder.addRepresentation(component, {
                    type: 'molecular-surface',
                    color: colorScheme
                });
            } catch (e) {
                await reprBuilder.addRepresentation(component, {
                    type: 'gaussian-surface',
                    color: colorScheme
                });
            }
        } else if (reprType === 'ball-and-stick') {
            await reprBuilder.addRepresentation(component, {
                type: 'ball-and-stick',
                color: colorScheme,
                typeParams: { sizeFactor: RENDER_PARAMS.ATOM_SIZE_FACTOR, sizeAspectRatio: RENDER_PARAMS.ATOM_ASPECT_RATIO }
            });
        } else {
            await reprBuilder.addRepresentation(component, {
                type: reprType,
                color: colorScheme
            });
        }
    } catch (e) {
        console.error(`Failed to add ${reprType}:`, e);
    }
}

// Delete all polymer representations
async function deleteAllPolymerRepresentations(structureRef) {

    // Use state tree to find and delete all representations
    const state = plugin.state.data;
    const cells = state.cells;
    const toDelete = [];

    cells.forEach((cell, ref) => {
        if (!cell.obj) return;

        const obj = cell.obj;
        const label = obj.label?.toLowerCase() || '';
        const tags = cell.transform?.tags || [];

        // Check if it's a representation we want to delete
        const isRepr = obj.type?.name === 'representation-3d' ||
                       label.includes('cartoon') ||
                       label.includes('ball') ||
                       label.includes('stick') ||
                       label.includes('surface') ||
                       label.includes('gaussian');

        // Check if it's a custom color component, element color component, or atoms component
        const isColorComp = label.includes('color #') ||
                           label.includes('color ') ||
                           label.includes('uncolored') ||
                           label.includes('o atoms') ||
                           label.includes('n atoms') ||
                           label.includes('s atoms') ||
                           label.includes('atoms ') ||
                           label.includes('atoms (') ||
                           label.includes('selected') ||
                           tags.some(t => t.includes('color-') || t.includes('uncolored') || t.includes('element-') || t.includes('atoms-'));

        if (isRepr || isColorComp) {
            // Make sure it's related to polymer (not ligand/water/ion)
            const parentLabel = cell.sourceRef ?
                (state.cells.get(cell.sourceRef)?.obj?.label?.toLowerCase() || '') : '';

            if (!parentLabel.includes('ligand') &&
                !parentLabel.includes('ion') &&
                !parentLabel.includes('water')) {
                toDelete.push(ref);
            }
        }
    });


    // Delete all found items
    if (toDelete.length > 0) {
        const update = plugin.build();
        for (const ref of toDelete) {
            try {
                update.delete(ref);
            } catch (e) {
                // Ignore
            }
        }
        await update.commit();
    }

}

// Apply color to current selection
async function applyColorToSelection(hexColor) {
    if (!plugin || selectedResidues.size === 0) {
        return;
    }

    showLoading(true);

    const cameraSnapshot = plugin.canvas3d?.camera.getSnapshot();

    try {
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const structureRef = structures[structIndex];

        // Update color map for current structure
        const colorMap = getResidueColorMap();
        selectedResidues.forEach(key => {
            colorMap.set(key, hexColor);
        });

        // Delete existing and rebuild
        await deleteAllPolymerRepresentations(structureRef);
        await rebuildAllRepresentations(structureRef);

        // Update palette UI
        document.querySelectorAll('.palette-color').forEach(el => {
            el.classList.remove('active');
            if (el.style.background === hexColor || rgbToHex(el.style.background) === hexColor.toLowerCase()) {
                el.classList.add('active');
            }
        });


    } catch (error) {
        console.error('Color application error:', error);
    } finally {
        restoreCamera(cameraSnapshot);
        showLoading(false);
    }
}

async function setUniformColor(hexColor) {
    currentUniformColor = hexColor;
    currentColorScheme = null;

    // Clear residue color map for current structure (uniform = no per-residue colors)
    getResidueColorMap().clear();

    document.querySelectorAll('.control-btn[data-color]').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.palette-color').forEach(el => {
        el.classList.remove('active');
        if (el.style.background === hexColor || rgbToHex(el.style.background) === hexColor.toLowerCase()) {
            el.classList.add('active');
        }
    });

    if (!plugin || !currentStructure) return;

    showLoading(true);
    const cameraSnapshot = plugin.canvas3d?.camera.getSnapshot();

    try {
        const colorInt = parseInt(hexColor.replace('#', ''), 16);

        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const struct = structures[structIndex];

        // If atoms view is active, rebuild to preserve O, N, S colors
        if (atomsVisibleResidues.size > 0) {
            await deleteAllPolymerRepresentations(struct);
            await rebuildAllRepresentations(struct);
        } else {
            // Update color on all existing representations directly
            const components = struct.components || [];

            for (const comp of components) {
                if (!comp.representations) continue;

                for (const repr of comp.representations) {
                    if (!repr.cell?.obj) continue;

                    try {
                        const state = plugin.state.data;
                        const reprCell = repr.cell;

                        if (reprCell && reprCell.transform) {
                            const oldParams = reprCell.transform.params;
                            const newParams = {
                                ...oldParams,
                                colorTheme: {
                                    name: 'uniform',
                                    params: { value: colorInt }
                                }
                            };

                            const update = state.build().to(reprCell.transform.ref).update(newParams);
                            await plugin.runTask(state.updateTree(update));
                        }
                    } catch (e) {
                        // Silently ignore individual update errors
                    }
                }
            }
        }

        // Update focus representation color
        await updateFocusRepresentationColor(colorInt);

        // Restore camera
        restoreCamera(cameraSnapshot);

    } catch (error) {
        console.error('Uniform color error:', error);
    } finally {
        showLoading(false);
    }
}

// Update focus representation to use element-symbol with custom carbon color
// This ensures O, N, S maintain CPK colors while carbon uses the specified color
async function updateFocusRepresentationColor(colorInt) {
    if (!plugin) return;

    try {
        // 1. Update existing focus representations (if any are currently shown)
        const state = plugin.state.data;
        const focusTargetTag = 'structure-focus-target-repr';
        const focusSurrTag = 'structure-focus-surr-repr';

        const allCells = state.cells;
        const focusReprs = [];

        allCells.forEach((cell) => {
            if (cell.transform?.tags) {
                if (cell.transform.tags.includes(focusTargetTag) ||
                    cell.transform.tags.includes(focusSurrTag)) {
                    focusReprs.push(cell);
                }
            }
        });

        for (const reprCell of focusReprs) {
            if (!reprCell.transform) continue;

            const oldParams = reprCell.transform.params;
            const newParams = {
                ...oldParams,
                colorTheme: {
                    name: 'element-symbol',
                    params: {
                        carbonColor: {
                            name: 'uniform',
                            params: { value: colorInt }
                        },
                        saturation: 0,
                        lightness: 0.2,
                        colors: { name: 'default', params: {} }
                    }
                }
            };

            const update = state.build().to(reprCell.transform.ref).update(newParams);
            await plugin.runTask(state.updateTree(update));
        }

        // 2. Update focus behavior default params for future focus events
        const focusReprModule = await import('molstar/lib/mol-plugin/behavior/dynamic/selection/structure-focus-representation');
        const StructureFocusRepresentation = focusReprModule.StructureFocusRepresentation;

        if (plugin.state.hasBehavior(StructureFocusRepresentation)) {
            await plugin.state.updateBehavior(StructureFocusRepresentation, p => {
                const colorTheme = {
                    name: 'element-symbol',
                    params: {
                        carbonColor: {
                            name: 'uniform',
                            params: { value: colorInt }
                        },
                        saturation: 0,
                        lightness: 0.2,
                        colors: { name: 'default', params: {} }
                    }
                };
                p.targetParams.colorTheme = colorTheme;
                p.surroundingsParams.colorTheme = colorTheme;
            });
        }
    } catch (e) {
        console.error('Error updating focus representation color:', e);
    }
}

// Update focus representation to use chain-id colors (for chain coloring mode)
async function updateFocusRepresentationChainColor() {
    if (!plugin) return;

    try {
        const focusReprModule = await import('molstar/lib/mol-plugin/behavior/dynamic/selection/structure-focus-representation');
        const StructureFocusRepresentation = focusReprModule.StructureFocusRepresentation;

        if (plugin.state.hasBehavior(StructureFocusRepresentation)) {
            await plugin.state.updateBehavior(StructureFocusRepresentation, p => {
                const colorTheme = {
                    name: 'element-symbol',
                    params: {
                        carbonColor: {
                            name: 'chain-id',
                            params: {
                                asymId: 'auth',
                                palette: {
                                    name: 'colors',
                                    params: {
                                        list: {
                                            kind: 'set',
                                            colors: CHAIN_COLOR_PALETTE.map(hex => parseInt(hex.replace('#', ''), 16))
                                        }
                                    }
                                }
                            }
                        },
                        saturation: 0,
                        lightness: 0.2,
                        colors: { name: 'default', params: {} }
                    }
                };
                p.targetParams.colorTheme = colorTheme;
                p.surroundingsParams.colorTheme = colorTheme;
            });
        }
    } catch (e) {
        console.error('Error updating focus representation chain color:', e);
    }
}

function rgbToHex(rgb) {
    if (!rgb || rgb.startsWith('#')) return rgb;
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgb;
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function openColorPicker() {
    $('colorPicker').click();
}

function applyCustomColor(hexColor) {
    applyPaletteColor(hexColor);
}

// Chain color palette - 20 beautiful, visually distinct colors
// Combining Paul Tol's colorblind-friendly palette with scientific visualization standards
const CHAIN_COLOR_PALETTE = [
    '#4477AA',  // Tol Blue
    '#66CCEE',  // Tol Cyan
    '#228833',  // Tol Green
    '#44AA99',  // Tol Teal
    '#CCBB44',  // Tol Yellow
    '#EE7733',  // Tol Orange
    '#EE6677',  // Tol Red
    '#AA3377',  // Tol Pink
    '#332288',  // Tol Purple
    '#1E90FF',  // Dodger Blue
    '#FA8072',  // Salmon
    '#FFD700',  // Gold
    '#DA70D6',  // Orchid
    '#228B22',  // Forest Green
    '#FF7F50',  // Coral
    '#4682B4',  // Steel Blue
    '#9370DB',  // Medium Purple
    '#2E8B57',  // Sea Green
    '#FF6347',  // Tomato
    '#6A5ACD',  // Slate Blue
];

// Track previous chain colors to avoid same color assignment
let previousChainColors = new Map();

// Get a different color for each chain, avoiding previous colors
function getShuffledColorsAvoidingPrevious(chains, palette, prevColors) {
    const result = new Map();
    const availableColors = [...palette];

    chains.forEach(chain => {
        const prevColor = prevColors.get(chain);
        // Filter out previous color if available
        let candidates = prevColor
            ? availableColors.filter(c => c !== prevColor)
            : availableColors;

        // If all colors used, allow any color
        if (candidates.length === 0) {
            candidates = availableColors;
        }

        // Pick random color from candidates
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const selectedColor = candidates[randomIndex];
        result.set(chain, selectedColor);
    });

    return result;
}

// Apply chain-based coloring with custom palette
// skipCameraRestore: true when called during initial load (camera will be reset after)
async function applyChainColor(skipCameraRestore = false) {
    if (!plugin || !currentStructure) return;

    // Clear previous states for current structure
    const colorMap = getResidueColorMap();
    colorMap.clear();
    currentUniformColor = null;
    currentColorScheme = 'custom-chain';

    // Clear palette active states
    document.querySelectorAll('.palette-color').forEach(el => el.classList.remove('active'));

    showLoading(true);
    const cameraSnapshot = skipCameraRestore ? null : plugin.canvas3d?.camera.getSnapshot();

    try {
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const structureRef = structures[structIndex];

        // Get unique chains from sequence data
        const chains = [...new Set(sequenceData.map(r => r.chain))];

        // Get colors avoiding previous assignment
        const chainColors = getShuffledColorsAvoidingPrevious(chains, CHAIN_COLOR_PALETTE, previousChainColors);

        // Assign colors to each chain's residues
        chains.forEach(chain => {
            const color = chainColors.get(chain);
            sequenceData.forEach(res => {
                if (res.chain === chain) {
                    colorMap.set(`${res.chain}:${res.resno}`, color);
                }
            });
        });

        // Save current colors for next time
        previousChainColors = new Map(chainColors);


        // Delete existing and rebuild with new colors
        await deleteAllPolymerRepresentations(structureRef);
        await rebuildAllRepresentations(structureRef);

        // Update focus representation to use chain colors
        await updateFocusRepresentationChainColor();

        restoreCamera(cameraSnapshot);

    } catch (error) {
        console.error('Chain color error:', error);
    } finally {
        showLoading(false);
    }
}

// =====================================================
// STYLE - Set representation style for entire structure
// =====================================================
async function setStyle(style) {
    if (!plugin || !currentStructure) return;

    currentStyle = style;
    updateStyleButtons();

    showLoading(true);
    const cameraSnapshot = plugin.canvas3d?.camera.getSnapshot();

    try {
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const struct = structures[structIndex];

        // Remove existing representations
        const components = struct.components || [];
        for (const comp of components) {
            if (comp.representations) {
                for (const repr of comp.representations) {
                    try {
                        const update = plugin.build();
                        update.delete(repr.cell);
                        await update.commit();
                    } catch (e) {}
                }
            }
        }

        const reprBuilder = plugin.builders.structure.representation;
        const colorScheme = currentUniformColor ? 'uniform' : (currentColorScheme || 'chain-id');
        const colorParams = currentUniformColor ? { value: parseInt(currentUniformColor.replace('#', ''), 16) } : undefined;

        const polymerComp = await plugin.builders.structure.tryCreateComponentStatic(struct.cell, 'polymer');
        if (polymerComp) {
            if (style === 'surface') {
                // Try molecular-surface first, fallback to gaussian-surface
                try {
                    await reprBuilder.addRepresentation(polymerComp, {
                        type: 'molecular-surface',
                        color: colorScheme,
                        colorParams,
                        typeParams: { quality: 'auto', probeRadius: RENDER_PARAMS.PROBE_RADIUS, resolution: RENDER_PARAMS.SURFACE_RESOLUTION }
                    });
                } catch (e) {
                    await reprBuilder.addRepresentation(polymerComp, {
                        type: 'gaussian-surface',
                        color: colorScheme,
                        colorParams,
                        typeParams: { radiusOffset: 1, smoothness: RENDER_PARAMS.SURFACE_SMOOTHNESS }
                    });
                }
            } else if (style === 'ball-and-stick') {
                await reprBuilder.addRepresentation(polymerComp, { type: 'ball-and-stick', color: colorScheme, colorParams });
            } else {
                // Default: cartoon
                await reprBuilder.addRepresentation(polymerComp, { type: 'cartoon', color: colorScheme, colorParams });
            }
        }

        // Ligand (small molecules)
        const ligandComp = await plugin.builders.structure.tryCreateComponentStatic(struct.cell, 'ligand');
        if (ligandComp) {
            await reprBuilder.addRepresentation(ligandComp, { type: 'ball-and-stick', color: 'illustrative' });
        }

        // Carbohydrate (sugars/glycans)
        const carbComp = await plugin.builders.structure.tryCreateComponentStatic(struct.cell, 'branched');
        if (carbComp) {
            await reprBuilder.addRepresentation(carbComp, { type: 'carbohydrate', color: 'carbohydrate-symbol' });
        }

        // Ion
        const ionComp = await plugin.builders.structure.tryCreateComponentStatic(struct.cell, 'ion');
        if (ionComp) {
            await reprBuilder.addRepresentation(ionComp, { type: 'ball-and-stick', color: 'element-symbol' });
        }

        // Lipid
        const lipidComp = await plugin.builders.structure.tryCreateComponentStatic(struct.cell, 'lipid');
        if (lipidComp) {
            await reprBuilder.addRepresentation(lipidComp, { type: 'ball-and-stick', color: 'illustrative' });
        }

        // Coarse (for large assemblies)
        const coarseComp = await plugin.builders.structure.tryCreateComponentStatic(struct.cell, 'coarse');
        if (coarseComp) {
            await reprBuilder.addRepresentation(coarseComp, { type: 'spacefill', color: 'chain-id' });
        }

        // Non-standard residues
        const nonStdComp = await plugin.builders.structure.tryCreateComponentStatic(struct.cell, 'non-standard');
        if (nonStdComp) {
            await reprBuilder.addRepresentation(nonStdComp, { type: 'ball-and-stick', color: 'element-symbol' });
        }

        // Water
        const waterComp = await plugin.builders.structure.tryCreateComponentStatic(struct.cell, 'water');
        if (waterComp) {
            await reprBuilder.addRepresentation(waterComp, {
                type: 'ball-and-stick',
                color: 'element-symbol',
                sizeTheme: { name: 'uniform', params: { value: RENDER_PARAMS.UNIFORM_SIZE } }
            });
        }

        applyOutline(outlineEnabled);

        // Restore camera state AFTER changes (with delay to ensure rendering is complete)
        restoreCamera(cameraSnapshot);

    } catch (error) {
        console.error('Error setting style:', error);
    } finally {
        showLoading(false);
    }
}

// Update style button states
function updateStyleButtons() {
    document.querySelectorAll('.control-btn[data-style]').forEach(btn => {
        const btnStyle = btn.dataset.style;
        btn.classList.toggle('active', btnStyle === currentStyle);
    });
}

// =====================================================
// SHOW/HIDE REPRESENTATION CONTROLS
// =====================================================
async function showRepresentation(type) {
    if (!plugin || !currentStructure) return;

    showLoading(true);
    const cameraSnapshot = plugin.canvas3d?.camera.getSnapshot();

    try {
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const structureRef = structures[structIndex];


        if (type === 'atoms') {
            // ATOMS: Add selected residues (or all if none) to atomsVisibleResidues
            representationState.atoms = true;
            if (selectedResidues.size > 0) {
                selectedResidues.forEach(key => atomsVisibleResidues.add(key));
            } else {
                sequenceData.forEach(res => atomsVisibleResidues.add(`${res.chain}:${res.resno}`));
            }
        } else if (type === 'cartoon') {
            // CARTOON: Add selected residues (or switch to full mode if none)
            representationState.cartoon = true;
            if (selectedResidues.size > 0) {
                cartoonPartialMode = true;
                selectedResidues.forEach(key => cartoonVisibleResidues.add(key));
            } else {
                // No selection - full mode (show all)
                cartoonPartialMode = false;
                cartoonVisibleResidues.clear();
            }
        } else if (type === 'surface') {
            // SURFACE: Add selected residues (or switch to full mode if none)
            representationState.surface = true;
            if (selectedResidues.size > 0) {
                surfacePartialMode = true;
                selectedResidues.forEach(key => surfaceVisibleResidues.add(key));
            } else {
                // No selection - full mode (show all)
                surfacePartialMode = false;
                surfaceVisibleResidues.clear();
            }
        }

        // Always rebuild
        await deleteAllPolymerRepresentations(structureRef);
        await rebuildAllRepresentations(structureRef);

    } catch (error) {
        console.error(`Error showing ${type}:`, error);
    } finally {
        restoreCamera(cameraSnapshot);
        showLoading(false);
    }
}

async function hideRepresentation(type) {
    if (!plugin || !currentStructure) return;

    showLoading(true);
    const cameraSnapshot = plugin.canvas3d?.camera.getSnapshot();

    try {
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const structureRef = structures[structIndex];


        if (type === 'atoms') {
            // ATOMS: Remove selected residues (or all if none)
            if (selectedResidues.size > 0) {
                selectedResidues.forEach(key => atomsVisibleResidues.delete(key));
            } else {
                atomsVisibleResidues.clear();
            }
            representationState.atoms = atomsVisibleResidues.size > 0;

        } else if (type === 'cartoon') {
            // CARTOON: Remove selected residues (or turn off completely if none)
            if (selectedResidues.size > 0 && cartoonPartialMode) {
                selectedResidues.forEach(key => cartoonVisibleResidues.delete(key));
                // If no residues left, turn off cartoon
                if (cartoonVisibleResidues.size === 0) {
                    representationState.cartoon = false;
                    cartoonPartialMode = false;
                }
            } else {
                // No selection or full mode - turn off completely
                representationState.cartoon = false;
                cartoonPartialMode = false;
                cartoonVisibleResidues.clear();
            }

        } else if (type === 'surface') {
            // SURFACE: Remove selected residues (or turn off completely if none)
            if (selectedResidues.size > 0 && surfacePartialMode) {
                selectedResidues.forEach(key => surfaceVisibleResidues.delete(key));
                // If no residues left, turn off surface
                if (surfaceVisibleResidues.size === 0) {
                    representationState.surface = false;
                    surfacePartialMode = false;
                }
            } else {
                // No selection or full mode - turn off completely
                representationState.surface = false;
                surfacePartialMode = false;
                surfaceVisibleResidues.clear();
            }
        }

        // Rebuild to reflect the change
        await deleteAllPolymerRepresentations(structureRef);
        await rebuildAllRepresentations(structureRef);


    } catch (error) {
        console.error(`Error hiding ${type}:`, error);
    } finally {
        restoreCamera(cameraSnapshot);
        showLoading(false);
    }
}

// Outline
function toggleOutline() {
    outlineEnabled = !outlineEnabled;
    $('outlineBtn').classList.toggle('active', outlineEnabled);
    applyOutline(outlineEnabled);
}

function applyOutline(enabled) {
    if (!plugin?.canvas3d) return;

    try {
        plugin.canvas3d.setProps({
            postprocessing: {
                outline: {
                    name: enabled ? 'on' : 'off',
                    params: enabled ? {
                        scale: RENDER_PARAMS.OUTLINE_SCALE,
                        threshold: RENDER_PARAMS.OUTLINE_THRESHOLD,
                        color: { r: 0, g: 0, b: 0 },
                        includeTransparent: true
                    } : {}
                }
            }
        });
    } catch (error) {
        console.error('Outline error:', error);
    }
}

// View controls
function resetView() {
    if (plugin?.canvas3d) {
        plugin.canvas3d.requestCameraReset();
    }
}

function toggleSpin() {
    isSpinning = !isSpinning;
    $('spinBtn').classList.toggle('active', isSpinning);

    if (!plugin?.canvas3d) return;

    try {
        plugin.canvas3d.setProps({
            trackball: {
                animate: isSpinning
                    ? { name: 'spin', params: { speed: 1 } }
                    : { name: 'off', params: {} }
            }
        });
    } catch (error) {
        console.error('Spin error:', error);
    }
}

function takeScreenshot() {
    if (!plugin) return;

    try {
        const helpers = plugin.helpers;
        if (helpers?.viewportScreenshot) {
            helpers.viewportScreenshot.download({
                filename: currentStructure ? `${currentStructure}_screenshot.png` : 'screenshot.png'
            });
        }
    } catch (error) {
        console.error('Screenshot error:', error);
    }
}

function toggleLegend(event) {
    event.stopPropagation();
    $('legendTooltip')?.classList.toggle('show');
}

document.addEventListener('click', (e) => {
    const tooltip = $('legendTooltip');
    if (tooltip && !e.target.closest('.legend-toggle')) {
        tooltip.classList.remove('show');
    }
});

function setupSequenceWheelScroll() {
    const sequenceContent = document.querySelector('.sequence-content');
    if (!sequenceContent) return;

    sequenceContent.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            sequenceContent.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

// Selection groups
function saveCurrentSelectionAsGroup() {
    if (selectedResidues.size === 0) return;

    const newId = selectionGroups.length + 1;
    selectionGroups.push({
        id: newId,
        residues: new Set(selectedResidues),
        color: null,
        style: null
    });

    updateGroupListUI();
}

function selectGroup(groupId) {
    const group = selectionGroups.find(g => g.id === groupId);
    if (!group) return;

    selectedResidues = new Set(group.residues);
    updateSequenceHighlight();
    updateGroupListUI();
}

function deleteGroup(groupId) {
    const index = selectionGroups.findIndex(g => g.id === groupId);
    if (index === -1) return;

    selectionGroups.splice(index, 1);
    selectionGroups.forEach((g, i) => { g.id = i + 1; });
    updateGroupListUI();
}

function updateGroupListUI() {
    const groupList = $('groupList');
    const groupDivider = $('groupDivider');
    if (!groupList) return;

    groupList.innerHTML = '';

    selectionGroups.forEach(group => {
        const btn = document.createElement('button');
        btn.className = 'group-btn';
        btn.textContent = group.id;
        btn.title = `Group ${group.id} (${group.residues.size} residues)`;
        btn.onclick = () => selectGroup(group.id);
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm(`Delete Group ${group.id}?`)) deleteGroup(group.id);
        };
        groupList.appendChild(btn);
    });

    if (groupDivider) {
        groupDivider.style.display = selectionGroups.length > 0 ? 'block' : 'none';
    }

    updateSelButtonState();
}

function updateSelButtonState() {
    const selBtn = $('selBtn');
    if (!selBtn) return;

    const hasSelection = selectedResidues.size > 0;
    selBtn.classList.toggle('has-selection', hasSelection);
    selBtn.classList.toggle('empty', !hasSelection);
    selBtn.title = hasSelection ? `Current Selection (${selectedResidues.size} residues)` : 'No selection';
}

// Structures list
function addToStructuresList(id, name, structIndex) {
    if (loadedStructures.find(s => s.id === id)) return;

    loadedStructures.push({ id, name, structIndex, visible: true });
    currentStructureIndex = structIndex;
    updateStructuresListUI();
}

function updateStructuresListUI() {
    // Update floating structure tags in viewer
    const floatingContainer = $('floatingStructures');
    if (floatingContainer) {
        if (loadedStructures.length === 0) {
            floatingContainer.innerHTML = '';
        } else {
            floatingContainer.innerHTML = loadedStructures.map(struct => `
                <div class="structure-tag ${struct.id === currentStructure ? 'active' : ''} ${struct.visible ? '' : 'hidden-structure'}" onclick="focusOnStructure('${struct.id}')">
                    <span>${struct.name}</span>
                    <button class="tag-visibility ${struct.visible ? 'visible' : 'hidden'}" onclick="event.stopPropagation(); toggleStructureVisibility('${struct.id}')" title="${struct.visible ? 'Hide' : 'Show'}">
                        <i class="fas ${struct.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </button>
                    <button class="tag-download" onclick="event.stopPropagation(); downloadStructure('${struct.id}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="tag-delete" onclick="event.stopPropagation(); removeStructure('${struct.id}')" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
    }
}

async function toggleStructureVisibility(structureId) {
    if (!plugin) return;

    const structInfo = loadedStructures.find(s => s.id === structureId);
    if (!structInfo) return;

    const structures = plugin.managers.structure.hierarchy.current.structures;

    // Find the structure
    let structIndex = -1;
    for (let i = 0; i < structures.length; i++) {
        const s = structures[i];
        const label = s.cell.obj?.label || '';
        if (label.includes(structureId) || structureId.includes(label) ||
            label.toLowerCase().includes(structureId.toLowerCase())) {
            structIndex = i;
            break;
        }
    }

    if (structIndex === -1) {
        structIndex = Math.min(structInfo.structIndex, structures.length - 1);
    }

    if (structIndex >= 0 && structIndex < structures.length) {
        const struct = structures[structIndex];

        // Toggle visibility for all components and representations
        const newVisible = !structInfo.visible;
        structInfo.visible = newVisible;

        try {
            // Toggle visibility of the structure's components
            const components = struct.components || [];
            for (const comp of components) {
                if (!comp.cell) continue;

                // Update component visibility
                plugin.state.data.updateCellState(comp.cell.transform.ref, { isHidden: !newVisible });

                // Also update all representations
                if (comp.representations) {
                    for (const repr of comp.representations) {
                        if (repr.cell) {
                            plugin.state.data.updateCellState(repr.cell.transform.ref, { isHidden: !newVisible });
                        }
                    }
                }
            }

        } catch (e) {
            console.error('Toggle visibility error:', e);
        }

        updateStructuresListUI();
    }
}

function focusOnStructure(structureId) {
    if (!plugin) return;

    const structInfo = loadedStructures.find(s => s.id === structureId);
    if (!structInfo) return;

    currentStructure = structureId;
    updateStructuresListUI();

    const structures = plugin.managers.structure.hierarchy.current.structures;
    let foundIndex = structures.findIndex(s => {
        const label = s.cell.obj?.label || '';
        return label.includes(structureId) || structureId.includes(label);
    });

    if (foundIndex === -1) foundIndex = Math.min(structInfo.structIndex, structures.length - 1);

    if (foundIndex >= 0 && foundIndex < structures.length) {
        currentStructureIndex = foundIndex;
        const struct = structures[foundIndex];

        try {
            const data = struct.cell.obj?.data;
            if (data) {
                plugin.managers.camera.focusLoci({ kind: 'structure-loci', structure: data });
            }
        } catch (e) {
            plugin.canvas3d?.requestCameraReset();
        }

        extractSequenceFromStructure(struct);
        selectedResidues.clear();
        updateSelectionInfo();

        // Clear selection-related state but PRESERVE color state
        atomsVisibleResidues.clear();
        cartoonVisibleResidues.clear();
        surfaceVisibleResidues.clear();
        cartoonPartialMode = false;
        surfacePartialMode = false;
        // Keep residueColorMap, currentUniformColor, currentColorScheme - don't reset colors!
        representationState = { atoms: false, cartoon: true, surface: false };

        // Clear highlight when switching structures
        plugin.managers.interactivity.lociHighlights.clearHighlights();

        // Rebuild representations with current color state preserved
        rebuildAllRepresentations(struct);
    }
}

async function removeStructure(structureId) {
    if (!plugin) return;

    showLoading(true);

    try {
        const structures = plugin.managers.structure.hierarchy.current.structures;

        // Find structure by ID matching
        let structIndex = -1;
        for (let i = 0; i < structures.length; i++) {
            const s = structures[i];
            const label = s.cell.obj?.label || '';
            if (label.includes(structureId) || structureId.includes(label) ||
                label.toLowerCase().includes(structureId.toLowerCase())) {
                structIndex = i;
                break;
            }
        }

        // If not found by label, use index from loadedStructures
        if (structIndex === -1) {
            const structInfo = loadedStructures.find(s => s.id === structureId);
            if (structInfo) {
                structIndex = structInfo.structIndex;
            }
        }

        if (structIndex >= 0 && structIndex < structures.length) {
            const structToRemove = structures[structIndex];

            // Find the root data node to delete (goes up to trajectory/model level)
            let cellToDelete = structToRemove.cell;

            // Get the state tree
            const state = plugin.state.data;

            // Navigate up to find the download/data root
            const findRootCell = (cell) => {
                if (!cell || !cell.transform) return cell;

                const parentRef = cell.transform.parent;
                if (!parentRef || parentRef === state.tree.root.ref) {
                    return cell;
                }

                const parentCell = state.cells.get(parentRef);
                if (!parentCell) return cell;

                // Check if parent is root or download node
                const parentObj = parentCell.obj;
                if (parentObj && (parentObj.type?.name === 'root' || !parentCell.transform.parent)) {
                    return cell;
                }

                return findRootCell(parentCell);
            };

            cellToDelete = findRootCell(structToRemove.cell);

            // Delete the cell
            const update = plugin.build();
            update.delete(cellToDelete);
            await update.commit();

        }

        // Update local state
        loadedStructures = loadedStructures.filter(s => s.id !== structureId);

        // Re-index remaining structures
        loadedStructures.forEach((s, i) => {
            s.structIndex = i;
        });

        updateStructuresListUI();

        if (currentStructure === structureId) {
            if (loadedStructures.length > 0) {
                currentStructure = loadedStructures[0].id;
                currentStructureIndex = 0;
                focusOnStructure(currentStructure);
            } else {
                currentStructure = null;
                currentStructureIndex = -1;
                sequenceData = [];
                selectedResidues = new Set();
                $('sequenceDisplay').innerHTML = '';
                $('chainSelect').innerHTML = '<option value="">All</option>';

                // Clear hover info display
                const hoverInfo = $('hoverInfo');
                if (hoverInfo) {
                    hoverInfo.innerHTML = '';
                    hoverInfo.classList.remove('visible');
                }
            }
        }
    } catch (error) {
        console.error('Remove structure error:', error);
    } finally {
        showLoading(false);
    }
}

async function clearAllStructures() {
    if (!plugin || loadedStructures.length === 0) return;

    showLoading(true);

    try {
        // Get all structures
        const structures = plugin.managers.structure.hierarchy.current.structures;

        // Delete each structure's root cell
        const state = plugin.state.data;

        for (const struct of structures) {
            try {
                // Find root cell for this structure
                let cellToDelete = struct.cell;
                let currentCell = struct.cell;

                while (currentCell && currentCell.transform && currentCell.transform.parent) {
                    const parentRef = currentCell.transform.parent;
                    if (!parentRef || parentRef === state.tree.root.ref) break;

                    const parentCell = state.cells.get(parentRef);
                    if (!parentCell) break;

                    cellToDelete = parentCell;
                    currentCell = parentCell;
                }

                const update = plugin.build();
                update.delete(cellToDelete);
                await update.commit();
            } catch (e) {
                console.error('Error deleting structure:', e);
            }
        }

        // Reset all state
        loadedStructures = [];
        currentStructure = null;
        currentStructureIndex = -1;
        residueColorMaps.clear();
        atomsVisibleResidues.clear();
        cartoonVisibleResidues.clear();
        surfaceVisibleResidues.clear();
        cartoonPartialMode = false;
        surfacePartialMode = false;
        currentUniformColor = null;
        currentColorScheme = 'chain-id';
        representationState = { atoms: false, cartoon: true, surface: false };
        representationComponents = { atoms: null, cartoon: null, surface: null };

        updateStructuresListUI();

        sequenceData = [];
        selectedResidues = new Set();
        selectionGroups = [];
        updateGroupListUI();

        $('sequenceDisplay').innerHTML = '';
        $('chainSelect').innerHTML = '<option value="">All</option>';

        // Clear hover info display
        const hoverInfo = $('hoverInfo');
        if (hoverInfo) {
            hoverInfo.innerHTML = '';
            hoverInfo.classList.remove('visible');
        }

    } catch (error) {
        console.error('Clear error:', error);
    } finally {
        showLoading(false);
    }
}

// Export to window
window.loadFromPDB = loadFromPDB;
window.loadFromFile = loadFromFile;
window.setStyle = setStyle;
window.toggleOutline = toggleOutline;
window.resetView = resetView;
window.toggleSpin = toggleSpin;
window.takeScreenshot = takeScreenshot;
window.applyPaletteColor = applyPaletteColor;
window.openColorPicker = openColorPicker;
window.applyCustomColor = applyCustomColor;
window.changeSequenceChain = changeSequenceChain;
window.toggleLegend = toggleLegend;
window.deselectAll = deselectAll;
window.saveCurrentSelectionAsGroup = saveCurrentSelectionAsGroup;
window.selectGroup = selectGroup;
window.deleteGroup = deleteGroup;
window.focusOnStructure = focusOnStructure;
window.removeStructure = removeStructure;
window.clearAllStructures = clearAllStructures;
window.applySecondaryStructureColoring = applySecondaryStructureColoring;
window.showRepresentation = showRepresentation;
window.hideRepresentation = hideRepresentation;
window.applyChainColor = applyChainColor;
window.toggleStructureVisibility = toggleStructureVisibility;
window.downloadStructure = downloadStructure;
window.cleanup = cleanup;

// Download structure as PDB file
async function downloadStructure(structureId) {
    if (!plugin) return;

    const structInfo = loadedStructures.find(s => s.id === structureId);
    if (!structInfo) {
        console.error('Structure not found:', structureId);
        return;
    }

    showLoading(true);

    try {
        const structures = plugin.managers.structure.hierarchy.current.structures;

        // Find the structure
        let structIndex = -1;
        for (let i = 0; i < structures.length; i++) {
            const s = structures[i];
            const label = s.cell.obj?.label || '';
            if (label.includes(structureId) || structureId.includes(label) ||
                label.toLowerCase().includes(structureId.toLowerCase())) {
                structIndex = i;
                break;
            }
        }

        if (structIndex === -1) {
            structIndex = Math.min(structInfo.structIndex, structures.length - 1);
        }

        if (structIndex >= 0 && structIndex < structures.length) {
            const struct = structures[structIndex];
            const data = struct.cell.obj?.data;

            if (data) {
                // Use Mol* built-in export to get PDB string
                const { to_mmCIF } = await import('molstar/lib/mol-model/structure/export/mmcif');
                const cifString = to_mmCIF(structInfo.name || structureId, data, false);

                // Create and download file
                const blob = new Blob([cifString], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${structInfo.name || structureId}.cif`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

            }
        }
    } catch (error) {
        console.error('Download error:', error);
        showToast('Failed to download structure', 'error');
    } finally {
        showLoading(false);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initViewer();
    setupSequenceWheelScroll();

    $('pdbId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadFromPDB();
    });
});

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
