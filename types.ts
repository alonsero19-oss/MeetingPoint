export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface User {
  id: string;
  name: string;
  location: Location | null;
  isCurrentUser: boolean;
}

export interface GroupSession {
  id: string;
  name: string;
  joinCode: string;
}

export interface Restaurant {
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  cuisine?: string;
  distance?: string; // Human readable string
  photoUrl?: string;
  location?: Location;
  googleMapsUri?: string;
}

export interface FilterPreferences {
  cuisine: string[];
  priceRange: number; // 1, 2, 3, 4 ($ to $$$$)
  placeType: 'restaurant' | 'bar' | 'cafe';
}

export enum AppScreen {
  WELCOME = 'WELCOME',
  JOIN_GROUP = 'JOIN_GROUP',
  CREATE_GROUP = 'CREATE_GROUP',
  LOCATION_PICKER = 'LOCATION_PICKER',
  PREFERENCES = 'PREFERENCES',
  LOADING = 'LOADING',
  RESULTS = 'RESULTS'
}