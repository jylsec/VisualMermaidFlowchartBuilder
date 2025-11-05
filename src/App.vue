<template>
  <div class="app">
    <TopToolbar
      :node-types="nodeTypes"
      @add-node="handleAddNode"
      @undo="undo"
      @redo="redo"
      @save="handleSave"
      @export="handleExport"
    />

    <MermaidCanvas
      ref="canvas"
      :definition="mermaidDefinition"
      @rendered="onRendered"
      @pointer-down="onCanvasPointerDown"
    >
      <SelectionOverlay :box="selectionBox" :link="linkOverlay" />

      <FloatingToolbar
        :visible="nodeToolbar.visible"
        :x="nodeToolbar.x"
        :y="nodeToolbar.y"
        :actions="nodeActions"
        @action="onNodeAction"
      />

      <FloatingToolbar
        :visible="domainToolbar.visible"
        :x="domainToolbar.x"
        :y="domainToolbar.y"
        :actions="domainActions"
        @action="onDomainAction"
      />

      <FloatingToolbar
        :visible="edgeToolbar.visible"
        :x="edgeToolbar.x"
        :y="edgeToolbar.y"
        :actions="edgeActions"
        @action="onEdgeAction"
      />

      <FloatingToolbar
        :visible="multiToolbar.visible"
        :x="multiToolbar.x"
        :y="multiToolbar.y"
        :actions="multiActions"
        @action="onMultiAction"
      />
    </MermaidCanvas>

    <a-modal v-model:open="editNodeModal.open" title="编辑节点" :destroy-on-close="true" @ok="handleEditNodeOk">
      <a-form layout="vertical">
        <a-form-item label="节点名称">
          <a-input v-model:value="editNodeModal.form.name" placeholder="请输入节点名称" />
        </a-form-item>
        <a-form-item label="节点描述">
          <a-textarea v-model:value="editNodeModal.form.description" placeholder="支持Markdown" :rows="4" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="moveNodesModal.open" title="移动至域" @ok="confirmMoveNodes">
      <a-form layout="vertical">
        <a-form-item label="选择目标域">
          <a-select v-model:value="moveNodesModal.domainId" placeholder="请选择域">
            <a-select-option :value="null">根画布</a-select-option>
            <a-select-option v-for="domain in state.domains" :key="domain.id" :value="domain.id">
              {{ domain.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="或新建域">
          <a-input v-model:value="moveNodesModal.newDomainName" placeholder="新的域名称" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="editDomainModal.open" title="编辑域" :destroy-on-close="true" @ok="confirmEditDomain">
      <a-form layout="vertical">
        <a-form-item label="域名称">
          <a-input v-model:value="editDomainModal.form.name" placeholder="请输入域名称" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { DeleteOutlined, ExportOutlined, LogoutOutlined, NodeIndexOutlined } from '@ant-design/icons-vue';
import TopToolbar from './components/TopToolbar.vue';
import MermaidCanvas from './components/MermaidCanvas.vue';
import FloatingToolbar from './components/FloatingToolbar.vue';
import SelectionOverlay from './components/SelectionOverlay.vue';
import { useFlowchart } from './composables/useFlowchart';

const canvas = ref();
const {
  state,
  nodeTypes,
  mermaidDefinition,
  addNode,
  updateNode,
  moveNodesToDomain,
  removeNodes,
  addDomain,
  removeDomain,
  updateDomain,
  ensureEdge,
  removeEdge,
  undo,
  redo,
  serialize,
} = useFlowchart();

const nodeToolbar = reactive({ visible: false, x: 0, y: 0, id: null });
const domainToolbar = reactive({ visible: false, x: 0, y: 0, id: null });
const edgeToolbar = reactive({ visible: false, x: 0, y: 0, id: null });
const multiToolbar = reactive({ visible: false, x: 0, y: 0, ids: [] });

const selectionBox = reactive({
  active: false,
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  viewportLeft: 0,
  viewportTop: 0,
  viewportWidth: 0,
  viewportHeight: 0,
});
const linkOverlay = reactive({ active: false, start: { x: 0, y: 0 }, end: { x: 0, y: 0 } });

const editNodeModal = reactive({ open: false, id: null, form: { name: '', description: '' } });
const moveNodesModal = reactive({ open: false, ids: [], domainId: null, newDomainName: '' });
const editDomainModal = reactive({ open: false, id: null, form: { name: '' } });

const pointerState = reactive({ isSelecting: false, startX: 0, startY: 0 });

const multiSelection = ref([]);
const nodeElements = reactive({});
const domainElements = reactive({});
const edgeElements = reactive({});

const getSvgRoot = () => canvas.value?.graphRef?.value?.querySelector('svg');

const nodeActions = computed(() => [
  { key: 'edit', label: '编辑', icon: NodeIndexOutlined },
  { key: 'move', label: '移至域', icon: ExportOutlined },
  { key: 'remove', label: '删除', icon: DeleteOutlined },
  { key: 'detach', label: '移出域', icon: LogoutOutlined },
]);

const domainActions = computed(() => [
  { key: 'rename', label: '重命名', icon: NodeIndexOutlined },
  { key: 'release', label: '移出所有', icon: LogoutOutlined },
  { key: 'remove', label: '删除域', icon: DeleteOutlined },
]);

const multiActions = computed(() => [
  { key: 'move', label: '批量移至域', icon: ExportOutlined },
  { key: 'remove', label: '批量删除', icon: DeleteOutlined },
]);

const edgeActions = computed(() => [
  { key: 'remove', label: '删除连线', icon: DeleteOutlined },
]);

const resetToolbars = () => {
  nodeToolbar.visible = false;
  domainToolbar.visible = false;
  edgeToolbar.visible = false;
  multiToolbar.visible = false;
};

const handleAddNode = (type) => {
  const node = addNode(type);
  if (!node) return;
  message.success(`已创建节点：${node.name}`);
};

const handleSave = async () => {
  const payload = serialize();
  console.info('[Mermaid Flow Architect] 保存payload示例', payload);
  try {
    await fetch('/api/graphs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    message.success('流程图已保存至服务器');
  } catch (err) {
    console.error(err);
    message.warning('保存失败，已在控制台输出请求示例');
  }
};

const handleExport = () => {
  const svgElement = canvas.value?.graphRef?.value?.querySelector('svg');
  if (!svgElement) {
    message.error('未找到图形');
    return;
  }
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mermaid-flow-${Date.now()}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  message.success('已导出SVG文件');
};

const nodeActionsMap = {
  edit: () => openEditNode(nodeToolbar.id),
  move: () => openMoveNodes([nodeToolbar.id]),
  remove: () => removeNodes([nodeToolbar.id]),
  detach: () => moveNodesToDomain([nodeToolbar.id], null),
};

const onNodeAction = (key) => {
  nodeActionsMap[key]?.();
  resetToolbars();
};

const domainActionsMap = {
  rename: () => openEditDomain(domainToolbar.id),
  release: () => releaseDomain(domainToolbar.id),
  remove: () => deleteDomain(domainToolbar.id),
};

const onDomainAction = (key) => {
  domainActionsMap[key]?.();
  resetToolbars();
};

const edgeActionsMap = {
  remove: () => removeEdge(edgeToolbar.id),
};

const onEdgeAction = (key) => {
  edgeActionsMap[key]?.();
  resetToolbars();
};

const multiActionsMap = {
  move: () => openMoveNodes(multiToolbar.ids),
  remove: () => removeNodes(multiToolbar.ids),
};

const onMultiAction = (key) => {
  multiActionsMap[key]?.();
  multiSelection.value = [];
  resetToolbars();
};

const openEditNode = (id) => {
  const node = state.nodes.find((item) => item.id === id);
  if (!node) return;
  editNodeModal.id = id;
  editNodeModal.form.name = node.name;
  editNodeModal.form.description = node.description;
  editNodeModal.open = true;
};

const handleEditNodeOk = () => {
  if (!editNodeModal.id) return;
  updateNode(editNodeModal.id, {
    name: editNodeModal.form.name,
    description: editNodeModal.form.description,
  });
  editNodeModal.open = false;
  nextTick(updateSelectionPositions);
};

const openMoveNodes = (ids) => {
  moveNodesModal.ids = [...ids];
  moveNodesModal.open = true;
  moveNodesModal.domainId = null;
  moveNodesModal.newDomainName = '';
};

const confirmMoveNodes = () => {
  let targetDomain = moveNodesModal.domainId;
  if (moveNodesModal.newDomainName) {
    const domain = addDomain(moveNodesModal.newDomainName);
    targetDomain = domain.id;
  }
  moveNodesToDomain(moveNodesModal.ids, targetDomain ?? null);
  moveNodesModal.open = false;
  nextTick(updateSelectionPositions);
};

const openEditDomain = (id) => {
  const domain = state.domains.find((item) => item.id === id);
  if (!domain) return;
  editDomainModal.id = id;
  editDomainModal.form.name = domain.name;
  editDomainModal.open = true;
};

const confirmEditDomain = () => {
  if (!editDomainModal.id) return;
  updateDomain(editDomainModal.id, { name: editDomainModal.form.name });
  editDomainModal.open = false;
  nextTick(updateSelectionPositions);
};

const releaseDomain = (id) => {
  const domain = state.domains.find((item) => item.id === id);
  if (!domain) return;
  Modal.confirm({
    title: `移出域：${domain.name}`,
    content: '域内节点将移至根画布，连线关系保留。',
    onOk: () => {
      moveNodesToDomain(
        state.nodes.filter((node) => node.domainId === id).map((node) => node.id),
        null
      );
    },
  });
};

const deleteDomain = (id) => {
  const domain = state.domains.find((item) => item.id === id);
  if (!domain) return;
  Modal.confirm({
    title: `删除域：${domain.name}`,
    content: '域内节点将移出域，连线关系保留。',
    onOk: () => removeDomain(id),
  });
};

const attachNodeHandlers = () => {
  const svg = getSvgRoot();
  nodeElementsClear();
  if (!svg) return;

  state.nodes.forEach((node) => {
    const labelEl = svg.querySelector(`[data-node-id="${node.id}"]`);
    if (!labelEl) return;
    nodeElements[node.id] = labelEl.getBoundingClientRect();
    const group = labelEl.closest('g.node');
    if (group) {
      group.dataset.nodeId = node.id;
      group.style.cursor = 'pointer';
    }
    if (!labelEl.dataset.boundNode) {
      labelEl.dataset.boundNode = 'true';
      labelEl.addEventListener('click', (event) => onNodeClick(event, node));
      labelEl.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        openEditNode(node.id);
      });
      labelEl.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        onLinkStart(event, { type: 'node', id: node.id });
      });
    }
  });

  state.domains.forEach((domain) => {
    const cluster = svg.querySelector(`#cluster_domain_${domain.id}`);
    if (cluster) {
      const rectEl = cluster.querySelector('rect');
      const targetEl = rectEl || cluster;
      domainElements[domain.id] = targetEl.getBoundingClientRect();
      targetEl.style.cursor = 'pointer';
      if (!targetEl.dataset.boundDomain) {
        targetEl.dataset.boundDomain = 'true';
        targetEl.addEventListener('click', (event) => onDomainClick(event, domain));
        targetEl.addEventListener('pointerdown', (event) => {
          event.stopPropagation();
          onLinkStart(event, { type: 'domain', id: domain.id });
        });
      }
    }
    const labelEl = svg.querySelector(`[data-domain-id="${domain.id}"]`);
    if (labelEl && !labelEl.dataset.boundDomainLabel) {
      labelEl.dataset.boundDomainLabel = 'true';
      labelEl.addEventListener('click', (event) => onDomainClick(event, domain));
      labelEl.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        openEditDomain(domain.id);
      });
      labelEl.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        onLinkStart(event, { type: 'domain', id: domain.id });
      });
    }
  });

  const edgeGroups = svg.querySelectorAll('g.edgePaths > g.edgePath');
  edgeGroups.forEach((group, index) => {
    const edge = state.edges[index];
    if (!edge) return;
    group.dataset.edgeId = edge.id;
    edgeElements[edge.id] = group.getBoundingClientRect();
    const path = group.querySelector('path');
    const target = path || group;
    target.style.cursor = 'pointer';
    if (!target.dataset.boundEdge) {
      target.dataset.boundEdge = 'true';
      target.addEventListener('click', (event) => onEdgeClick(event, edge));
    }
  });

  applySelectionStyles();
};

