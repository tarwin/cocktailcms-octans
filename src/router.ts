import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

// Hash history so the same build works from a web server, a Puter site and
// tinyjs's file:// webview without any server-side rewrites.
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'Home', component: () => import('./pages/HomePage.vue') },
  { path: '/schemas', name: 'Blueprints', component: () => import('./pages/BlueprintsPage.vue') },
  { path: '/schemas/edit/:id', name: 'BlueprintEdit', component: () => import('./pages/BlueprintEditPage.vue') },
  { path: '/data/list/:id', name: 'DataPage', component: () => import('./pages/DataPage.vue') },
  { path: '/visualizations', name: 'DataExport', component: () => import('./pages/DataExportPage.vue') },
  {
    path: '/settings',
    component: () => import('./pages/SettingsPage.vue'),
    redirect: '/settings/project-settings',
    children: [
      { path: 'project-settings', name: 'SettingsProject', component: () => import('./pages/settings/ProjectSettings.vue') },
      { path: 'data', name: 'SettingsData', component: () => import('./pages/settings/DataSettings.vue') },
      { path: 'sync', name: 'SettingsSync', component: () => import('./pages/settings/SyncSettings.vue') },
      { path: 'projects', name: 'SettingsProjects', component: () => import('./pages/settings/ProjectsSettings.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/home' },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
