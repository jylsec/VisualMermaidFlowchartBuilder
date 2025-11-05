import { computed, reactive, ref } from 'vue';

const NODE_TYPES = {
  microservice: {
    key: 'microservice',
    label: '微服务',
    color: '#FF6B6B',
  },
  database: {
    key: 'database',
    label: '数据库',
    color: '#48DBFB',
  },
  host: {
    key: 'host',
    label: '主机',
    color: '#20C997',
  },
  consumer: {
    key: 'consumer',
    label: '消费方',
    color: '#BE77FF',
  },
  dependent: {
    key: 'dependent',
    label: '依赖方',
    color: '#FF922B',
  },
  application: {
    key: 'application',
    label: '应用',
    color: '#339AF0',
  },
};

const defaultDomainColor = '#1E293B';

let uid = 0;
const createId = (prefix) => `${prefix}_${Date.now().toString(36)}_${uid++}`;

export function useFlowchart() {
  const history = ref([]);
  const future = ref([]);

  const state = reactive({
    nodes: [],
    domains: [],
    edges: [],
  });

  const snapshot = () => JSON.parse(JSON.stringify(state));

  const commit = () => {
    history.value.push(snapshot());
    if (history.value.length > 50) {
      history.value.shift();
    }
    future.value = [];
  };

  const restore = (data) => {
    state.nodes.splice(0, state.nodes.length, ...(data.nodes || []));
    state.domains.splice(0, state.domains.length, ...(data.domains || []));
    state.edges.splice(0, state.edges.length, ...(data.edges || []));
  };

  const undo = () => {
    if (!history.value.length) return;
    const current = snapshot();
    const previous = history.value.pop();
    future.value.unshift(current);
    restore(previous);
  };

  const redo = () => {
    if (!future.value.length) return;
    history.value.push(snapshot());
    restore(future.value.shift());
  };

  const addDomain = (name = `域 ${state.domains.length + 1}`) => {
    commit();
    const domain = {
      id: createId('domain'),
      name,
      color: defaultDomainColor,
      description: '',
    };
    state.domains.push(domain);
    return domain;
  };

  const addNode = (typeKey) => {
    const type = NODE_TYPES[typeKey];
    if (!type) return null;
    commit();
    const node = {
      id: createId('node'),
      type: type.key,
      name: type.label,
      description: '',
      domainId: null,
    };
    state.nodes.push(node);
    return node;
  };

  const updateNode = (id, payload) => {
    const node = state.nodes.find((item) => item.id === id);
    if (!node) return;
    commit();
    Object.assign(node, payload);
  };

  const moveNodesToDomain = (nodeIds, domainId) => {
    if (!Array.isArray(nodeIds) || !nodeIds.length) return;
    commit();
    nodeIds.forEach((id) => {
      const node = state.nodes.find((item) => item.id === id);
      if (node) {
        node.domainId = domainId;
      }
    });
  };

  const removeNodes = (nodeIds) => {
    if (!Array.isArray(nodeIds) || !nodeIds.length) return;
    commit();
    state.edges = state.edges.filter(
      (edge) => !nodeIds.includes(edge.source.id) && !nodeIds.includes(edge.target.id)
    );
    state.nodes = state.nodes.filter((node) => !nodeIds.includes(node.id));
  };

  const removeDomain = (domainId) => {
    const domain = state.domains.find((item) => item.id === domainId);
    if (!domain) return;
    commit();
    state.nodes.forEach((node) => {
      if (node.domainId === domainId) {
        node.domainId = null;
      }
    });
    state.domains = state.domains.filter((item) => item.id !== domainId);
  };

  const updateDomain = (id, payload) => {
    const domain = state.domains.find((item) => item.id === id);
    if (!domain) return;
    commit();
    Object.assign(domain, payload);
  };

  const ensureEdge = (source, target) => {
    const exists = state.edges.some(
      (edge) => edge.source.type === source.type && edge.source.id === source.id && edge.target.type === target.type && edge.target.id === target.id
    );
    if (exists) return null;
    commit();
    const edge = {
      id: createId('edge'),
      source,
      target,
    };
    state.edges.push(edge);
    return edge;
  };

  const removeEdge = (edgeId) => {
    commit();
    state.edges = state.edges.filter((edge) => edge.id !== edgeId);
  };

  const mermaidDefinition = computed(() => {
    const lines = ['graph TD'];
    lines.push('  classDef microservice fill:#FF6B6B,stroke:#1E293B,stroke-width:2,color:#0B1120;');
    lines.push('  classDef database fill:#48DBFB,stroke:#1E293B,stroke-width:2,color:#0B1120;');
    lines.push('  classDef host fill:#20C997,stroke:#134E4A,stroke-width:2,color:#052e16;');
    lines.push('  classDef consumer fill:#BE77FF,stroke:#1E293B,stroke-width:2,color:#111827;');
    lines.push('  classDef dependent fill:#FF922B,stroke:#7C2D12,stroke-width:2,color:#111827;');
    lines.push('  classDef application fill:#339AF0,stroke:#1E3A8A,stroke-width:2,color:#0B1120;');
    lines.push('  classDef domainAnchor fill:#1E293B,stroke:#CBD5F5,stroke-width:2,color:#E2E8F0;');

    const domainBuckets = new Map();
    state.nodes.forEach((node) => {
      if (!domainBuckets.has(node.domainId || 'root')) {
        domainBuckets.set(node.domainId || 'root', []);
      }
      domainBuckets.get(node.domainId || 'root').push(node);
    });

    state.domains.forEach((domain) => {
      lines.push(`  subgraph domain_${domain.id}["域 ${domain.name}"]`);
      lines.push('    direction TB');
      lines.push(`    domain_anchor_${domain.id}["${domain.name}"]:::domainAnchor`);
      const nodes = domainBuckets.get(domain.id) || [];
      nodes.forEach((node) => {
        const label = node.name.replace(/"/g, '\\"');
        lines.push(`    node_${node.id}["${label}"]:::${node.type}`);
      });
      lines.push('  end');
    });

    const rootNodes = domainBuckets.get('root') || [];
    rootNodes.forEach((node) => {
      const label = node.name.replace(/"/g, '\\"');
      lines.push(`  node_${node.id}["${label}"]:::${node.type}`);
    });

    state.edges.forEach((edge) => {
      const sourceId = edge.source.type === 'domain' ? `domain_anchor_${edge.source.id}` : `node_${edge.source.id}`;
      const targetId = edge.target.type === 'domain' ? `domain_anchor_${edge.target.id}` : `node_${edge.target.id}`;
      const label = `<span data-edge-id=\\"${edge.id}\\"></span>`;
      lines.push(`  ${sourceId} -->|${label}| ${targetId}`);
    });

    return lines.join('\n');
  });

  const serialize = () => ({
    nodes: snapshot().nodes,
    domains: snapshot().domains,
    edges: snapshot().edges,
  });

  return {
    state,
    history,
    future,
    nodeTypes: NODE_TYPES,
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
  };
}
