<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import DeckInput from '@/components/DeckInput.vue'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const { authHeaders } = storeToRefs(authStore)

const collectionName = ref('')
const deckText = ref('')
const deckType = ref<'Binder' | 'Standard' | 'Commander'>('Binder')
const includeInMaster = ref(true)
const hasChosenMasterInclusion = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

watch(deckType, (type) => {
  if (!hasChosenMasterInclusion.value) includeInMaster.value = type !== 'Commander'
})

function chooseMasterInclusion() {
  hasChosenMasterInclusion.value = true
}

async function submitCollection() {
  errorMessage.value = ''

  if (!deckText.value.trim() && !collectionName.value.trim()) {
    errorMessage.value = 'Enter a collection name when creating an empty collection.'
    return
  }

  isSubmitting.value = true

  try {
    const response = await fetch('/api/collections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders.value,
      },
      body: JSON.stringify({
        name: collectionName.value.trim() || null,
        deck_text: deckText.value,
        deck_type: deckType.value,
        include_in_master: includeInMaster.value,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      authStore.logout()
      router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
      return
    }

    if (!response.ok || !data.success || !data.collection) {
      throw new Error(data.error || 'Unable to create collection.')
    }

    router.push({ name: 'deck-dashboard' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to create collection.'
  } finally {
    isSubmitting.value = false
  }
}

function goBack() {
  router.push({ name: 'deck-dashboard' })
}
</script>

<template>
  <div class="create-page">
    <section class="create-shell">
      <header class="create-hero">
        <div>
          <span class="eyebrow">Create Collection</span>
          <h1>Import a bulk collection into your account</h1>
          <p class="description">
            Paste a print-specific deck or collection list and save it directly to your account. This replaces the old browser-only workspace flow.
          </p>
        </div>

        <button class="back-button" type="button" @click="goBack">
          Back to Deck Dashboard
        </button>
      </header>

      <section class="form-card">
        <label class="field">
          <span>Collection Name</span>
          <input
            v-model="collectionName"
            type="text"
            placeholder="Required when creating an empty collection."
          >
        </label>

        <fieldset class="field type-fieldset">
          <legend>Collection Type</legend>

          <label class="type-option">
            <input v-model="deckType" type="radio" value="Binder">
            <span>
              <strong>Binder</strong>
              <small>Bulk card pool or trade binder. No commander metadata expected.</small>
            </span>
          </label>

          <label class="type-option">
            <input v-model="deckType" type="radio" value="Standard">
            <span>
              <strong>Standard Deck</strong>
              <small>Structured deck import without commander-specific presentation.</small>
            </span>
          </label>

          <label class="type-option">
            <input v-model="deckType" type="radio" value="Commander">
            <span>
              <strong>Commander Deck</strong>
              <small>Use a <code>Commander</code> section if you want the commander assigned automatically.</small>
            </span>
          </label>
        </fieldset>

        <label class="master-inclusion-option">
          <input v-model="includeInMaster" type="checkbox" @change="chooseMasterInclusion">
          <span>
            <strong>Include in Master Collection</strong>
            <small>
              New Commander decks start excluded because they may be planned purchases. Turn this on once this deck should reserve owned cards.
            </small>
          </span>
        </label>

        <div class="field">
          <span>Collection List</span>
          <DeckInput
            v-model="deckText"
            placeholder="Commander&#10;1 Sol Ring (CMM) 123&#10;Mainboard&#10;1 Arcane Signet (LCC) 297"
          />
          <small class="field-hint">Leave this blank to create an empty, named collection and add cards manually later.</small>
        </div>

        <div class="format-note">
          <strong>Supported formats:</strong> one print per line, such as <code>1 Sol Ring (CMM) 123</code>, or scan-export rows such as
          <code>3x[TAB]ea008094-d995-4740-9b39-c61049356c55</code>. Trailing deck-app labels such as <code>[Counters]</code> and ownership markers such as <code>^Have,#37d67a^</code> are ignored.
          Optional section headers like <code>Commander</code>, <code>Mainboard</code>, <code>Sideboard</code>, and <code>Maybeboard</code> are supported for the print-list format.
        </div>

        <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>

        <div class="actions-row">
          <button class="primary-button" type="button" :disabled="isSubmitting" @click="submitCollection">
            {{ isSubmitting ? 'Saving Collection...' : 'Create Collection' }}
          </button>
          <button class="secondary-button" type="button" :disabled="isSubmitting" @click="goBack">
            Cancel
          </button>
        </div>
      </section>
    </section>
  </div>
</template>

<style scoped>
.create-page {
  padding: 24px;
}

.create-shell {
  max-width: none;
  margin: 0;
  display: grid;
  gap: 24px;
}

.create-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  padding: 30px;
  border-radius: 28px;
  border: 1px solid var(--accent-electric-border);
  background:
    linear-gradient(135deg, rgba(56, 189, 248, 0.16), rgba(15, 23, 42, 0.95)),
    var(--surface-card);
  box-shadow: var(--shadow-lg);
}

.eyebrow {
  display: inline-block;
  margin-bottom: 12px;
  color: var(--accent-electric);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--text-light);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
}

.description {
  max-width: 60ch;
  margin: 12px 0 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.back-button,
.primary-button,
.secondary-button {
  padding: 13px 18px;
  border-radius: 14px;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}

.back-button,
.secondary-button {
  border: 1px solid var(--surface-border-light);
  background: transparent;
  color: var(--text-main);
}

.primary-button {
  border: none;
  background: var(--accent-electric);
  color: #04131d;
}

.primary-button:disabled,
.secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.form-card {
  padding: 28px;
  border-radius: 24px;
  border: 1px solid var(--surface-border-light);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.04), rgba(15, 23, 42, 0.98)),
    var(--surface-card);
  box-shadow: var(--shadow-md);
}