const nodeElementsClear = () => {
  Object.keys(nodeElements).forEach((key) => delete nodeElements[key]);
  Object.keys(domainElements).forEach((key) => delete domainElements[key]);
  Object.keys(edgeElements).forEach((key) => delete edgeElements[key]);
};

const applySelectionStyles = () => {
  const svg = getSvgRoot();
  if (!svg) return;
  svg.querySelectorAll('g.node.selected').forEach((group) => group.classList.remove('selected'));
  multiSelection.value.forEach((id) => {
    const group = svg.querySelector(`#node_${id}`);
    if (group) {
      group.classList.add('selected');
    }
  });
};

const onRendered = async () => {
  resetToolbars();
  await nextTick();
  attachNodeHandlers();
  updateSelectionPositions();
};

const shouldSkipClick = () => {
  if (suppressClick) {
    suppressClick = false;
    if (suppressClickTimeout) {
      window.clearTimeout(suppressClickTimeout);
      suppressClickTimeout = null;
    }
    return true;
  }
  return false;
};

const onNodeClick = (event, node) => {
  event.stopPropagation();
  if (shouldSkipClick()) {
    return;
  }
  resetToolbars();
  const rect = event.currentTarget.getBoundingClientRect();
  showNodeToolbar(node.id, rect);
};

