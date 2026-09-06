<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'
import { COLOR_FILTER_OPTIONS } from './filtering'

interface Props {
  modelValue: string

  colorFilters?: string[]
  supertypeFilters?: string[]
  cardTypeFilters?: string[]
  subtypeFilters?: string[]

  supertypeOptions?: string[]
  cardTypeOptions?: string[]
  subtypeOptions?: string[]
}

const props = withDefaults(
  defineProps<Props>(),
  {
    supertypeOptions: () => [],
    cardTypeOptions: () => [],
    subtypeOptions: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:colorFilters': [value: string[]]
  'update:supertypeFilters': [value: string[]]
  'update:cardTypeFilters': [value: string[]]
  'update:subtypeFilters': [value: string[]]
}>()

type FacetName =
  | 'colors'
  | 'supertypes'
  | 'types'
  | 'subtypes'

const openFacet = ref<FacetName | null>(null)

const showFacetFilters = computed(() => (
  props.colorFilters !== undefined
  && props.supertypeFilters !== undefined
  && props.cardTypeFilters !== undefined
  && props.subtypeFilters !== undefined
))

const activeFacetCount = computed(() => (
  (props.colorFilters?.length ?? 0)
  + (props.supertypeFilters?.length ?? 0)
  + (props.cardTypeFilters?.length ?? 0)
  + (props.subtypeFilters?.length ?? 0)
))

const hasFacetFilters = computed(() =>
  activeFacetCount.value > 0,
)

function toggleFilter(
  values: string[] | undefined,
  value: string,
): string[] {
  const current = values ?? []

  return current.includes(value)
    ? current.filter(
        candidate => candidate !== value,
      )
    : [...current, value]
}

function toggleColorFilter(value: string) {
  const current = props.colorFilters ?? []

  if (value === 'colorless') {
    emit(
      'update:colorFilters',
      current.includes(value)
        ? []
        : [value],
    )

    return
  }

  emit(
    'update:colorFilters',
    toggleFilter(
      current.filter(
        color => color !== 'colorless',
      ),
      value,
    ),
  )
}

function toggleFacetDropdown(
  facet: FacetName,
) {
  openFacet.value =
    openFacet.value === facet
      ? null
      : facet
}

function closeFacetDropdown(event?: Event) {
  const target = event?.target

  if (
    target instanceof Element
    && target.closest('.facet-dropdown')
  ) {
    return
  }

  openFacet.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    openFacet.value = null
  }
}

function clearFacetFilters() {
  emit('update:colorFilters', [])
  emit('update:supertypeFilters', [])
  emit('update:cardTypeFilters', [])
  emit('update:subtypeFilters', [])
}

onMounted(() => {
  window.addEventListener(
    'click',
    closeFacetDropdown,
  )

  window.addEventListener(
    'keydown',
    handleKeydown,
  )
})

onBeforeUnmount(() => {
  window.removeEventListener(
    'click',
    closeFacetDropdown,
  )

  window.removeEventListener(
    'keydown',
    handleKeydown,
  )
})
</script>