.field {
  display: grid;
  gap: 10px;
  margin-bottom: 20px;
}

.field > span {
  color: var(--text-main);
  font-size: 0.92rem;
  font-weight: 700;
}

.field-hint {
  color: var(--text-muted);
  font-size: 0.85rem;
  line-height: 1.45;
}
.field input {
  width: 100%;
  padding: 14px 15px;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid var(--surface-border-light);
  background: var(--surface-hover);
  color: var(--text-light);
  font-family: var(--font-sans);
  font-size: 0.95rem;
}

.field input:focus {
  outline: none;
  border-color: var(--accent-electric);
  box-shadow: 0 0 0 4px var(--accent-electric-dim);
}

.type-fieldset {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.72);
}

.type-fieldset legend {
  padding: 0 8px;
  color: var(--text-main);
  font-size: 0.92rem;
  font-weight: 700;
}

.type-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  cursor: pointer;
}

.type-option + .type-option {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.type-option input {
  margin-top: 4px;
}

.type-option span {
  display: grid;
  gap: 4px;
}

.type-option strong {
  color: var(--text-light);
}

.type-option small {
  color: var(--text-muted);
  line-height: 1.55;
}

.type-option code {
  color: var(--accent-electric);
  font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
}

.master-inclusion-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid var(--accent-electric-border);
  border-radius: 16px;
  background: rgba(56, 189, 248, 0.06);
  cursor: pointer;
}

.master-inclusion-option input {
  width: auto;
  margin: 4px 0 0;
  accent-color: var(--accent-electric);
}

.master-inclusion-option span {
  display: grid;
  gap: 4px;
}

.master-inclusion-option strong {
  color: var(--text-light);
}

.master-inclusion-option small {
  color: var(--text-muted);
  line-height: 1.55;
}

.format-note {
  margin-bottom: 20px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--surface-border-light);
  background: rgba(15, 23, 42, 0.72);
  color: var(--text-muted);
  line-height: 1.65;
}

.format-note strong {
  color: var(--text-main);
}

.format-note code {
  color: var(--accent-electric);
  font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
}

.status-banner {
  margin: 0 0 20px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid transparent;
  font-size: 0.94rem;
}

.status-banner.error {
  background: rgba(127, 29, 29, 0.2);
  border-color: var(--error-border);
  color: var(--error-text);
}

.actions-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 760px) {
  .create-page {
    padding: 16px;
  }

  .create-hero {
    padding: 22px;
    align-items: stretch;
    flex-direction: column;
  }

  .actions-row > * {
    width: 100%;
  }
}
</style>