const onDomainClick = (event, domain) => {
  event.stopPropagation();
  if (shouldSkipClick()) {
    return;
  }
  resetToolbars();
  const rect = event.currentTarget.getBoundingClientRect();
  showDomainToolbar(domain.id, rect);
};

const onEdgeClick = (event, edge) => {
  event.stopPropagation();
  resetToolbars();
  const rect = event.currentTarget.getBoundingClientRect();
  showEdgeToolbar(edge.id, rect);
};

const showNodeToolbar = (id, rect) => {
  nodeToolbar.id = id;
  nodeToolbar.x = rect.left + rect.width / 2 + window.scrollX;
  nodeToolbar.y = rect.top + window.scrollY - 12;
  nodeToolbar.visible = true;
};

const showDomainToolbar = (id, rect) => {
  domainToolbar.id = id;
  domainToolbar.x = rect.left + rect.width / 2 + window.scrollX;
  domainToolbar.y = rect.top + window.scrollY - 12;
  domainToolbar.visible = true;
};

const showEdgeToolbar = (id, rect) => {
  edgeToolbar.id = id;
  edgeToolbar.x = rect.left + rect.width / 2 + window.scrollX;
  edgeToolbar.y = rect.top + window.scrollY - 12;
  edgeToolbar.visible = true;
};

