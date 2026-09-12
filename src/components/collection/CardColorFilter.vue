<script setup lang="ts">
import { computed } from 'vue'

export type CardColorMatchMode = 'exact' | 'including' | 'at-most'

type Color = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
const options: Array<{ value: Color; label: string }> = [
  { value: 'W', label: 'White' }, { value: 'U', label: 'Blue' },
  { value: 'B', label: 'Black' }, { value: 'R', label: 'Red' },
  { value: 'G', label: 'Green' }, { value: 'C', label: 'Colorless' },
]
const props = defineProps<{ modelValue: string[]; mode: CardColorMatchMode }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]]; 'update:mode': [value: CardColorMatchMode] }>()
const active = computed(() => props.modelValue.length > 0)

function toggle(color: Color) {
  const current = props.modelValue
  if (color === 'C') {
    emit('update:modelValue', current.includes('C') ? [] : ['C'])
    return
  }
  const colored = current.filter(value => value !== 'C')
  emit('update:modelValue', colored.includes(color) ? colored.filter(value => value !== color) : [...colored, color])
}
</script>

<template>
  <details class="facet-dropdown card-color-filter">
    <summary class="facet-trigger" :class="{ active }">
      <span>Card colors</span><span v-if="active" class="facet-count">{{ modelValue.length }}</span>
    </summary>
    <div class="facet-menu card-color-menu">
      <div class="color-toggle-row" aria-label="Card colors">
        <button v-for="option in options" :key="option.value" type="button" class="color-toggle" :class="[{ active: modelValue.includes(option.value) }, option.value.toLowerCase()]" :aria-pressed="modelValue.includes(option.value)" :title="option.label" @click="toggle(option.value)">{{ option.value }}</button>
      </div>
      <label class="match-mode"><input type="radio" name="card-color-mode" :checked="mode === 'exact'" @change="emit('update:mode', 'exact')"><span><strong>Exactly these colors</strong><small>Cards with exactly the selected colors.</small></span></label>
      <label class="match-mode"><input type="radio" name="card-color-mode" :checked="mode === 'including'" @change="emit('update:mode', 'including')"><span><strong>Including these colors</strong><small>Cards with all selected colors, with or without others.</small></span></label>
      <label class="match-mode"><input type="radio" name="card-color-mode" :checked="mode === 'at-most'" @change="emit('update:mode', 'at-most')"><span><strong>At most these colors</strong><small>Cards with some or all selected colors, plus colorless.</small></span></label>
    </div>
  </details>
</template>

<style scoped>
.facet-dropdown { position: relative; }
.facet-trigger { display: inline-flex; gap: 8px; align-items: center; min-height: 36px; padding: 7px 10px; border: 1px solid var(--surface-border-light); border-radius: 9px; background: transparent; color: var(--text-muted); font: 700 .79rem var(--font-sans); cursor: pointer; list-style: none; }
.facet-trigger::-webkit-details-marker { display: none; }
.facet-trigger.active, .facet-dropdown[open] .facet-trigger { border-color: var(--accent-electric-border); background: var(--accent-electric-dim); color: var(--accent-electric); }
.facet-count { display: grid; min-width: 19px; height: 19px; place-items: center; padding: 0 4px; border-radius: 999px; background: rgba(148, 163, 184, .12); font-size: .65rem; }
.facet-menu { position: absolute; z-index: 60; top: calc(100% + 6px); left: 0; width: min(310px, calc(100vw - 32px)); padding: 10px; border: 1px solid var(--surface-border-light); border-radius: 11px; background: rgba(15, 23, 42, .99); box-shadow: var(--shadow-lg); }
.color-toggle-row { display: flex; gap: 6px; margin-bottom: 10px; }
.color-toggle { width: 32px; height: 32px; border: 1px solid var(--surface-border-light); border-radius: 50%; background: var(--surface-hover); color: var(--text-main); font-weight: 800; cursor: pointer; }
.color-toggle.active { outline: 2px solid var(--accent-electric); outline-offset: 2px; background: var(--accent-electric-dim); color: var(--accent-electric); }
.match-mode { display: flex; gap: 8px; padding: 8px 4px; color: var(--text-main); cursor: pointer; font-size: .8rem; }
.match-mode input { margin-top: 3px; accent-color: var(--accent-electric); }
.match-mode span { display: grid; gap: 2px; }
.match-mode small { color: var(--text-muted); line-height: 1.25; }
</style>
