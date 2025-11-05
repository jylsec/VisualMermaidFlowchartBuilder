<template>
  <transition name="fade">
    <div v-if="visible" class="floating" :style="style">
      <a-space>
        <a-button
          v-for="action in actions"
          :key="action.key"
          size="small"
          shape="round"
          @click="() => emit('action', action.key)"
        >
          <template v-if="action.icon" #icon>
            <component :is="action.icon" />
          </template>
          {{ action.label }}
        </a-button>
      </a-space>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: Boolean,
  x: {
    type: Number,
    default: 0,
  },
  y: {
    type: Number,
    default: 0,
  },
  actions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['action']);

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}));
</script>

<style scoped>
.floating {
  position: absolute;
  transform: translate(-50%, -100%);
  background: rgba(15, 23, 42, 0.88);
  border-radius: 14px;
  padding: 10px 14px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.45);
  z-index: 50;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
