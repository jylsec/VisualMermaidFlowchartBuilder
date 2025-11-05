<template>
  <div class="toolbar">
    <a-space :size="12">
      <a-dropdown :trigger="['click']">
        <template #overlay>
          <a-menu @click="onSelectType">
            <a-menu-item v-for="type in typeList" :key="type.key">
              <div class="type-item">
                <span class="color" :style="{ background: type.color }" />
                <span>{{ type.label }}</span>
              </div>
            </a-menu-item>
          </a-menu>
        </template>
        <a-button type="primary" shape="round" size="large">
          <template #icon>
            <plus-outlined />
          </template>
          新增节点
        </a-button>
      </a-dropdown>

      <a-tooltip title="撤销">
        <a-button shape="round" size="large" @click="$emit('undo')">
          <template #icon>
            <undo-outlined />
          </template>
        </a-button>
      </a-tooltip>

      <a-tooltip title="重做">
        <a-button shape="round" size="large" @click="$emit('redo')">
          <template #icon>
            <redo-outlined />
          </template>
        </a-button>
      </a-tooltip>

      <a-divider type="vertical" />

      <a-button type="default" shape="round" size="large" @click="$emit('save')">
        <template #icon>
          <save-outlined />
        </template>
        保存
      </a-button>

      <a-button type="default" shape="round" size="large" @click="$emit('export')">
        <template #icon>
          <camera-outlined />
        </template>
        导出
      </a-button>
    </a-space>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { CameraOutlined, PlusOutlined, RedoOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons-vue';

const props = defineProps({
  nodeTypes: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['add-node', 'undo', 'redo', 'save', 'export']);

const typeList = computed(() => Object.values(props.nodeTypes));

const onSelectType = ({ key }) => {
  emit('add-node', key);
};
</script>

<style scoped>
.toolbar {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  padding: 12px 20px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
  z-index: 20;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
}

.color {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.6);
}
</style>
