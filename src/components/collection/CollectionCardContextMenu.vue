<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { CollectionCardContextMenuPayload, CollectionItem } from './types'

const props = defineProps<{
  state: CollectionCardContextMenuPayload | null
  isReadOnlyCollection: boolean
  isCommanderCollection: boolean
  isMutatingCommander: boolean
  mutatingItemIds: Array<string | number>
}>()
const emit = defineEmits<{
  close: []
  'open-card': [item: CollectionItem]
  'change-print': [item: CollectionItem]
  commander: [item: CollectionItem, action: 'set' | 'remove']
  'move-zone': [item: CollectionItem, zone: 'mainboard' | 'maybeboard']
}>()
const positionedState = ref<CollectionCardContextMenuPayload | null>(null)
const contextMenuElement = ref<HTMLElement | null>(null)
let generation = 0

watch(() => props.state, async (state) => {
  const request = ++generation
  positionedState.value = state ? { ...state } : null
  if (!state) return
  await nextTick()
  if (request !== generation || !contextMenuElement.value) return
  const rect = contextMenuElement.value.getBoundingClientRect()
  const margin = 8
  positionedState.value = {
    ...state,
    x: Math.min(Math.max(state.x, margin), Math.max(margin, window.innerWidth - rect.width - margin)),
    y: Math.min(Math.max(state.y, margin), Math.max(margin, window.innerHeight - rect.height - margin)),
  }
}, { immediate: true })

function close() { emit('close') }
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { close(); return }
  const target = event.target
  if (target instanceof HTMLElement &&
      (target.matches('input, textarea, select') || target.isContentEditable)) return
  const item = props.state?.item
  if (!item || props.isReadOnlyCollection || !props.isCommanderCollection ||
      event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
  const key = event.key.toLowerCase()
  if (key === 'm' && item.zone === 'mainboard') {
    event.preventDefault()
    emit('move-zone', item, 'maybeboard')
  } else if (key === 'a' && item.zone === 'maybeboard') {
    event.preventDefault()
    emit('move-zone', item, 'mainboard')
  }
}
onMounted(() => {
  window.addEventListener('click', close)
  window.addEventListener('scroll', close, true)
  window.addEventListener('resize', close)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  generation += 1
  window.removeEventListener('click', close)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="positionedState"
      ref="contextMenuElement"
      class="context-menu"
      :style="{
        left: `${positionedState.x}px`,
        top: `${positionedState.y}px`,
      }"
      @click.stop
    >
      <button
        class="context-menu-action"
        type="button"
        :disabled="!positionedState.item.oracle_id"
        @click="emit('open-card', positionedState.item)"
      >
        <span>
          Show card details
        </span>
      </button>

      <button
        v-if="
          !isReadOnlyCollection &&
          positionedState.item.oracle_id
        "
        class="context-menu-action"
        type="button"
        @click="emit('change-print', positionedState.item)"
      >
        <span>
          Change printing
        </span>
      </button>

      <button
        v-if="
          isCommanderCollection &&
          !isReadOnlyCollection
        "
        class="context-menu-action"
        type="button"
        :disabled="isMutatingCommander"
        @click="
          emit('commander',
            positionedState.item,
            positionedState.item.zone === 'commander'
              ? 'remove'
              : 'set',
          )
        "
      >
        <span>
          {{
            positionedState.item.zone === 'commander'
              ? 'Remove as commander'
              : 'Set as commander'
          }}
        </span>
      </button>

      <button
        v-if="
          isCommanderCollection &&
          !isReadOnlyCollection &&
          positionedState.item.zone === 'mainboard'
        "
        class="context-menu-action"
        type="button"
        :disabled="
          mutatingItemIds.includes(
            positionedState.item.id,
          )
        "
        @click="
          emit('move-zone',
            positionedState.item,
            'maybeboard',
          )
        "
      >
        <span>
          Move to Maybeboard
        </span>

        <kbd>M</kbd>
      </button>

      <button
        v-else-if="
          isCommanderCollection &&
          !isReadOnlyCollection &&
          positionedState.item.zone === 'maybeboard'
        "
        class="context-menu-action"
        type="button"
        :disabled="
          mutatingItemIds.includes(
            positionedState.item.id,
          )
        "
        @click="
          emit('move-zone',
            positionedState.item,
            'mainboard',
          )
        "
      >
        <span>
          Move to Mainboard
        </span>

        <kbd>A</kbd>
      </button>
    </div>
  </Teleport>

</template>

<style scoped>
.context-menu {
  position: fixed;

  z-index: 2000;

  width: 230px;

  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);

  overflow-y: auto;
  overflow-x: hidden;

  padding: 6px;

  border: 1px solid var(--surface-border-light);
  border-radius: 12px;

  background: rgba(15, 23, 42, 0.97);

  box-shadow: var(--shadow-lg);

  backdrop-filter: blur(16px);

  box-sizing: border-box;
}

.context-menu-action {
  width: 100%;
  min-width: 0;
  min-height: 38px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 16px;

  padding: 8px 10px;

  border: 0;
  border-radius: 8px;

  background: transparent;

  color: var(--text-main);

  font-family: var(--font-sans);

  font-size: 0.9rem;
  font-weight: 650;

  text-align: left;

  cursor: pointer;

  box-sizing: border-box;

  transition:
    background-color 100ms ease,
    color 100ms ease;
}

.context-menu-action:hover:not(:disabled) {
  background: var(--accent-electric-dim);

  color: var(--accent-electric);
}

.context-menu-action:focus-visible {
  outline: 2px solid var(--accent-electric);
  outline-offset: -2px;
}

.context-menu-action:disabled {
  cursor: not-allowed;

  opacity: 0.5;
}

.context-menu-action kbd {
  flex: 0 0 auto;

  min-width: 22px;

  padding: 2px 5px;

  border: 1px solid var(--surface-border-light);
  border-radius: 5px;

  background: var(--surface-hover);

  color: var(--text-muted);

  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  text-align: center;

  box-sizing: border-box;
}

@media (prefers-reduced-motion: reduce) {
.context-menu-action {
    transition: none;
  }

}
</style>
