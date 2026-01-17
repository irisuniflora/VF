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

// State variables
let viewer = null;
let plugin = null;
let currentStructure = null;
let isSpinning = false;
let outlineEnabled = true;
let currentStyle = 'cartoon';
let currentColorScheme = 'chain-id';
let currentUniformColor = null;

// Loaded structures list
let loadedStructures = [];
let currentStructureIndex = -1;

// Selection groups state
let selectionGroups = [];

// Representation visibility state
let representationState = {
    atoms: false,      // ball-and-stick for polymer
    cartoon: true,     // cartoon representation
    surface: false     // molecular surface
};
let representationComponents = {
    atoms: null,
    cartoon: null,
    surface: null
};

// Sequence and selection state
let sequenceData = [];
let selectedResidues = new Set();
let currentChainFilter = '';
let isSelecting = false;
let selectionStart = null;

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
    const viewerElement = document.getElementById('viewer');

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

    // Set highlight color to bright green/yellow for visibility
    if (plugin.canvas3d) {
        plugin.canvas3d.setProps({
            renderer: {
                selectColor: Color(0x00FF00),      // Bright green for selection
                highlightColor: Color(0xFFFF00),   // Yellow for highlight
            },
            marking: {
                enabled: true,
                highlightEdgeColor: Color(0xFFFF00),
                selectEdgeColor: Color(0x00FF00),
                highlightEdgeStrength: 1,
                selectEdgeStrength: 1,
            }
        });
    }

    // Add click listener for deselecting when clicking empty space
    plugin.canvas3d.input.click.subscribe(async (e) => {
        // Check if clicked on empty space (no structure)
        const pickResult = plugin.canvas3d.identify(e.x, e.y);
        // Empty space means no repr or repr is undefined/null
        const clickedEmptySpace = !pickResult || !pickResult.repr || pickResult.repr.ref === '';
        if (clickedEmptySpace) {
            // Clicked on empty space - deselect all
            console.log('Empty space clicked - clearing selection');
            await deselectAll();
        }
    });

    console.log('Mol* Viewer initialized');
    console.log('Internal plugin access:', !!plugin);
}

// Show/hide loading
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// Load from PDB
async function loadFromPDB() {
    const pdbId = document.getElementById('pdbId').value.trim().toUpperCase();
    if (!pdbId || pdbId.length !== 4) {
        alert('Please enter a valid 4-character PDB ID');
        return;
    }

    showLoading(true);

    try {
        await viewer.loadPdb(pdbId);
        currentStructure = pdbId;

        const structures = plugin.managers.structure.hierarchy.current.structures;
        const newIndex = structures.length - 1;

        addToStructuresList(pdbId, pdbId, newIndex);

        setTimeout(() => {
            extractSequenceFromIndex(newIndex);
            applyOutline(outlineEnabled);
        }, 500);

        document.getElementById('pdbId').value = '';
        console.log(`Loaded structure: ${pdbId}`);

    } catch (error) {
        console.error('Error loading structure:', error);
        alert(`Failed to load structure: ${pdbId}`);
    } finally {
        showLoading(false);
    }
}

// Load from file
async function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true);

    try {
        const fileData = await file.text();
        let format = 'pdb';
        if (file.name.endsWith('.cif') || file.name.endsWith('.mcif')) {
            format = 'mmcif';
        } else if (file.name.endsWith('.mol2')) {
            format = 'mol2';
        }

        await viewer.loadStructureFromData(fileData, format, {
            dataLabel: file.name
        });

        currentStructure = file.name;

        const structures = plugin.managers.structure.hierarchy.current.structures;
        const newIndex = structures.length - 1;

        const displayName = file.name.replace(/\.(pdb|cif|mcif|mol2)$/i, '');
        addToStructuresList(file.name, displayName, newIndex);

        setTimeout(() => {
            extractSequenceFromIndex(newIndex);
            applyOutline(outlineEnabled);
        }, 500);

        console.log(`Loaded file: ${file.name}`);
    } catch (error) {
        console.error('Error loading file:', error);
        alert(`Failed to load file: ${file.name}`);
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

        console.log(`Extracted ${sequenceData.length} residues from ${chains.size} chains`);

    } catch (error) {
        console.error('Error extracting sequence:', error);
    }
}