<template>
  <div class="filters">
    <label class="filter-field">
      <span class="control-label">
        Filter cards
      </span>

      <div class="filter-input-shell">
        <input
          :value="modelValue"
          type="text"
          placeholder="Search current collection..."
          @input="
            emit(
              'update:modelValue',
              ($event.target as HTMLInputElement)
                .value,
            )
          "
        >

        <span
          v-if="activeFacetCount > 0"
          class="active-filter-count"
        >
          +{{ activeFacetCount }}
        </span>
      </div>
    </label>

    <div
      v-if="showFacetFilters"
      class="facet-row"
    >
      <div class="facet-filters">
        <div class="facet-dropdown">
          <button
            type="button"
            class="facet-trigger"
            :class="{
              active:
                (colorFilters?.length ?? 0) > 0,
            }"
            :aria-expanded="
              openFacet === 'colors'
            "
            @click.stop="
              toggleFacetDropdown('colors')
            "
          >
            <span>Commander identity</span>

            <span
              v-if="colorFilters?.length"
              class="facet-count"
            >
              {{ colorFilters.length }}
            </span>
          </button>

          <div
            v-if="openFacet === 'colors'"
            class="facet-menu"
            @click.stop
          >
            <label
              v-for="option in COLOR_FILTER_OPTIONS"
              :key="option.value"
              class="facet-option"
            >
              <input
                type="checkbox"
                :checked="
                  colorFilters?.includes(
                    option.value,
                  )
                "
                @change="
                  toggleColorFilter(option.value)
                "
              >

              <span>{{ option.label }}</span>
            </label>
          </div>
        </div>

        <div class="facet-dropdown">
          <button
            type="button"
            class="facet-trigger"
            :class="{
              active:
                (supertypeFilters?.length ?? 0)
                > 0,
            }"
            :aria-expanded="
              openFacet === 'supertypes'
            "
            @click.stop="
              toggleFacetDropdown('supertypes')
            "
          >
            <span>Supertypes</span>

            <span
              v-if="supertypeFilters?.length"
              class="facet-count"
            >
              {{ supertypeFilters.length }}
            </span>
          </button>

          <div
            v-if="openFacet === 'supertypes'"
            class="facet-menu"
            @click.stop
          >
            <label
              v-for="option in supertypeOptions"
              :key="option"
              class="facet-option"
            >
              <input
                type="checkbox"
                :checked="
                  supertypeFilters?.includes(
                    option,
                  )
                "
                @change="
                  emit(
                    'update:supertypeFilters',
                    toggleFilter(
                      supertypeFilters,
                      option,
                    ),
                  )
                "
              >

              <span>{{ option }}</span>
            </label>
          </div>
        </div>

        <div class="facet-dropdown">
          <button
            type="button"
            class="facet-trigger"
            :class="{
              active:
                (cardTypeFilters?.length ?? 0)
                > 0,
            }"
            :aria-expanded="
              openFacet === 'types'
            "
            @click.stop="
              toggleFacetDropdown('types')
            "
          >
            <span>Card types</span>

            <span
              v-if="cardTypeFilters?.length"
              class="facet-count"
            >
              {{ cardTypeFilters.length }}
            </span>
          </button>

          <div
            v-if="openFacet === 'types'"
            class="facet-menu"
            @click.stop
          >
            <label
              v-for="option in cardTypeOptions"
              :key="option"
              class="facet-option"
            >
              <input
                type="checkbox"
                :checked="
                  cardTypeFilters?.includes(
                    option,
                  )
                "
                @change="
                  emit(
                    'update:cardTypeFilters',
                    toggleFilter(
                      cardTypeFilters,
                      option,
                    ),
                  )
                "
              >

              <span>{{ option }}</span>
            </label>
          </div>
        </div>

        <div class="facet-dropdown">
          <button
            type="button"
            class="facet-trigger"
            :class="{
              active:
                (subtypeFilters?.length ?? 0)
                > 0,
            }"
            :aria-expanded="
              openFacet === 'subtypes'
            "
            @click.stop="
              toggleFacetDropdown('subtypes')
            "
          >
            <span>Subtypes</span>

            <span
              v-if="subtypeFilters?.length"
              class="facet-count"
            >
              {{ subtypeFilters.length }}
            </span>
          </button>

          <div
            v-if="openFacet === 'subtypes'"
            class="facet-menu"
            @click.stop
          >
            <label
              v-for="option in subtypeOptions"
              :key="option"
              class="facet-option"
            >
              <input
                type="checkbox"
                :checked="
                  subtypeFilters?.includes(
                    option,
                  )
                "
                @change="
                  emit(
                    'update:subtypeFilters',
                    toggleFilter(
                      subtypeFilters,
                      option,
                    ),
                  )
                "
              >

              <span>{{ option }}</span>
            </label>
          </div>
        </div>
      </div>

      <button
        v-if="hasFacetFilters"
        type="button"
        class="clear-filters"
        @click="clearFacetFilters"
      >
        Clear
      </button>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: grid;
  gap: 10px;
  min-width: 0;
  width: 100%;
}

.filter-field {
  display: grid;
  gap: 7px;
}

.control-label {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

.filter-input-shell {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-input-shell input {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--surface-border-light);
  border-radius: 11px;
  background: rgba(15, 23, 42, 0.72);
  color: var(--text-light);
  font-family: var(--font-sans);
  font-size: 0.92rem;
  transition:
    border-color 120ms ease,
    background 120ms ease,
    box-shadow 120ms ease;
}

.filter-input-shell input:hover {
  background: var(--surface-hover);
}

.filter-input-shell input:focus {
  outline: none;
  border-color: var(--accent-electric);
  box-shadow:
    0 0 0 3px
    var(--accent-electric-dim);
}

.filter-input-shell input:has(
  + .active-filter-count
) {
  padding-right: 54px;
}

.active-filter-count {
  position: absolute;
  right: 9px;
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 7px;
  border:
    1px solid
    var(--accent-electric-border);
  border-radius: 999px;
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
  font-size: 0.68rem;
  font-weight: 700;
  pointer-events: none;
}

.facet-row {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.facet-filters {
  display: flex;
  gap: 7px;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
}

.facet-dropdown {
  position: relative;
}

.facet-trigger {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 36px;
  padding: 7px 10px;
  border:
    1px solid
    var(--surface-border-light);
  border-radius: 9px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.79rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

.facet-trigger:hover {
  background: var(--surface-hover);
  color: var(--text-main);
}

.facet-trigger.active,
.facet-trigger[aria-expanded='true'] {
  border-color: var(--accent-electric-border);
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
}

.facet-count {
  display: grid;
  min-width: 19px;
  height: 19px;
  box-sizing: border-box;
  place-items: center;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  font-size: 0.65rem;
}

.facet-menu {
  position: absolute;
  z-index: 60;
  top: calc(100% + 6px);
  left: 0;
  display: grid;
  min-width: max(100%, 180px);
  max-height: 280px;
  overflow-y: auto;
  padding: 7px;
  border:
    1px solid
    var(--surface-border-light);
  border-radius: 11px;
  background: rgba(15, 23, 42, 0.99);
  box-shadow: var(--shadow-lg);
}

.facet-option {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 7px 8px;
  border-radius: 7px;
  color: var(--text-main);
  font-size: 0.81rem;
  cursor: pointer;
}

.facet-option:hover {
  background: var(--surface-hover);
}

.facet-option input {
  margin: 0;
  accent-color: var(--accent-electric);
}

.clear-filters {
  flex: 0 0 auto;
  margin-left: auto;
  min-height: 34px;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.clear-filters:hover {
  border-color: var(--accent-electric-border);
  background: var(--accent-electric-dim);
  color: var(--accent-electric);
}

@media (max-width: 620px) {
  .facet-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .clear-filters {
    margin-left: 0;
  }
}
</style>