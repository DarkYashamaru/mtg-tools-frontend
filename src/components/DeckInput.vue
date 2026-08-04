<script setup lang="ts">
// defineModel automatically manages the parent's v-model synchronization
const model = defineModel<string>({ default: '' })

interface Props {
  placeholder?: string
}

// Allow changing placeholder text depending on the page
withDefaults(defineProps<Props>(), {
  placeholder: 'Paste your MTG deck list here...'
})
</script>

<template>
  <textarea
    v-model="model"
    class="deck-input"
    :placeholder="placeholder"
  />
</template>

<style scoped>
.deck-input {
  width: 100%;
  height: 300px;
  padding: 16px;
  box-sizing: border-box;
  font-size: 0.9rem;
  font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
  background-color: var(--surface-hover);
  color: var(--text-light);
  border: 1px solid var(--surface-border-light);
  border-radius: 8px;
  resize: vertical;
  line-height: 1.5;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.deck-input:focus {
  outline: none;
  background-color: var(--surface-card);
  border-color: var(--accent-electric);
  box-shadow: 0 0 0 4px var(--accent-electric-dim);
}

.deck-input::placeholder {
  color: var(--text-dark);
}
</style>