const showMultiToolbar = (ids, rect) => {
  multiToolbar.ids = ids;
  multiToolbar.x = rect.left + rect.width / 2 + window.scrollX;
  multiToolbar.y = rect.top + window.scrollY - 12;
  multiToolbar.visible = true;
};

const onCanvasPointerDown = (event) => {
  if (
    event.target.closest('[data-node-id]') ||
    event.target.closest('[data-domain-id]') ||
    event.target.closest('g.node, g.cluster, g.edgePath')
  ) {
    return;
  }
  pointerState.isSelecting = true;
  pointerState.startX = event.clientX;
  pointerState.startY = event.clientY;
  selectionBox.active = true;
  const rect = getCanvasRect();
  selectionBox.left = event.clientX - rect.left;
  selectionBox.top = event.clientY - rect.top;
  selectionBox.width = 0;
  selectionBox.height = 0;
  selectionBox.viewportLeft = event.clientX;
  selectionBox.viewportTop = event.clientY;
  selectionBox.viewportWidth = 0;
  selectionBox.viewportHeight = 0;
  resetToolbars();
  multiSelection.value = [];
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
};

const onPointerMove = (event) => {
  if (!pointerState.isSelecting) return;
  const currentX = event.clientX;
  const currentY = event.clientY;
  selectionBox.viewportLeft = Math.min(pointerState.startX, currentX);
  selectionBox.viewportTop = Math.min(pointerState.startY, currentY);
  selectionBox.viewportWidth = Math.abs(currentX - pointerState.startX);
  selectionBox.viewportHeight = Math.abs(currentY - pointerState.startY);
  const rect = getCanvasRect();
  selectionBox.left = selectionBox.viewportLeft - rect.left;
  selectionBox.top = selectionBox.viewportTop - rect.top;
  selectionBox.width = selectionBox.viewportWidth;
  selectionBox.height = selectionBox.viewportHeight;
  updateSelection();
};

