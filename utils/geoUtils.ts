import { Location, User } from '../types';

export const calculateCentroid = (users: User[]): Location | null => {
  const validUsers = users.filter(u => u.location !== null);
  
  if (validUsers.length === 0) return null;

  let sumLat = 0;
  let sumLng = 0;

  validUsers.forEach(u => {
    if (u.location) {
      sumLat += u.location.lat;
      sumLng += u.location.lng;
    }
  });

  return {
    lat: sumLat / validUsers.length,
    lng: sumLng / validUsers.length,
    address: "Punto Medio Calculado"
  };
};

export const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};