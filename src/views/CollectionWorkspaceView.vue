<script setup lang="ts">
import { useCollectionData } from '@/composables/collection/useCollectionData'
import { useCollectionPresentation } from '@/composables/collection/useCollectionPresentation'
import { useCollectionInsights } from '@/composables/collection/useCollectionInsights'
import { useCollectionCardSearch } from '@/composables/collection/useCollectionCardSearch'
import { useCollectionExport } from '@/composables/collection/useCollectionExport'
import { useCollectionStorePrices } from '@/composables/collection/useCollectionStorePrices'
import { useCollectionMutations } from '@/composables/collection/useCollectionMutations'
import { enrichCollectionWithGameplay } from '@/composables/collection/collectionMetadata'
import CollectionExportPanel from '@/components/collection/CollectionExportPanel.vue'
import CollectionCardContextMenu from '@/components/collection/CollectionCardContextMenu.vue'
import CollectionWorkspaceContent from '@/components/collection/CollectionWorkspaceContent.vue'

import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import CollectionHeader from '@/components/collection/CollectionHeader.vue'

import CollectionManaCurve from '@/components/collection/CollectionManaCurve.vue'
import CollectionToolbar from '@/components/collection/CollectionToolbar.vue'

import CardPrintPickerModal from '@/components/collection/CardPrintPickerModal.vue'
import BasicLandAdjustModal from '@/components/collection/BasicLandAdjustModal.vue'
import CommanderSourceBrowserModal from '@/components/collection/CommanderSourceBrowserModal.vue'

import type {
  BasicLandAdjustment,
  CollectionCardContextMenuPayload,
  CollectionCardSearchResult,
  CollectionItem,
  CollectionRecord,
  WorkspaceOrganizationMode,
} from '@/components/collection/types'

import { useAuthStore } from '@/stores/authStore'

const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const { authHeaders } = storeToRefs(authStore)

const errorMessage = ref('')

const collection = ref<CollectionRecord | null>(null)
const organizationMode = ref<WorkspaceOrganizationMode>('zone')
const printPickerItem = ref<CollectionItem | null>(null)

const isAddingCard = ref(false)

const hoveredItem = ref<CollectionItem | null>(null)

const contextMenuState = ref<CollectionCardContextMenuPayload | null>(null)

const isSourceBrowserOpen = ref(false)
const isAddingSourceCard = ref(false)

const sourceActionError = ref('')
const sourceActionMessage = ref('')

const isBasicLandModalOpen = ref(false)
const basicLandAdjustmentMessage = ref('')

const collectionId = computed(() =>
  String(route.params.collectionId ?? ''),
)

const isMasterCollectionRoute = computed(
  () => collectionId.value === 'master',
)

const isReadOnlyCollection = computed(
  () => collection.value?.is_read_only === true,
)

const isCommanderCollection = computed(
  () => collection.value?.deck_type.toLowerCase() === 'commander',
)

const legacyBuilderSource = computed(() =>
  typeof route.query.builderSource === 'string'
    ? route.query.builderSource
    : null,
)

const legacyBuilderTheme = computed(() => {
  const rawValue =
    typeof route.query.builderTheme === 'string'
      ? Number(route.query.builderTheme)
      : Number.NaN

  return Number.isFinite(rawValue)
    ? rawValue
    : null
})

const builderSourceCollectionId = computed(
  () =>
    collection.value?.builder_source_collection_id ??
    legacyBuilderSource.value ??
    'master',
)

const builderThemeId = computed(
  () =>
    collection.value?.builder_theme_id ??
    legacyBuilderTheme.value ??
    -1,
)

const commanderItems = computed(
  () =>
    collection.value?.items.filter(
      (item) => item.zone === 'commander',
    ) ?? [],
)

const isCommanderTemplateMode = computed(
  () =>
    collection.value?.deck_type.toLowerCase() === 'commander' &&
    commanderWorkspaceMode.value === 'template',
)

const existingCommanderDeckOracleIds = computed(() =>
  Array.from(
    new Set(
      (collection.value?.items ?? [])
        .filter(
          (item) =>
            item.oracle_id &&
            !isBasicLand(item),
        )
        .map(
          (item) => item.oracle_id as string,
        ),
    ),
  ),
)

