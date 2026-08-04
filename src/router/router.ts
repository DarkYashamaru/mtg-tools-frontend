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
    
    // Named search routes
    { 
      path: '/search', 
      name: 'search-results', 
      component: () => import('@/views/SearchResults.vue') 
    },
    { 
      path: '/tools/advanced-search', 
      name: 'advanced-search', 
      component: () => import('@/views/AdvancedSearch.vue') 
    },
    
    { path: '/card/:id', name: 'card-detail', component: () => import('@/views/CardDetail.vue') },
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/views/NotFound.vue')},
  ],

  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }

    // Keeps the scroll position steady when changing query text or parameters
    if (to.path === from.path) {
      return false
    }

    return { top: 0 }
  }
})