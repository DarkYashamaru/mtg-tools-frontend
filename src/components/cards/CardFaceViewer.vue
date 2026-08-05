<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CardArtFallback from './CardArtFallback.vue'
import {
  DEFAULT_CARD_ASPECT_RATIO,
  getBestCardImage,
  getCardFallbackName,
  getDisplayFaces,
  getInitialFaceIndex,
  isMultiFaceCard,
  type CardFaceImageSize,
  type CardLike,
} from './cardDisplay'

interface Props {
  card?: CardLike | null
  imageSize?: CardFaceImageSize
  interactive?: boolean
  showFlipControl?: boolean
  lazy?: boolean
  fallbackName?: string | null
  previewImageUrl?: string | null
  compactFallback?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  card: null,
  imageSize: 'normal',
  interactive: false,
  showFlipControl: false,
  lazy: true,
  fallbackName: null,
  previewImageUrl: null,
  compactFallback: false,
})

const activeFaceIndex = ref(getInitialFaceIndex(props.card))
const imageFailed = ref(false)

const faces = computed(() => getDisplayFaces(props.card))
const activeFace = computed(() => faces.value[activeFaceIndex.value] ?? null)
const hasMultipleFaces = computed(() => isMultiFaceCard(props.card))
const resolvedFallbackName = computed(() => props.fallbackName || getCardFallbackName(props.card))
const resolvedAltText = computed(() => activeFace.value?.name || resolvedFallbackName.value || 'Card image')

const imageUrl = computed(() => {
  if (props.previewImageUrl) {
    return props.previewImageUrl
  }

  return getBestCardImage(props.card, activeFaceIndex.value, props.imageSize)
})

function resetImageState() {
  imageFailed.value = false
}

function flipFace() {
  if (!hasMultipleFaces.value) {
    return
  }

  activeFaceIndex.value = (activeFaceIndex.value + 1) % faces.value.length
}

function showPreviousFace() {
  if (!hasMultipleFaces.value) {
    return
  }

  activeFaceIndex.value = (activeFaceIndex.value - 1 + faces.value.length) % faces.value.length
}

function handleKeydown(event: KeyboardEvent) {
  if (!hasMultipleFaces.value) {
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    flipFace()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    showPreviousFace()
  }
}

watch(
  () => props.card,
  () => {
    activeFaceIndex.value = getInitialFaceIndex(props.card)
    resetImageState()
  }
)

watch(imageUrl, () => {
  resetImageState()
})
</script>

<template>
  <div
    class="face-viewer"
    :class="{ interactive, 'has-multiple-faces': hasMultipleFaces }"
    :style="{ aspectRatio: DEFAULT_CARD_ASPECT_RATIO }"
    @keydown="handleKeydown"
  >
    <img
      v-if="imageUrl && !imageFailed"
      :src="imageUrl"
      :alt="resolvedAltText"
      class="face-image"
      :loading="lazy ? 'lazy' : 'eager'"
      @error="imageFailed = true"
    >

    <CardArtFallback
      v-else
      class="face-fallback"
      :card-name="resolvedFallbackName"
      :face="activeFace"
      :compact="compactFallback"
    />

    <button
      v-if="showFlipControl && hasMultipleFaces"
      class="flip-button"
      type="button"
      :aria-label="`Flip card face for ${resolvedFallbackName || 'card'}`"
      @click.stop="flipFace"
    >
      {{ activeFaceIndex + 1 }}/{{ faces.length }}
    </button>
  </div>
</template>

<style scoped>
.face-viewer {
  position: relative;
  width: 100%;
  min-height: 100%;
  overflow: hidden;
  border-radius: inherit;
}

.face-image,
.face-fallback {
  display: block;
  width: 100%;
  height: 100%;
}

.face-image {
  object-fit: cover;
}

.face-viewer.interactive {
  cursor: pointer;
}

.flip-button {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 6px 10px;
  border: 1px solid var(--accent-electric-border);
  border-radius: 999px;
  background: rgba(9, 13, 22, 0.88);
  color: var(--accent-electric);
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
}

.flip-button:hover {
  background: rgba(15, 23, 42, 0.96);
}

.flip-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--accent-electric-dim);
}
</style>