const deckValueUsd = computed(
  () =>
    collection.value?.items
      .filter((item) => item.zone !== 'maybeboard')
      .reduce(
        (total, item) =>
          total +
          (item.gameplay_card?.lowest_price_usd ?? 0) *
            item.amount,
        0,
      ) ?? 0,
)

function isBasicLand(item: CollectionItem) {
  return (
    item.gameplay_card?.faces.some(
      (face) =>
        face.supertypes.includes('Basic') &&
        face.card_types.includes('Land'),
    ) ?? false
  )
}

const showCommanderBuilderAction = computed(
  () =>
    collection.value?.deck_type.toLowerCase() ===
    'binder',
)

const showCommanderBuilderResumeAction = computed(
  () =>
    collection.value?.deck_type.toLowerCase() ===
      'commander' &&
    !isReadOnlyCollection.value &&
    Boolean(
      collection.value.commander_oracle_id,
    ),
)

const showMasterSearchAction = computed(
  () => collection.value?.is_virtual === true,
)

const shouldShowManaCurve = computed(() => {
  const deckType =
    collection.value?.deck_type.toLowerCase()

  return (
    deckType === 'commander' ||
    deckType === 'standard'
  )
})

async function refreshCollectionSupplementaryData() {
  syncSavedCollectionSnapshot()
  invalidateProfileSections()

  const activeOrganizationMode = organizationMode.value
  const profileSectionsRefresh =
    activeOrganizationMode === 'zone'
      ? Promise.resolve()
      : loadProfileSections(activeOrganizationMode)

  await Promise.all([
    loadCommanderScores(),
    profileSectionsRefresh,
  ])
}

function handleHoverItem(
  item: CollectionItem | null,
) {
  hoveredItem.value = item
}

async function addSuggestedCard(
  suggestion: CollectionCardSearchResult,
) {
  if (
    !collection.value ||
    isAddingCard.value ||
    isReadOnlyCollection.value
  ) {
    return
  }

  isAddingCard.value = true

  errorMessage.value = ''
  addCardQuery.value = ''

  dismissAddCardSuggestions()

  try {
    await addCardToMainboard(
      suggestion.card_id,
    )
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Unable to add card to collection.'
  } finally {
    isAddingCard.value = false
  }
}

async function addSourceCard(
  item: CollectionItem,
) {
  if (isAddingSourceCard.value) {
    return
  }

  isAddingSourceCard.value = true

  sourceActionError.value = ''
  sourceActionMessage.value = ''

  try {
    await addCardToMainboard(
      item.card_id,
    )

    sourceActionMessage.value =
      `Added ${item.name || 'card'} to the deck.`
  } catch (error) {
    sourceActionError.value =
      error instanceof Error
        ? error.message
        : 'Unable to add source card.'
  } finally {
    isAddingSourceCard.value = false
  }
}

function openPrintPicker() {
  const item =
    contextMenuState.value?.item

  if (
    !item?.oracle_id ||
    isReadOnlyCollection.value
  ) {
    return
  }

  printPickerItem.value = item

  closeContextMenu()
}

function openBasicLandAdjustModal() {
  if (
    !collection.value ||
    !isCommanderCollection.value ||
    isReadOnlyCollection.value
  ) {
    return
  }

  basicLandAdjustmentMessage.value = ''
  isBasicLandModalOpen.value = true
}

async function handleBasicLandUnauthorized() {
  isBasicLandModalOpen.value = false

  await onUnauthorized()
}

async function handleBasicLandAdjusted(
  updatedCollection: CollectionRecord,
  adjustment: BasicLandAdjustment,
) {
  const mergedCollection =
    mergeCollectionMetadata(
      updatedCollection,
    )

  collection.value =
    await enrichCollectionWithGameplay(
      mergedCollection,
      collection.value,
    )

  hoveredItem.value = null
  deckLegalityResult.value = null
  isBasicLandModalOpen.value = false

  basicLandAdjustmentMessage.value =
    adjustment.target_reached
      ? `Basic lands adjusted to ${adjustment.reachable_land_count} total lands.`
      : adjustment.warning ||
        `Basic lands adjusted to ${adjustment.reachable_land_count} total lands.`

  await refreshCollectionSupplementaryData()
      await loadCommanderTemplate()
}

