import { createRouter, createWebHistory } from 'vue-router'
import Landing from '@/views/Landing.vue'
import { useAuthStore } from '@/stores/authStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'landing', component: Landing },
    { path: '/tools/deck-details', component: () => import('@/views/DeckDetails.vue') },
    {
      path: '/tools/bulk-deck-builder',
      name: 'deck-dashboard',
      component: () => import('@/views/DeckDashboard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tools/bulk-deck-builder/new',
      name: 'new-collection',
      component: () => import('@/views/NewCollectionView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tools/bulk-deck-builder/collections/:collectionId',
      name: 'collection-workspace',
      component: () => import('@/views/CollectionWorkspaceView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tools/bulk-deck-builder/possible-commanders',
      name: 'possible-commanders',
      component: () => import('@/views/PossibleCommanders.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tools/bulk-deck-builder/collections/:collectionId/possible-commanders',
      name: 'collection-possible-commanders',
      component: () => import('@/views/PossibleCommanders.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tools/bulk-deck-builder/select-commander-theme',
      name: 'select-commander-theme',
      component: () => import('@/views/SelectCommanderTheme.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tools/bulk-deck-builder/selected-theme',
      name: 'selected-theme',
      component: () => import('@/views/SelectedTheme.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tools/bulk-deck-builder/collections/:collectionId/commanders/:commanderId/themes',
      name: 'collection-select-commander-theme',
      component: () => import('@/views/SelectCommanderTheme.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tools/bulk-deck-builder/collections/:collectionId/commanders/:commanderId/themes/:themeId',
      name: 'collection-selected-theme',
      component: () => import('@/views/SelectedTheme.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tools/bulk-deck-builder/collections/:collectionId/commanders/:commanderId/themes/:themeId/builder/:builderCollectionId',
      name: 'commander-builder',
      component: () => import('@/views/CommanderBuilderView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    
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

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/tools/bulk-deck-builder'

    return redirect.startsWith('/') ? redirect : '/tools/bulk-deck-builder'
  }

  return true
})

export default router
