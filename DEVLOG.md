# VF Mol* Viewer 개발 로그

## 해결된 문제들

---

### 1. 색상 변경 시 Representation이 Cartoon으로 리셋되는 문제

**문제**: 색상을 변경하면 기존 representation(atoms, surface 등)이 사라지고 cartoon으로 돌아감

**원인**: `updateRepresentationsTheme()` 사용 시 내부적으로 representation을 재생성함

**해결**: State tree를 직접 업데이트하여 색상만 변경
```javascript
// main.js - setUniformColor 함수
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
```

**핵심**: `state.build().to(ref).update(params)` 패턴으로 기존 representation 유지하면서 속성만 변경

---

### 2. 빈 공간 클릭 시 Selection Highlight가 해제되지 않는 문제

**문제**: 빈 공간을 좌클릭해도 서열 선택은 해제되지만 구조의 초록색 highlight가 그대로 남아있음

**원인**: Mol*에는 여러 레이어의 시각적 효과가 있어서 모두 클리어해야 함

**해결 1**: 클릭 감지 조건 강화 (main.js:112-122)
```javascript
plugin.canvas3d.input.click.subscribe(async (e) => {
    const pickResult = plugin.canvas3d.identify(e.x, e.y);
    // 여러 조건으로 빈 공간 체크
    const clickedEmptySpace = !pickResult || !pickResult.repr || pickResult.repr.ref === '';
    if (clickedEmptySpace) {
        console.log('Empty space clicked - clearing selection');
        await deselectAll();
    }
});
```

**해결 2**: `deselectAll()` 함수에서 모든 시각 효과 클리어 (main.js:555-601)
```javascript
async function deselectAll() {
    selectedResidues.clear();
    // UI 업데이트...

    if (plugin) {
        // 1. Selection manager 클리어 (초록색 selection outline)
        plugin.managers.structure.selection.clear();

        // 2. Loci highlights 클리어 (노란색 hover highlight)
        plugin.managers.interactivity.lociHighlights.clearHighlights();

        // 3. Loci marks 클리어
        if (plugin.managers.interactivity.lociMarks) {
            plugin.managers.interactivity.lociMarks.clearMarks();
        }

        // 4. Loci selects 클리어
        if (plugin.managers.interactivity.lociSelects) {
            plugin.managers.interactivity.lociSelects.deselectAll();
        }

        // 5. Selection entries 강제 클리어
        const sel = plugin.managers.structure.selection;
        if (sel.entries) {
            sel.entries.clear();
        }

        // 6. 캔버스 강제 다시 그리기
        plugin.canvas3d?.requestDraw(true);
    }
}
```

**핵심**:
- `selection.clear()` - 초록색 selection outline
- `lociHighlights.clearHighlights()` - 노란색 hover highlight
- `requestDraw(true)` - 캔버스 강제 리프레시

---

### 3. Selection에 Style 적용 (Atoms, Cartoon, Surface)

**기능**: 잔기 선택 후 Show 버튼 클릭 시 선택된 부분에만 스타일 적용

**구현**: `showRepresentation()` 에서 선택 여부 체크
```javascript
async function showRepresentation(type) {
    if (!plugin || !currentStructure) return;

    // 선택이 있으면 선택 부분에만 적용
    if (selectedResidues.size > 0) {
        await applyStyleToSelection(type);
        return;
    }

    // 선택이 없으면 전체 구조에 적용
    // ...
}
```

**핵심**: `tryCreateComponentFromExpression()`으로 선택 영역의 component 생성 후 representation 추가

---

## Mol* 주요 API 패턴

### Component 생성
```javascript
// 정적 component (polymer, ligand 등)
const comp = await plugin.builders.structure.tryCreateComponentStatic(structureCell, 'polymer');

// Expression 기반 component (커스텀 선택)
const comp = await plugin.builders.structure.tryCreateComponentFromExpression(
    structureCell,
    molScriptQuery,
    uniqueKey,
    { label: 'Label' }
);
```

### Representation 추가
```javascript
await plugin.builders.structure.representation.addRepresentation(component, {
    type: 'cartoon',  // 'ball-and-stick', 'molecular-surface', 'gaussian-surface'
    color: 'uniform', // 'chain-id', 'element-symbol' 등
    colorParams: { value: 0xFF0000 }  // uniform 색상일 때
});
```

### State Tree 업데이트
```javascript
const state = plugin.state.data;
const update = state.build().to(cellRef).update(newParams);
await plugin.runTask(state.updateTree(update));
```

### Cell 삭제
```javascript
const update = plugin.build();
update.delete(cell);
await update.commit();
```

---

## MolScript Query 빌드

```javascript
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';

// 특정 chain의 특정 residue들 선택
const query = MS.struct.generator.atomGroups({
    'chain-test': MS.core.rel.eq([MS.ammp('label_asym_id'), 'A']),
    'residue-test': MS.core.set.has([
        MS.core.type.set([1, 2, 3, 4, 5]),  // residue numbers
        MS.ammp('label_seq_id')
    ])
});

// 여러 그룹 병합
const merged = MS.struct.combinator.merge([query1, query2]);
```

---

## 디버깅 팁

1. **Console 로그**: 함수 진입점과 주요 변수 출력
2. **Component 확인**: `struct.components` 배열로 현재 component 목록 확인
3. **Representation 타입 확인**:
   - `repr.cell.obj?.repr?.label`
   - `repr.cell.transform?.params?.type?.name`