function openItemCardDetails(
  item: CollectionItem,
) {
  if (!item.oracle_id) {
    return
  }

  const routeData = router.resolve({
    name: 'card-detail',

    params: {
      id: item.oracle_id,
    },
  })

  window.open(
    routeData.href,
    '_blank',
    'noopener,noreferrer',
  )
}

function goToCommanderBuilder() {
  if (
    !collection.value ||
    collection.value.deck_type.toLowerCase() !==
      'binder'
  ) {
    return
  }

  void router.push({
    name: 'collection-possible-commanders',

    params: {
      collectionId: String(
        collection.value.id,
      ),
    },
  })
}

function reopenCommanderBuilder() {
  if (
    !collection.value?.commander_oracle_id
  ) {
    return
  }

  sourceActionError.value = ''
  sourceActionMessage.value = ''

  isSourceBrowserOpen.value = !isSourceBrowserOpen.value
}

function closeSourceBrowser() {
  isSourceBrowserOpen.value = false

  sourceActionError.value = ''
  sourceActionMessage.value = ''
}

function goToMasterAdvancedSearch() {
  void router.push({
    name: 'advanced-search',

    query: {
      scope: 'master',
    },
  })
}

async function onUnauthorized() {
  authStore.logout()
  await router.replace({ name: 'login', query: { redirect: route.fullPath } })
}

const { isLoading, loadErrorMessage, loadCollection, syncSavedCollectionSnapshot, mergeCollectionMetadata } =
  useCollectionData({
    collection, collectionId, isMasterCollectionRoute, authHeaders, onUnauthorized,
    onBeforeLoad() {
      errorMessage.value = ''
      commanderScoresByOracleId.value = {}
      invalidateProfileSections()
    },
    async onLoaded() {
      await refreshCollectionSupplementaryData()
      await loadCommanderTemplate()
      deckLegalityResult.value = null
      hoveredItem.value = null
      organizationMode.value = 'zone'
      commanderWorkspaceMode.value = 'normal'
      viewMode.value = collection.value?.deck_type.toLowerCase() === 'binder' ? 'list' : 'grid'
    },
  })

const {
  commanderScoresByOracleId, scoredCollection, profileSections, invalidateProfileSections,
  loadProfileSections, loadCommanderScores, commanderTemplate, loadCommanderTemplate, isValidatingDeck, deckLegalityResult, validateDeck,
} = useCollectionInsights({
  collection, isCommanderCollection, isMasterCollectionRoute, organizationMode,
  builderSourceCollectionId, builderThemeId, authHeaders, errorMessage, onUnauthorized,
})

const {
  filterText, colorFilters, cardColors, cardColorMode, supertypeFilters, cardTypeFilters, subtypeFilters,
  viewMode, sortKey, sortDirection, commanderWorkspaceMode,
  facetOptions, hasSortableScores, filteredCollection,
} = useCollectionPresentation({ collection, scoredCollection, organizationMode })

const {
  exportOptions, exportMessage, exportableFilteredItems, filteredCardCopies, exportText,
  copyExport, downloadExport,
} = useCollectionExport({ collection, filteredCollection })

const { addCardQuery, addCardSuggestions, isSearchingCards, dismissAddCardSuggestions } =
  useCollectionCardSearch({ errorMessage })

const {
  mutatingItemIds, isMutatingCommander, isReplacingPrint, mutateItemQuantity,
  moveItemToZone, addCardToMainboard, replacePrint, mutateCommander,
} = useCollectionMutations({
  collection, isReadOnlyCollection, isCommanderCollection, authHeaders, errorMessage,
  hoveredItem, printPickerItem, deckLegalityResult, isSourceBrowserOpen,
  onUnauthorized, closeContextMenu, mergeCollectionMetadata, refreshCollectionSupplementaryData,
})

const {
  isRefreshingStorePrices, storePriceRefreshProgress, canRefreshStorePrices,
  storePriceRefreshLimitMessage, refreshCollectionStorePrices, stopStorePriceRefresh,
} = useCollectionStorePrices({
  collection, collectionId, isCommanderCollection, isReadOnlyCollection,
  authHeaders, errorMessage, onUnauthorized,
})

