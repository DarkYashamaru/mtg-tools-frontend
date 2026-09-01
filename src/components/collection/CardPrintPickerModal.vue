<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { CollectionItem } from "./types"
type Print = { card_id: string; oracle_id: string; name: string; set_code: string; collector_number: string; lang: string; image_uri: string | null }
const props = defineProps<{ open: boolean; item: CollectionItem | null; replacing?: boolean }>()
const emit = defineEmits<{ close: []; select: [cardId: string] }>()
const prints = ref<Print[]>([]); const language = ref("en"); const loading = ref(false)
const languages = computed(() => [...new Set(prints.value.map(p => p.lang))].sort((a,b) => a === "en" ? -1 : b === "en" ? 1 : a.localeCompare(b)))
const visible = computed(() => prints.value.filter(p => p.lang === language.value))
watch(() => [props.open, props.item?.oracle_id], async () => { if (!props.open || !props.item?.oracle_id) return; loading.value=true; try { const r=await fetch(`/api/cards/id/${props.item.oracle_id}/prints`); const d=await r.json(); prints.value=d.prints ?? []; language.value=languages.value.includes("en") ? "en" : languages.value[0] ?? "en" } finally { loading.value=false } }, { immediate: true })
</script>
<template><div v-if="open" class="backdrop" @mousedown.self="emit('close')"><section class="modal"><button @click="emit('close')">Close</button><h2>Change printing</h2><div><button v-for="lang in languages" :key="lang" @click="language=lang">{{ lang.toUpperCase() }}</button></div><p v-if="loading">Loading printings…</p><div class="prints"><button v-for="print in visible" :key="print.card_id" :disabled="replacing || print.card_id === item?.card_id" @click="emit('select', print.card_id)"><img v-if="print.image_uri" :src="print.image_uri"><span>{{ print.set_code }} #{{ print.collector_number }}</span><small>{{ print.lang.toUpperCase() }} <em v-if="print.card_id === item?.card_id">Current</em></small></button></div></section></div></template>
<style scoped>.backdrop{position:fixed;inset:0;z-index:1200;background:#0009;display:grid;place-items:center}.modal{max-width:900px;width:min(92vw,900px);max-height:88vh;overflow:auto;padding:20px;background:var(--surface-card);border-radius:18px}.prints{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:14px}.prints button{display:grid;text-align:left;gap:5px}.prints img{width:100%;border-radius:8px}</style>
