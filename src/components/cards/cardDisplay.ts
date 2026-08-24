export type CardFaceImageSize = 'small' | 'normal' | 'large'

export type CardFaceLike = {
  name?: string | null
  mana_cost?: string | null
  oracle_text?: string | null
  supertypes?: string[]
  card_types?: string[]
  subtypes?: string[]
  small_image?: string | null
  normal_image?: string | null
  large_image?: string | null
}

export type CardLike = {
  name?: string | null
  layout?: string | null
  faces?: CardFaceLike[] | null
}

export const DEFAULT_CARD_ASPECT_RATIO = '0.71 / 1'

function getFrontFaceName(card?: CardLike | null): string | null {
  const cardName = card?.name?.split('//')[0]?.trim()
  return cardName ? cardName.toLocaleLowerCase() : null
}

export function getDisplayFaces(card?: CardLike | null): CardFaceLike[] {
  if (!card || !Array.isArray(card.faces)) {
    return []
  }

  const faces = card.faces.filter((face): face is CardFaceLike => !!face)
  const frontFaceName = getFrontFaceName(card)
  const frontFaceIndex = frontFaceName
    ? faces.findIndex((face) => face.name?.trim().toLocaleLowerCase() === frontFaceName)
    : -1

  const orderedFaces = frontFaceIndex <= 0
    ? faces
    : [faces[frontFaceIndex], ...faces.slice(0, frontFaceIndex), ...faces.slice(frontFaceIndex + 1)]

  return usesSharedFrontImage(card) ? orderedFaces.slice(0, 1) : orderedFaces
}

export function isMultiFaceCard(card?: CardLike | null): boolean {
  return getDisplayFaces(card).length > 1
}

export function usesSharedFrontImage(card?: CardLike | null): boolean {
  const layout = card?.layout?.trim().toLowerCase() || ''
  return layout === 'prepare' || layout === 'prepared' || layout === 'room'
}

export function getBestFaceImage(face: CardFaceLike | undefined, size: CardFaceImageSize): string | null {
  if (!face) {
    return null
  }

  const imageCandidatesBySize: Record<CardFaceImageSize, Array<string | null | undefined>> = {
    small: [face.small_image, face.normal_image, face.large_image],
    normal: [face.normal_image, face.large_image, face.small_image],
    large: [face.large_image, face.normal_image, face.small_image],
  }

  for (const candidate of imageCandidatesBySize[size]) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }

  return null
}

export function getBestCardImage(
  card: CardLike | null | undefined,
  activeFaceIndex: number,
  size: CardFaceImageSize
): string | null {
  const faces = getDisplayFaces(card)
  if (faces.length === 0) {
    return null
  }

  if (usesSharedFrontImage(card)) {
    return getBestFaceImage(faces[0], size)
  }

  const preferredFaces = [
    faces[activeFaceIndex],
    ...faces.filter((_, index) => index !== activeFaceIndex),
  ]

  for (const face of preferredFaces) {
    const image = getBestFaceImage(face, size)
    if (image) {
      return image
    }
  }

  return null
}

export function getInitialFaceIndex(card?: CardLike | null): number {
  const faces = getDisplayFaces(card)

  if (faces.length <= 1) {
    return 0
  }

  const firstFaceWithImageIndex = faces.findIndex((face) => getBestFaceImage(face, 'normal'))
  return firstFaceWithImageIndex >= 0 ? firstFaceWithImageIndex : 0
}

export function getCardFallbackName(card?: CardLike | null): string {
  return card?.name?.trim() || 'Unknown Card'
}

export function getFaceTypeLine(face: CardFaceLike | undefined): string {
  if (!face) {
    return ''
  }

  const left = [...(face.supertypes ?? []), ...(face.card_types ?? [])].filter(Boolean).join(' ')
  const right = [...(face.subtypes ?? [])].filter(Boolean).join(' ')

  if (left && right) {
    return `${left} - ${right}`
  }

  return left || right
}
