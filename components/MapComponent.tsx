import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Location, User, Restaurant } from '../types';

// Fix for default Leaflet icons in React
const iconPerson = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const iconCenter = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', // Red for meeting point
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [30, 46], // Slightly larger
    iconAnchor: [15, 46],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const iconPlace = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png', // Orange for restaurants
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface MapProps {
  users?: User[];
  center?: Location;
  restaurants?: Restaurant[];
  interactive?: boolean;
}

const RecenterMap: React.FC<{ center: Location; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center, map, zoom]);
  return null;
};

export const MapComponent: React.FC<MapProps> = ({ users = [], center, restaurants = [], interactive = true }) => {
  // Default to Madrid if no center provided
  const defaultCenter = center || { lat: 40.4168, lng: -3.7038 }; 

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden relative z-0 bg-stone-900">
      <MapContainer 
        center={[defaultCenter.lat, defaultCenter.lng]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {center && <RecenterMap center={center} zoom={restaurants.length > 0 ? 15 : 13} />}

        {/* Users */}
        {users.map(user => (
          user.location && (
            <Marker 
              key={user.id} 
              position={[user.location.lat, user.location.lng]}
              icon={iconPerson}
            >
              <Popup className="text-black font-bold">{user.name}</Popup>
            </Marker>
          )
        ))}

        {/* Centroid */}
        {center && users.length > 0 && (
          <Marker position={[center.lat, center.lng]} icon={iconCenter}>
             <Popup className="text-black font-bold">Punto de Encuentro</Popup>
          </Marker>
        )}

        {/* Restaurants */}
        {restaurants.map((place, idx) => {
            const lat = place.location?.lat || (center?.lat || 0) + (Math.random() * 0.008 - 0.004);
            const lng = place.location?.lng || (center?.lng || 0) + (Math.random() * 0.008 - 0.004);

            return (
                <Marker key={idx} position={[lat, lng]} icon={iconPlace}>
                    <Popup className="text-black">
                        <strong className="block text-sm">{place.name}</strong>
                        <span className="text-xs">{place.address}</span>
                    </Popup>
                </Marker>
            );
        })}
      </MapContainer>
    </div>
  );
};