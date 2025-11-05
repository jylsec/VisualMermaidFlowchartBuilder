<template>
  <div ref="canvasRef" class="canvas" @pointerdown="onPointerDown">
    <div ref="graphRef" class="graph" v-html="svg" />
    <slot />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import mermaid from 'mermaid';

const props = defineProps({
  definition: {
    type: String,
    required: true,
  },
  autoRender: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['rendered', 'pointer-down']);

const canvasRef = ref();
const graphRef = ref();
const svg = ref('');

let renderIndex = 0;

const renderGraph = async () => {
  if (!props.definition) return;
  renderIndex += 1;
  const id = `mermaid-${renderIndex}`;
  const { svg: content } = await mermaid.render(id, props.definition);
  svg.value = content;
};

onMounted(async () => {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    flowchart: {
      curve: 'basis',
      htmlLabels: true,
    },
    themeVariables: {
      primaryColor: '#1E293B',
      primaryBorderColor: '#0F172A',
      lineColor: '#94A3B8',
      fontSize: '16px',
      fontFamily: 'Inter, sans-serif',
      clusterBkg: '#0f172a',
      clusterBorder: '#334155',
    },
  });
  await renderGraph();
  emit('rendered', {
    canvas: canvasRef.value,
    graph: graphRef.value,
  });
});

watch(
  () => props.definition,
  async () => {
    await renderGraph();
    emit('rendered', {
      canvas: canvasRef.value,
      graph: graphRef.value,
    });
  }
);

const onPointerDown = (event) => {
  emit('pointer-down', event);
};

const exposeState = computed(() => ({ canvas: canvasRef.value, graph: graphRef.value }));

defineExpose({
  canvasRef,
  graphRef,
  exposeState,
});
</script>

<style scoped>
.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 120px 48px 48px;
}

.graph :deep(svg) {
  width: 100%;
}
</style>
