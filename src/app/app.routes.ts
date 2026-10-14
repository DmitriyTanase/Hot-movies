import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'HOT Movies',
    loadComponent: () => import('./movies/movie-list/movie-list').then((m) => m.MovieList),
  },
  {
    path: 'movie/:id',
    title: 'Movie details',
    loadComponent: () => import('./movies/movie-detail/movie-detail').then((m) => m.MovieDetail),
  },
  { path: '**', redirectTo: '' },
];