const onPointerUp = () => {
  if (pointerState.isSelecting) {
    pointerState.isSelecting = false;
    selectionBox.active = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    if (multiSelection.value.length) {
      const rect = computeBoundingRect(multiSelection.value.map((id) => nodeElements[id]));
      if (rect) {
        showMultiToolbar([...multiSelection.value], rect);
      }
    }
  }
};

const updateSelection = () => {
  const selected = [];
  Object.entries(nodeElements).forEach(([id, rect]) => {
    if (rectInsideSelection(rect, selectionBox)) {
      selected.push(id);
    }
  });
  multiSelection.value = selected;
  applySelectionStyles();
};

const rectInsideSelection = (rect, selection) => {
  if (!selection.active) return false;
  const selectionRect = {
    left: selection.viewportLeft,
    top: selection.viewportTop,
    right: selection.viewportLeft + selection.viewportWidth,
    bottom: selection.viewportTop + selection.viewportHeight,
  };
  const rectBounds = {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  };
  return (
    rectBounds.left >= selectionRect.left &&
    rectBounds.right <= selectionRect.right &&
    rectBounds.top >= selectionRect.top &&
    rectBounds.bottom <= selectionRect.bottom
  );
};

const computeBoundingRect = (rects) => {
  if (!rects.length) return null;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  rects.forEach((rect) => {
    if (!rect) return;
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.left + rect.width);
    top = Math.min(top, rect.top);
    bottom = Math.max(bottom, rect.top + rect.height);
  });
  if (!Number.isFinite(left)) return null;
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
};

const updateSelectionPositions = () => {
  const svg = getSvgRoot();
  if (!svg) return;
  Object.keys(nodeElements).forEach((key) => {
    const element = svg.querySelector(`[data-node-id="${key}"]`);
    if (element) {
      nodeElements[key] = element.getBoundingClientRect();
    }
  });
  Object.keys(domainElements).forEach((key) => {
    const clusterRect = svg.querySelector(`#cluster_domain_${key} rect`);
    const clusterGroup = svg.querySelector(`#cluster_domain_${key}`);
    const targetEl = clusterRect || clusterGroup;
    if (targetEl) {
      domainElements[key] = targetEl.getBoundingClientRect();
    }
  });
  Object.keys(edgeElements).forEach((key) => {
    const group = svg.querySelector(`g.edgePaths > g.edgePath[data-edge-id=\"${key}\"]`);
    if (group) {
      edgeElements[key] = group.getBoundingClientRect();
    }
  });
  applySelectionStyles();
};

let linkTimer = null;
let cancelLinkListener = null;
let suppressClick = false;
let suppressClickTimeout = null;
const linkSource = ref(null);

