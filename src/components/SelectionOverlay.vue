<template>
  <div class="overlay">
    <div
      v-if="box && box.active"
      class="selection"
      :style="{
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      }"
    />

    <svg v-if="link && link.active" class="link" :width="'100%'" :height="'100%'">
      <line
        :x1="link.start.x"
        :y1="link.start.y"
        :x2="link.end.x"
        :y2="link.end.y"
        stroke-dasharray="6 6"
        stroke="#38BDF8"
        stroke-width="2.5"
        marker-end="url(#arrow)"
      />
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38BDF8" />
        </marker>
      </defs>
    </svg>
  </div>
</template>

<script setup>
const props = defineProps({
  box: {
    type: Object,
    default: null,
  },
  link: {
    type: Object,
    default: null,
  },
});
</script>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 40;
}

.selection {
  position: absolute;
  border: 1px dashed rgba(96, 165, 250, 0.9);
  background: rgba(56, 189, 248, 0.1);
  border-radius: 8px;
}

.link {
  position: absolute;
  width: 100%;
  height: 100%;
}
</style>
