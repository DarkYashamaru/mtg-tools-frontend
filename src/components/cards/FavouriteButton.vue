<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useFavouritesStore } from '@/stores/favouritesStore'

const props = defineProps<{ oracleId: string; cardName: string; confirmRemoval?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore()
const favourites = useFavouritesStore()
const route = useRoute()
const router = useRouter()
const error = ref('')
watch(() => auth.isAuthenticated, async value => {
  if (!value) return
  await favourites.load()
  if (!auth.isAuthenticated && route.name !== 'login') {
    void router.replace({ name: 'login', query: { redirect: route.fullPath } })
  }
}, { immediate: true })

async function toggle() {
  error.value = ''
  if (props.confirmRemoval && favourites.ids.has(props.oracleId) &&
      !window.confirm(`Remove ${props.cardName} from your favorites?`)) return
  try {
    if (await favourites.toggle(props.oracleId)) emit('changed')
  } catch (err) {
    error.value = (err as Error).message
    if (!auth.isAuthenticated) void router.push({ name: 'login', query: { redirect: route.fullPath } })
  }
}
</script>

<template>
  <div v-if="auth.isAuthenticated" class="favourite-action">
    <button type="button" class="favourite-button" :class="{ saved: favourites.ids.has(oracleId) }"
      :aria-pressed="favourites.ids.has(oracleId)"
      :aria-label="`${favourites.ids.has(oracleId) ? 'Unfavorite' : 'Favorite'} ${cardName}`"
      :disabled="favourites.pending.has(oracleId)" @click.stop="toggle">
      <span aria-hidden="true">{{ favourites.ids.has(oracleId) ? '♥' : '♡' }}</span>
      {{ favourites.pending.has(oracleId) ? 'Saving…' : favourites.ids.has(oracleId) ? 'Favorited' : 'Favorite' }}
    </button>
    <p v-if="error || favourites.error" role="alert">{{ error || favourites.error }}</p>
  </div>
</template>

<style scoped>
.favourite-button { padding: 8px 12px; border: 1px solid var(--surface-border-light); border-radius: 9px; background: var(--surface-card); color: var(--text-main); cursor: pointer; font: inherit; }
.favourite-button.saved { color: #fb7185; }
.favourite-button span { font-size: 1.2em; }
.favourite-button:disabled { opacity: .6; cursor: wait; }
.favourite-button:focus-visible { outline: 2px solid var(--accent-electric); outline-offset: 3px; }
p { color: var(--error-text); font-size: .85rem; }
</style>