const onLinkStart = (event, source) => {
  if (event.button !== 0) return;
  linkSource.value = source;
  const rect = getCanvasRect();
  const startPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  linkTimer = window.setTimeout(() => {
    suppressClick = true;
    if (suppressClickTimeout) {
      window.clearTimeout(suppressClickTimeout);
      suppressClickTimeout = null;
    }
    if (cancelLinkListener) {
      window.removeEventListener('pointerup', cancelLinkListener);
      cancelLinkListener = null;
    }
    linkOverlay.active = true;
    linkOverlay.start = startPoint;
    linkOverlay.end = startPoint;
    linkTimer = null;
    window.addEventListener('pointermove', onLinkMove);
    window.addEventListener('pointerup', onLinkEnd);
  }, 500);
  cancelLinkListener = () => {
    cancelLinkTimer();
    cancelLinkListener = null;
  };
  window.addEventListener('pointerup', cancelLinkListener, { once: true });
};

const cancelLinkTimer = () => {
  if (linkTimer) {
    window.clearTimeout(linkTimer);
    linkTimer = null;
  }
};

const onLinkMove = (event) => {
  const rect = getCanvasRect();
  linkOverlay.end = { x: event.clientX - rect.left, y: event.clientY - rect.top };
};

const onLinkEnd = (event) => {
  window.removeEventListener('pointermove', onLinkMove);
  window.removeEventListener('pointerup', onLinkEnd);
  linkOverlay.active = false;
  const target = findTarget(event.clientX, event.clientY);
  if (target && linkSource.value && (target.type !== linkSource.value.type || target.id !== linkSource.value.id)) {
    ensureEdge(linkSource.value, target);
  }
  linkSource.value = null;
  suppressClickTimeout = window.setTimeout(() => {
    suppressClick = false;
    suppressClickTimeout = null;
  }, 200);
};

const getCanvasRect = () => {
  const rect = canvas.value?.canvasRef?.value?.getBoundingClientRect();
  if (rect) return rect;
  return { left: 0, top: 0 };
};

const findTarget = (x, y) => {
  const targetNode = Object.entries(nodeElements).find(([, rect]) => pointInRect(x, y, rect));
  if (targetNode) {
    return { type: 'node', id: targetNode[0] };
  }
  const targetDomain = Object.entries(domainElements).find(([, rect]) => pointInRect(x, y, rect));
  if (targetDomain) {
    return { type: 'domain', id: targetDomain[0] };
  }
  return null;
};

const pointInRect = (x, y, rect) => {
  if (!rect) return false;
  return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
};

watch(
  multiSelection,
  () => nextTick(applySelectionStyles),
  { deep: true }
);

watch(
  () => state.nodes.length,
  () => nextTick(updateSelectionPositions)
);

watch(
  () => state.domains.length,
  () => nextTick(updateSelectionPositions)
);

watch(
  () => state.edges.length,
  () => nextTick(updateSelectionPositions)
);

window.addEventListener('scroll', updateSelectionPositions);
window.addEventListener('resize', updateSelectionPositions);

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateSelectionPositions);
  window.removeEventListener('resize', updateSelectionPositions);
});
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #e2e8f0;
}

:global(svg span[data-edge-id]) {
  display: none;
}

:global(.node-label),
:global(.domain-label) {
  pointer-events: all;
  cursor: pointer;
}

:global(.domain-label) {
  font-weight: 600;
}

:global(g.node.selected rect) {
  stroke: #38bdf8 !important;
  stroke-width: 4px !important;
}

:global(g.edgePath path) {
  pointer-events: stroke;
  stroke-width: 2.5px;
}

:global(g.edgePath path:hover) {
  stroke: #38bdf8;
}

:global(g.cluster rect) {
  cursor: pointer;
  transition: stroke 0.2s ease, fill-opacity 0.2s ease;
}

:global(g.cluster rect:hover) {
  stroke: #38bdf8;
  fill-opacity: 0.18;
}
</style>