function updateChainSelector(chains) {
    const select = document.getElementById('chainSelect');
    select.innerHTML = '<option value="">All Chains</option>';

    chains.sort().forEach(chain => {
        const option = document.createElement('option');
        option.value = chain;
        option.textContent = `Chain ${chain}`;
        select.appendChild(option);
    });
}

function displaySequence() {
    const container = document.getElementById('sequenceDisplay');
    const chainInfoEl = document.getElementById('chainInfo');
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

        html += `<span class="sequence-residue ${isSelected ? 'selected' : ''} ${propertyClass}"
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
    const container = document.getElementById('sequenceDisplay');
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
            console.log(`Selection synced: ${selectedResidues.size} residues`);
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
    const badge = document.getElementById('selectionBadge');
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

async function deselectAll() {
    console.log('deselectAll called');
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
            console.log('Selection manager cleared');

            // 2. Clear loci highlights (yellow hover highlight)
            plugin.managers.interactivity.lociHighlights.clearHighlights();
            console.log('Loci highlights cleared');

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
            console.log('Canvas repaint requested');

        } catch (e) {
            console.error('Error clearing selection:', e);
        }
    }
}

function changeSequenceChain() {
    currentChainFilter = document.getElementById('chainSelect').value;
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
        if (cameraSnapshot && plugin.canvas3d) {
            setTimeout(() => {
                plugin.canvas3d.camera.setState(cameraSnapshot, 0);
            }, 50);
        }

        console.log('Secondary structure coloring applied');

    } catch (error) {
        console.error('Secondary structure coloring error:', error);
    } finally {
        showLoading(false);
    }
}

// =====================================================
// COLOR & STYLE APPLICATION - Component-based approach
// residueColorMap stores color per residue
// When applying color or style, rebuild all representations by color groups
// =====================================================

// Map: residue key ("A:1") -> hex color ("#FF0000")
let residueColorMap = new Map();

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
async function rebuildAllRepresentations(structureRef) {
    const reprBuilder = plugin.builders.structure.representation;

    // Group residues by color
    const colorGroups = new Map(); // color -> Set of residue keys
    residueColorMap.forEach((color, key) => {
        if (!colorGroups.has(color)) colorGroups.set(color, new Set());
        colorGroups.get(color).add(key);
    });

    // Get all residue keys
    const allResidueKeys = new Set();
    sequenceData.forEach(res => {
        allResidueKeys.add(`${res.chain}:${res.resno}`);
    });

    // Find uncolored residues
    const uncoloredResidues = new Set();
    allResidueKeys.forEach(key => {
        if (!residueColorMap.has(key)) {
            uncoloredResidues.add(key);
        }
    });

    // Determine which repr types to create
    const activeTypes = [];
    if (representationState.cartoon) activeTypes.push('cartoon');
    if (representationState.atoms) activeTypes.push('ball-and-stick');
    if (representationState.surface) activeTypes.push('molecular-surface');

    // Default to cartoon if nothing active
    if (activeTypes.length === 0) {
        activeTypes.push('cartoon');
        representationState.cartoon = true;
    }

    console.log(`rebuildAllRepresentations: ${colorGroups.size} color groups, ${uncoloredResidues.size} uncolored, types: ${activeTypes.join(',')}`);

    // Create representations for each color group
    for (const [color, residueSet] of colorGroups) {
        const colorValue = parseInt(color.replace('#', ''), 16);
        const query = buildSelectionQuery(residueSet);

        const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
            structureRef.cell,
            query,
            `color-${color.replace('#', '')}-${Date.now()}`,
            { label: `Color ${color}` }
        );

        if (comp) {
            for (const reprType of activeTypes) {
                await addRepresentationWithColor(reprBuilder, comp, reprType, colorValue);
            }
        }
    }

    // Create representations for uncolored residues
    if (uncoloredResidues.size > 0) {
        const query = buildSelectionQuery(uncoloredResidues);
        const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
            structureRef.cell,
            query,
            `uncolored-${Date.now()}`,
            { label: 'Uncolored' }
        );

        if (comp) {
            for (const reprType of activeTypes) {
                if (currentUniformColor) {
                    const colorValue = parseInt(currentUniformColor.replace('#', ''), 16);
                    await addRepresentationWithColor(reprBuilder, comp, reprType, colorValue);
                } else {
                    await addRepresentationWithScheme(reprBuilder, comp, reprType, currentColorScheme || 'chain-id');
                }
            }
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
    const components = structureRef.components || [];

    for (const comp of components) {
        // Skip non-polymer components (ligand, ion, water, etc.)
        const compKey = comp.key?.toLowerCase() || '';
        if (compKey.includes('ligand') || compKey.includes('ion') ||
            compKey.includes('water') || compKey.includes('branched')) {
            continue;
        }

        if (!comp.representations) continue;

        for (const repr of comp.representations) {
            if (!repr.cell) continue;

            const reprLabel = repr.cell.obj?.repr?.label?.toLowerCase() || '';

            // Delete polymer representations
            if (reprLabel.includes('cartoon') || reprLabel.includes('ball') ||
                reprLabel.includes('stick') || reprLabel.includes('surface')) {
                try {
                    const update = plugin.build();
                    update.delete(repr.cell);
                    await update.commit();
                } catch (e) {
                    // Ignore
                }
            }
        }
    }

    // Also delete custom color components
    for (const comp of components) {
        const compKey = comp.key?.toLowerCase() || '';
        if (compKey.includes('color-') || compKey.includes('uncolored')) {
            try {
                const update = plugin.build();
                update.delete(comp.cell);
                await update.commit();
            } catch (e) {
                // Ignore
            }
        }
    }
}

// Apply color to current selection
async function applyColorToSelection(hexColor) {
    if (!plugin || selectedResidues.size === 0) {
        console.log('applyColorToSelection: no selection');
        return;
    }

    console.log(`applyColorToSelection: ${hexColor}, ${selectedResidues.size} residues`);
    showLoading(true);

    const cameraSnapshot = plugin.canvas3d?.camera.getSnapshot();

    try {
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const structureRef = structures[structIndex];

        // Update color map
        selectedResidues.forEach(key => {
            residueColorMap.set(key, hexColor);
        });
        console.log(`residueColorMap: ${residueColorMap.size} entries`);

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

        console.log('Color applied');

    } catch (error) {
        console.error('Color application error:', error);
    } finally {
        if (cameraSnapshot && plugin.canvas3d) {
            plugin.canvas3d.camera.setState(cameraSnapshot, 0);
            plugin.canvas3d.requestDraw(true);
        }
        showLoading(false);
    }
}

async function setUniformColor(hexColor) {
    currentUniformColor = hexColor;
    currentColorScheme = null;

    // Clear residue color map
    residueColorMap.clear();
    console.log('setUniformColor: cleared residueColorMap');

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

        // Get fresh hierarchy reference
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return;

        const structIndex = (currentStructureIndex >= 0 && currentStructureIndex < structures.length)
            ? currentStructureIndex : 0;
        const struct = structures[structIndex];

        // Iterate through fresh components list
        const components = struct.components || [];
        console.log(`setUniformColor: Found ${components.length} components`);

        let updatedCount = 0;
        for (const comp of components) {
            if (!comp.representations) continue;

            for (const repr of comp.representations) {
                if (!repr.cell?.obj) continue;

                // Get repr type for logging
                const reprLabel = repr.cell.obj?.repr?.label || 'unknown';
                console.log(`Updating color for: ${reprLabel}`);

                try {
                    // Update color theme directly on the representation cell
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
                        updatedCount++;
                    }
                } catch (e) {
                    console.error(`Color update error for ${reprLabel}:`, e);
                }
            }
        }

        console.log(`Uniform color applied: ${hexColor} to ${updatedCount} representations`);

        // Restore camera
        if (cameraSnapshot && plugin.canvas3d) {
            setTimeout(() => {
                plugin.canvas3d.camera.setState(cameraSnapshot, 0);
            }, 50);
        }

    } catch (error) {
        console.error('Uniform color error:', error);
    } finally {
        showLoading(false);
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
    document.getElementById('colorPicker').click();
}

function applyCustomColor(hexColor) {
    applyPaletteColor(hexColor);
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
                        typeParams: { quality: 'auto', probeRadius: 1.4, resolution: 2 }
                    });
                } catch (e) {
                    await reprBuilder.addRepresentation(polymerComp, {
                        type: 'gaussian-surface',
                        color: colorScheme,
                        colorParams,
                        typeParams: { radiusOffset: 1, smoothness: 1.5 }
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
                sizeTheme: { name: 'uniform', params: { value: 0.4 } }
            });
        }

        applyOutline(outlineEnabled);

        // Restore camera state AFTER changes (with delay to ensure rendering is complete)
        if (cameraSnapshot && plugin.canvas3d) {
            setTimeout(() => {
                plugin.canvas3d.camera.setState(cameraSnapshot, 0);
            }, 50);
        }

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

        // Update state first
        representationState[type] = true;
        console.log(`Show ${type}`);

        // If we have colored residues, rebuild all with colors
        if (residueColorMap.size > 0) {
            await deleteAllPolymerRepresentations(structureRef);
            await rebuildAllRepresentations(structureRef);
        } else {
            // No colors - simple add to polymer component
            const reprBuilder = plugin.builders.structure.representation;

            let polymerComp = null;
            const components = structureRef.components || [];
            for (const comp of components) {
                if (comp.key === 'polymer' || comp.key === 'structure-component-static-polymer') {
                    polymerComp = comp.cell;
                    break;
                }
            }

            if (!polymerComp) {
                polymerComp = await plugin.builders.structure.tryCreateComponentStatic(structureRef.cell, 'polymer');
            }

            if (polymerComp) {
                const colorScheme = currentUniformColor ? 'uniform' : (currentColorScheme || 'chain-id');
                const colorParams = currentUniformColor ? { value: parseInt(currentUniformColor.replace('#', ''), 16) } : undefined;

                if (type === 'atoms') {
                    await reprBuilder.addRepresentation(polymerComp, {
                        type: 'ball-and-stick',
                        color: colorScheme,
                        colorParams
                    });
                } else if (type === 'cartoon') {
                    await reprBuilder.addRepresentation(polymerComp, {
                        type: 'cartoon',
                        color: colorScheme,
                        colorParams
                    });
                } else if (type === 'surface') {
                    try {
                        await reprBuilder.addRepresentation(polymerComp, {
                            type: 'molecular-surface',
                            color: colorScheme,
                            colorParams,
                            typeParams: { quality: 'auto', probeRadius: 1.4, resolution: 2 }
                        });
                    } catch (surfaceError) {
                        await reprBuilder.addRepresentation(polymerComp, {
                            type: 'gaussian-surface',
                            color: colorScheme,
                            colorParams,
                            typeParams: { radiusOffset: 1, smoothness: 1.5 }
                        });
                    }
                }
            }
        }

    } catch (error) {
        console.error(`Error showing ${type}:`, error);
    } finally {
        if (cameraSnapshot && plugin.canvas3d) {
            plugin.canvas3d.camera.setState(cameraSnapshot, 0);
            plugin.canvas3d.requestDraw(true);
        }
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
        const struct = structures[structIndex];

        // Map type to Mol* representation names
        const typeMap = {
            'atoms': ['ball-and-stick', 'ball+stick', 'ballandstick'],
            'cartoon': ['cartoon', 'ribbon'],
            'surface': ['molecular-surface', 'gaussian-surface', 'molecularsurface', 'gaussiansurface']
        };
        const targetTypes = typeMap[type] || [];

        let removed = false;

        // Iterate through hierarchy components and check representation type
        const components = struct.components || [];
        for (const comp of components) {
            if (!comp.representations) continue;

            for (const repr of comp.representations) {
                if (!repr.cell) continue;

                // Get representation type from multiple sources
                let reprTypeName = null;

                // Method 1: From cell.obj.repr.label (most reliable)
                if (repr.cell.obj?.repr?.label) {
                    reprTypeName = repr.cell.obj.repr.label;
                }

                // Method 2: From transform params
                if (!reprTypeName && repr.cell.transform?.params?.type?.name) {
                    reprTypeName = repr.cell.transform.params.type.name;
                }

                // Method 3: From state params
                if (!reprTypeName && repr.cell.obj?.params?.values?.type?.name) {
                    reprTypeName = repr.cell.obj.params.values.type.name;
                }

                console.log(`Component ${comp.key} repr: ${reprTypeName}`);

                // Check if this representation matches our target type
                if (reprTypeName) {
                    const normalizedType = reprTypeName.toLowerCase().replace(/[\s-]/g, '');
                    const shouldRemove = targetTypes.some(t => {
                        const normalizedTarget = t.toLowerCase().replace(/[\s-]/g, '');
                        return normalizedType === normalizedTarget ||
                               normalizedType.includes(normalizedTarget);
                    });

                    if (shouldRemove) {
                        try {
                            const update = plugin.build();
                            update.delete(repr.cell);
                            await update.commit();
                            removed = true;
                            console.log(`Removed representation: ${reprTypeName}`);
                        } catch (e) {
                            console.error('Error deleting repr:', e);
                        }
                    }
                }
            }
        }

        if (removed) {
            representationState[type] = false;
            representationComponents[type] = null;
        }

        console.log(`Hide ${type}: ${removed ? 'success' : 'no matching repr found'}`);

    } catch (error) {
        console.error(`Error hiding ${type}:`, error);
    } finally {
        // ALWAYS restore camera at the end
        if (cameraSnapshot && plugin.canvas3d) {
            plugin.canvas3d.camera.setState(cameraSnapshot, 0);
            plugin.canvas3d.requestDraw(true);
        }
        showLoading(false);
    }
}

// Outline
function toggleOutline() {
    outlineEnabled = !outlineEnabled;
    document.getElementById('outlineBtn').classList.toggle('active', outlineEnabled);
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
                        scale: 1.0,
                        threshold: 0.33,
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
    document.getElementById('spinBtn').classList.toggle('active', isSpinning);

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
    document.getElementById('legendTooltip')?.classList.toggle('show');
}

document.addEventListener('click', (e) => {
    const tooltip = document.getElementById('legendTooltip');
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
    console.log(`Group ${newId} saved`);
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
    const groupList = document.getElementById('groupList');
    const groupDivider = document.getElementById('groupDivider');
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
    const selBtn = document.getElementById('selBtn');
    if (!selBtn) return;

    const hasSelection = selectedResidues.size > 0;
    selBtn.classList.toggle('has-selection', hasSelection);
    selBtn.classList.toggle('empty', !hasSelection);
    selBtn.title = hasSelection ? `Current Selection (${selectedResidues.size} residues)` : 'No selection';
}

// Structures list
function addToStructuresList(id, name, structIndex) {
    if (loadedStructures.find(s => s.id === id)) return;

    loadedStructures.push({ id, name, structIndex });
    currentStructureIndex = structIndex;
    updateStructuresListUI();
}

function updateStructuresListUI() {
    const container = document.getElementById('structuresList');
    if (!container) return;

    if (loadedStructures.length === 0) {
        container.innerHTML = '<div class="no-structures">No structures loaded</div>';
        return;
    }

    container.innerHTML = loadedStructures.map(struct => `
        <div class="structure-item ${struct.id === currentStructure ? 'active' : ''}" onclick="focusOnStructure('${struct.id}')">
            <span class="structure-name">${struct.name}</span>
            <button class="structure-delete" onclick="event.stopPropagation(); removeStructure('${struct.id}')" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
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

        // Clear highlight when switching structures
        plugin.managers.interactivity.lociHighlights.clearHighlights();
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

            console.log(`Removed structure: ${structureId}`);
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
                document.getElementById('sequenceDisplay').innerHTML = '';
                document.getElementById('chainSelect').innerHTML = '<option value="">All</option>';
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
        residueColorMap.clear();
        currentUniformColor = null;
        representationState = { atoms: false, cartoon: true, surface: false };
        representationComponents = { atoms: null, cartoon: null, surface: null };

        updateStructuresListUI();

        sequenceData = [];
        selectedResidues = new Set();
        selectionGroups = [];
        updateGroupListUI();

        document.getElementById('sequenceDisplay').innerHTML = '';
        document.getElementById('chainSelect').innerHTML = '<option value="">All</option>';

        console.log('All structures cleared');
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initViewer();
    setupSequenceWheelScroll();

    document.getElementById('pdbId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadFromPDB();
    });
});
