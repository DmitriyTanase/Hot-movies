import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'HOT Movies',
    loadComponent: () => import('./movies/movie-list/movie-list').then((m) => m.MovieList),
  },
  { path: '**', redirectTo: '' },
];
