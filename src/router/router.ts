import { createRouter, createWebHistory } from 'vue-router'
import Landing from '@/views/Landing.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'landing', component: Landing },
    { path: '/tools/deck-details', component: () => import('@/views/DeckDetails.vue') },
    { path: '/tools/bulk-deck-builder', component: () => import('@/views/BulkDeckAnalysis.vue') },
    { path: '/tools/bulk-deck-builder/possible-commanders', component: () => import('@/views/PossibleCommanders.vue') },
    { path: '/tools/bulk-deck-builder/select-commander-theme', component: () => import('@/views/SelectCommanderTheme.vue') },
    { path: '/tools/bulk-deck-builder/selected-theme', component: () => import('@/views/SelectedTheme.vue') },
    { path: '/tools/advanced-search', component: () => import('@/views/AdvancedSearch.vue') },
    { path: '/card/:id', component: () => import('@/views/CardDetail.vue') },
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/views/NotFound.vue')},
  ],

  scrollBehavior(to, from, savedPosition) {
    // Browser back / forward
    if (savedPosition) {
      return savedPosition
    }

    // SAME route, only query changed (lightbox open/close)
    if (to.path === from.path) {
      return false
    }

    // Different page → reset scroll
    return { top: 0 }
  }
})