function handleContextMenu(payload: CollectionCardContextMenuPayload) {
  contextMenuState.value = { ...payload }
}
function closeContextMenu() { contextMenuState.value = null }
function openCardDetails(item: CollectionItem) {
  openItemCardDetails(item)
  closeContextMenu()
}

onMounted(() => { void loadCollection() })

watch(
  collectionId,
  (newId, oldId) => {
    if (newId !== oldId) {
      closeContextMenu()
      dismissAddCardSuggestions()
      stopStorePriceRefresh()

      void loadCollection()
    }
  },
)

watch(
  viewMode,
  (mode) => {
    if (mode !== 'list') {
      hoveredItem.value = null
    }

    closeContextMenu()
  },
)

watch(
  [
    filterText,
    colorFilters,
    cardColors,
    cardColorMode,
    supertypeFilters,
    cardTypeFilters,
    subtypeFilters,
  ],
  () => {
    hoveredItem.value = null

    exportMessage.value = ''

    closeContextMenu()
  },
)

watch(
  [sortKey, sortDirection],
  () => {
    exportMessage.value = ''
  },
)

</script>

<template>
  <div class="workspace-page">
    <section class="workspace-shell">
      <!-- Loading --------------------------------------------------------- -->

      <div
        v-if="isLoading"
        class="loading-panel skeleton-pulse"
        role="status"
        aria-live="polite"
      >
        <div class="loading-copy">
          <h2>
            Loading collection workspace...
          </h2>
        </div>
      </div>

      <!-- Fatal load error ------------------------------------------------ -->

      <div
        v-else-if="loadErrorMessage"
        class="state-panel error"
      >
        <h2>
          Unable to load collection
        </h2>

        <p>
          {{ loadErrorMessage }}
        </p>
      </div>

      <!-- Workspace ------------------------------------------------------- -->

      <template
        v-else-if="
          collection &&
          filteredCollection
        "
      >
        <CollectionHeader
          :collection="collection"
          :deck-value-usd="deckValueUsd"
          :legality-result="deckLegalityResult"
          :is-validating-deck="isValidatingDeck"
          :show-deck-metrics="true"
          :show-commander-builder-action="showCommanderBuilderAction"
          :show-commander-builder-resume-action="showCommanderBuilderResumeAction"
          :commander-builder-open="isSourceBrowserOpen"
          :show-master-search-action="showMasterSearchAction"
          @create-commander-deck="goToCommanderBuilder"
          @open-commander-builder="reopenCommanderBuilder"
          @search-master-collection="goToMasterAdvancedSearch"
          @validate-deck="validateDeck"
        />

        <!-- Deck analytics ------------------------------------------------ -->

        <CollectionManaCurve
          v-if="shouldShowManaCurve"
          :collection="collection"
          collapsible
          initially-collapsed
        />

        <!-- Export -------------------------------------------------------- -->

        <CollectionExportPanel
          v-model:options="exportOptions"
          :card-copies="filteredCardCopies"
          :entry-count="exportableFilteredItems.length"
          :message="exportMessage"
          :can-export="!!exportText"
          @copy="copyExport"
          @download="downloadExport"
        />

        <!-- Workspace feedback ------------------------------------------- -->

        <div
          v-if="errorMessage"
          class="workspace-message workspace-message-error"
          role="alert"
        >
          <span>
            {{ errorMessage }}
          </span>

          <button
            type="button"
            class="workspace-message-dismiss"
            aria-label="Dismiss error"
            @click="errorMessage = ''"
          >
            ×
          </button>
        </div>

        <p
          v-if="basicLandAdjustmentMessage"
          class="workspace-message workspace-message-success"
          role="status"
        >
          {{ basicLandAdjustmentMessage }}
        </p>

        <p
          v-if="storePriceRefreshLimitMessage"
          class="workspace-message workspace-message-error"
          role="status"
        >
          {{ storePriceRefreshLimitMessage }}
        </p>

        <p
          v-if="storePriceRefreshProgress"
          class="workspace-message workspace-message-success"
          role="status"
          aria-live="polite"
        >
          {{ storePriceRefreshProgress }}
        </p>

        <!--
          The toolbar and the cards are deliberately one workspace.

          Add card, filters, sorting, organization and view controls
          remain immediately above the cards they affect.
        -->

        <section class="deck-workspace">
          <CollectionToolbar
            v-model="viewMode"
            v-model:commander-workspace-mode="commanderWorkspaceMode"
            v-model:organization-mode="organizationMode"
            v-model:sort-key="sortKey"
            v-model:sort-direction="sortDirection"
            v-model:filter-text="filterText"
            v-model:color-filters="colorFilters"
            v-model:card-colors="cardColors"
            v-model:card-color-mode="cardColorMode"
            v-model:supertype-filters="supertypeFilters"
            v-model:card-type-filters="cardTypeFilters"
            v-model:subtype-filters="subtypeFilters"
            v-model:add-card-query="addCardQuery"
            :collection="collection"
            :show-score-sort="hasSortableScores"
            :supertype-options="facetOptions.supertypes"
            :card-type-options="facetOptions.cardTypes"
            :subtype-options="facetOptions.subtypes"
            :add-card-suggestions="addCardSuggestions"
            :add-card-loading="isSearchingCards"
            :add-card-disabled="isAddingCard || isReadOnlyCollection"
            :show-basic-land-adjust="isCommanderCollection && !isReadOnlyCollection"
            :basic-land-adjust-disabled="commanderItems.length === 0"
            :show-store-price-refresh="isCommanderCollection && !isReadOnlyCollection"
            :store-price-refresh-disabled="!canRefreshStorePrices || isRefreshingStorePrices"
            :store-price-refresh-label="isRefreshingStorePrices ? 'Refreshing…' : 'Refresh store prices'"
            @adjust-basic-lands="openBasicLandAdjustModal"
            @refresh-store-prices="refreshCollectionStorePrices"
            @select-add-card-suggestion="addSuggestedCard"
            @dismiss-add-card-suggestions="dismissAddCardSuggestions"
          />

          <CollectionWorkspaceContent
            :collection="filteredCollection"
            :view-mode="viewMode"
            :organization-mode="organizationMode"
            :profile-sections="profileSections"
            :commander-items="commanderItems"
            :commander-template="commanderTemplate"
            :template-mode="isCommanderTemplateMode"
            :source-browser-open="isSourceBrowserOpen"
            :hovered-item="hoveredItem"
            :mutating-item-ids="mutatingItemIds"
            :read-only="isReadOnlyCollection"
            @hover-item="handleHoverItem"
            @context-menu="handleContextMenu"
            @increment-item="mutateItemQuantity($event, 'increment')"
            @decrement-item="mutateItemQuantity($event, 'decrement')"
          >
            <template #source-browser>
              <CommanderSourceBrowserModal
                :open="isSourceBrowserOpen"
                :source-collection-id="builderSourceCollectionId"
                :commander-oracle-id="collection.commander_oracle_id!"
                :theme-id="builderThemeId"
                :deck-oracle-ids="existingCommanderDeckOracleIds"
                :adding-card="isAddingSourceCard"
                :action-error="sourceActionError"
                :action-message="sourceActionMessage"
                @close="closeSourceBrowser"
                @add-card="addSourceCard"
                @open-card="openItemCardDetails"
              />
            </template>
          </CollectionWorkspaceContent>
        </section>

        <!-- Context menu -------------------------------------------------- -->

        <CollectionCardContextMenu
          :state="contextMenuState"
          :is-read-only-collection="isReadOnlyCollection"
          :is-commander-collection="isCommanderCollection"
          :is-mutating-commander="isMutatingCommander"
          :mutating-item-ids="mutatingItemIds"
          @close="closeContextMenu"
          @open-card="openCardDetails"
          @change-print="openPrintPicker"
          @commander="mutateCommander"
          @move-zone="moveItemToZone"
        />

        <!-- Modals -------------------------------------------------------- -->

        <BasicLandAdjustModal
          :open="isBasicLandModalOpen"
          :collection="collection"
          :auth-headers="authHeaders"
          @close="isBasicLandModalOpen = false"
          @applied="handleBasicLandAdjusted"
          @unauthorized="handleBasicLandUnauthorized"
        />

        <CardPrintPickerModal
          :open="!!printPickerItem"
          :item="printPickerItem"
          :replacing="isReplacingPrint"
          @close="printPickerItem = null"
          @select="replacePrint"
        />

      </template>
    </section>
  </div>
</template>

<style scoped src="./CollectionWorkspaceView.css"></style>
