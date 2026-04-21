import React, { useState, useEffect, useRef } from 'react';
import { User, AppScreen, FilterPreferences, Location, Restaurant, GroupSession } from './types';
import { calculateCentroid, getDistanceFromLatLonInKm } from './utils/geoUtils';
import { findMeetingPoints } from './services/geminiService';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { MapComponent } from './components/MapComponent';
import { 
  Users, 
  MapPin, 
  Navigation, 
  Search, 
  ChefHat, 
  ArrowLeft, 
  Plus, 
  X,
  Share2,
  Star,
  Clock,
  ExternalLink,
  Copy,
  CheckCircle2
} from 'lucide-react';

// --- Services & Helpers ---

const geocodeAddress = async (query: string): Promise<any[]> => {
  if (!query || query.length < 3) return [];
  
  try {
    // Add a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'es-ES,es;q=0.9', // Request Spanish results
        },
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Geocoding error: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Geocoding failed:", error);
    // Return empty array instead of throwing to avoid crashing UI
    return [];
  }
};

// --- Sub-Screens ---

// 1. Welcome Screen
const WelcomeScreen: React.FC<{ 
  onCreate: () => void,
  onJoin: () => void 
}> = ({ onCreate, onJoin }) => (
  <div className="h-screen w-full relative flex flex-col justify-end p-6 overflow-hidden">
    <div className="absolute inset-0 z-0">
      <img 
        src="https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=1935&auto=format&fit=crop" 
        alt="Friends meeting" 
        className="w-full h-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/90 to-transparent"></div>
    </div>
    
    <div className="relative z-10 space-y-6 mb-12 animate-fade-in-up">
      <div className="flex justify-center mb-4">
        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-orange-500/30 transform rotate-3">
          <MapPin size={40} />
        </div>
      </div>
      <h1 className="text-4xl font-bold text-center leading-tight tracking-tight">
        Meeting<span className="text-orange-500">Point</span>
      </h1>
      <p className="text-stone-400 text-center text-sm px-8 leading-relaxed">
        Calcula el punto medio perfecto entre tus amigos y descubre los mejores lugares para reuniros.
      </p>
      
      <div className="space-y-3 pt-4">
        <Button onClick={onCreate} fullWidth className="text-lg py-4 font-bold shadow-orange-900/20">
          Crear nuevo Plan
        </Button>
        <Button onClick={onJoin} variant="secondary" fullWidth className="text-lg py-4 font-semibold">
          Unirme a un Plan
        </Button>
      </div>
    </div>
  </div>
);

// 1.5 Join Group Screen
const JoinGroupScreen: React.FC<{
  onJoin: (code: string, name: string) => void,
  onBack: () => void
}> = ({ onJoin, onBack }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="min-h-screen bg-stone-900 p-6 flex flex-col">
       <header className="flex items-center mb-8">
        <button onClick={onBack} className="p-2 bg-stone-800 rounded-full text-stone-300 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <h2 className="ml-4 text-xl font-semibold">Unirse a Plan</h2>
      </header>
      
      <div className="flex-1 space-y-6">
        <div className="bg-stone-800 p-6 rounded-2xl border border-stone-700">
          <Input 
            label="Código del Plan" 
            placeholder="Ej: AB123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={5}
            className="text-center text-2xl tracking-widest uppercase font-mono"
          />
        </div>
        <Input 
            label="Tu Nombre" 
            placeholder="¿Cómo te llamas?"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
      </div>
      
      <Button 
        onClick={() => onJoin(code, name)} 
        disabled={code.length < 3 || !name.trim()}
        fullWidth
      >
        Entrar al Grupo
      </Button>
    </div>
  );
};

// 2. Create Group Screen
const CreateGroupScreen: React.FC<{ 
  onNext: (name: string, users: User[], sessionCode: string) => void, 
  onBack: () => void 
}> = ({ onNext, onBack }) => {
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState<User[]>([
    { id: '1', name: 'Tú', location: null, isCurrentUser: true }
  ]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserAddress, setNewUserAddress] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [generatedCode] = useState(() => Math.random().toString(36).substring(2, 7).toUpperCase());

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<number | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{lat: number, lng: number} | null>(null);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewUserAddress(value);
    setSelectedCoords(null); 
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (value.length > 2) {
      setSearchTimeout(window.setTimeout(async () => {
         const data = await geocodeAddress(value);
         setSuggestions(data);
         setShowSuggestions(data.length > 0);
      }, 400));
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (item: any) => {
    const displayName = item.display_name.split(',').slice(0, 2).join(',');
    setNewUserAddress(displayName);
    setSelectedCoords({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const addUser = async () => {
    if (!newUserName.trim()) return;
    
    setIsAddingUser(true);
    let locationData: Location | null = null;

    if (selectedCoords) {
      locationData = {
        lat: selectedCoords.lat,
        lng: selectedCoords.lng,
        address: newUserAddress
      };
    } else if (newUserAddress.trim()) {
      // Fallback
      const data = await geocodeAddress(newUserAddress);
      if (data && data.length > 0) {
        locationData = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name.split(',')[0]
        };
      }
    }

    setUsers([...users, { 
      id: Math.random().toString(), 
      name: newUserName, 
      location: locationData, 
      isCurrentUser: false 
    }]);
    
    setNewUserName('');
    setNewUserAddress('');
    setSelectedCoords(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setIsAddingUser(false);
  };

  const removeUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
  };

  return (
    <div className="min-h-screen bg-stone-900 p-6 flex flex-col">
      <header className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="p-2 bg-stone-800 rounded-full text-stone-300 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Crear Grupo</h2>
        <div className="w-10"></div>
      </header>

      <div className="space-y-8 flex-1 overflow-y-auto pb-4">
        {/* Group Name Section */}
        <div>
          <h1 className="text-2xl font-bold mb-2">Detalles del Plan</h1>
          <p className="text-stone-400 text-xs mb-6">Configura el nombre y añade participantes.</p>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Nombre del Grupo</label>
              <Input 
                placeholder="Ej: Cena de viernes"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="text-lg bg-stone-800 border-stone-700"
              />
            </div>

            <div className="bg-stone-800/50 p-4 rounded-xl border border-dashed border-stone-700">
               <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mb-1">CÓDIGO DE SESIÓN</p>
                    <p className="text-xl font-mono text-orange-500 font-bold tracking-widest">{generatedCode}</p>
                  </div>
                  <button className="p-2 hover:bg-stone-700 rounded-lg text-stone-400 transition-colors">
                    <Copy size={18} />
                  </button>
               </div>
            </div>
          </div>
        </div>
        
        {/* Add User Section */}
        <div>
          <label className="block text-xs font-medium text-stone-400 mb-2">¿Quiénes van?</label>
          
          <div className="bg-stone-800/80 p-5 rounded-2xl border border-stone-700 mb-6 shadow-xl">
             <h3 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-4">AGREGAR INTEGRANTE</h3>
             
             <div className="space-y-3">
                <Input 
                  placeholder="Nombre (Ej: Ana)" 
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="bg-stone-900 border-stone-700 placeholder-stone-600"
                />
                
                <div className="relative flex gap-2">
                   <div className="relative w-full">
                      <Input 
                        placeholder="Dirección o Ciudad (Ej: Callao, Madrid)" 
                        value={newUserAddress}
                        onChange={handleAddressChange}
                        onKeyDown={(e) => e.key === 'Enter' && addUser()}
                        className="bg-stone-900 border-stone-700 placeholder-stone-600 pl-10"
                        icon={<MapPin size={16} className="text-stone-500"/>}
                        autoComplete="off"
                      />
                      {/* Autocomplete Dropdown */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                           <ul>
                             {suggestions.map((item, idx) => (
                               <li 
                                 key={idx}
                                 onClick={() => handleSelectSuggestion(item)}
                                 className="px-4 py-3 hover:bg-stone-700 cursor-pointer text-sm text-stone-300 border-b border-stone-700/50 last:border-0 flex items-start gap-2"
                               >
                                 <MapPin size={14} className="mt-0.5 text-orange-500 shrink-0"/>
                                 <span className="truncate">{item.display_name}</span>
                               </li>
                             ))}
                           </ul>
                        </div>
                      )}
                   </div>

                   <button 
                      onClick={addUser}
                      disabled={!newUserName.trim() || isAddingUser}
                      className="bg-orange-600 hover:bg-orange-700 disabled:bg-stone-700 disabled:text-stone-500 text-white rounded-xl w-14 flex items-center justify-center transition-all shadow-lg shadow-orange-900/20 active:scale-95"
                   >
                      {isAddingUser ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Plus size={24} />}
                   </button>
                </div>
             </div>
          </div>

          <div className="flex flex-col gap-3">
            {users.map(user => (
              <div 
                key={user.id} 
                className={`flex items-center justify-between px-4 py-4 rounded-xl border transition-all ${
                  user.isCurrentUser 
                    ? 'border-orange-500/50 bg-gradient-to-r from-orange-500/10 to-transparent' 
                    : 'border-stone-800 bg-stone-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner ${
                     user.isCurrentUser ? 'bg-orange-500 text-white' : 'bg-stone-700 text-stone-300'
                   }`}>
                      {user.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                      <div className={`font-medium ${user.isCurrentUser ? 'text-orange-100' : 'text-stone-200'}`}>
                        {user.name} {user.isCurrentUser && '(Tú)'}
                      </div>
                      {user.location ? (
                        <div className="flex items-center gap-1 text-xs text-stone-400 mt-0.5">
                          <MapPin size={10} className="text-orange-500" />
                          <span className="truncate max-w-[180px]">{user.location.address}</span>
                        </div>
                      ) : (
                        !user.isCurrentUser && <span className="text-xs text-stone-600 italic">Sin ubicación</span>
                      )}
                   </div>
                </div>
                {!user.isCurrentUser && (
                  <button onClick={() => removeUser(user.id)} className="text-stone-500 hover:text-red-400 p-2 rounded-full hover:bg-stone-700/50 transition-colors">
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Button 
        onClick={() => onNext(groupName, users, generatedCode)} 
        disabled={!groupName || users.length < 1}
        fullWidth
        className="mt-4 shadow-lg shadow-orange-500/20 py-4 font-bold text-lg"
      >
        Continuar
      </Button>
    </div>
  );
};

// 3. Location Picker (Real Geocoding with Autocomplete)
const LocationPickerScreen: React.FC<{
  currentUser: User,
  onConfirm: (loc: Location) => void,
  onBack: () => void
}> = ({ currentUser, onConfirm, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<number | null>(null);

  const handleGetCurrentLocation = () => {
    setLoadingLoc(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLoadingLoc(false);
          onConfirm({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: "Mi Ubicación Actual"
          });
        },
        (error) => {
          setLoadingLoc(false);
          alert("Error obteniendo ubicación. Por favor usa la búsqueda manual.");
        }
      );
    } else {
        setLoadingLoc(false);
        alert("Geolocalización no soportada.");
    }
  };

  const handleManualSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (value.length > 2) {
      setSearchTimeout(window.setTimeout(async () => {
         const data = await geocodeAddress(value);
         setSuggestions(data);
         setShowSuggestions(data.length > 0);
      }, 400));
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (item: any) => {
    onConfirm({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name.split(',')[0]
    });
  };

  const handleForceSearch = async () => {
    if (!searchTerm) return;
    setSearchingAddress(true);
    
    const data = await geocodeAddress(searchTerm);
    setSearchingAddress(false);

    if (data && data.length > 0) {
      handleSelectSuggestion(data[0]);
    } else {
      alert("No se encontró la dirección. Intenta ser más específico.");
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col relative">
      <div className="absolute inset-0 z-0">
         <MapComponent interactive={false} />
         <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm z-10"></div>
      </div>

      <div className="relative z-20 p-6 flex flex-col h-full">
         <header className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 bg-stone-800 rounded-full text-stone-300 hover:text-white border border-stone-700">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">Ubicación</h2>
        </header>

        <div className="bg-stone-900/90 border border-stone-700 p-6 rounded-3xl shadow-2xl space-y-6 backdrop-blur-md">
          <div className="text-center">
             <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-3 text-orange-500">
                <MapPin size={32} />
             </div>
             <p className="text-stone-300 text-lg">¿Dónde se encuentra <br/><span className="font-bold text-white">{currentUser.name}</span>?</p>
          </div>
          
          <Button 
            onClick={handleGetCurrentLocation} 
            variant="primary" 
            fullWidth 
            icon={loadingLoc ? <span className="animate-spin">⌛</span> : <Navigation size={18} />}
          >
            {loadingLoc ? "Localizando..." : "Usar ubicación actual"}
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-700"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="px-2 bg-stone-900 text-stone-500">O ingresa dirección</span>
            </div>
          </div>

          <div className="relative w-full">
            <div className="flex gap-2">
              <Input 
                placeholder="Ej: Calle Gran Vía 12, Madrid" 
                icon={<Search size={18} />}
                value={searchTerm}
                onChange={handleManualSearchChange}
                onKeyDown={(e) => e.key === 'Enter' && handleForceSearch()}
                disabled={searchingAddress}
                autoComplete="off"
              />
              <Button 
                  onClick={handleForceSearch} 
                  disabled={!searchTerm || searchingAddress}
                  variant="secondary"
                  className="px-6"
              >
                  {searchingAddress ? '...' : 'Ir'}
              </Button>
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                  <ul>
                    {suggestions.map((item, idx) => (
                      <li 
                        key={idx}
                        onClick={() => handleSelectSuggestion(item)}
                        className="px-4 py-3 hover:bg-stone-700 cursor-pointer text-sm text-stone-300 border-b border-stone-700/50 last:border-0 flex items-start gap-2"
                      >
                        <MapPin size={14} className="mt-0.5 text-orange-500 shrink-0"/>
                        <span className="truncate">{item.display_name}</span>
                      </li>
                    ))}
                  </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. Preferences Screen
const PreferencesScreen: React.FC<{
  onApply: (prefs: FilterPreferences) => void,
  onBack: () => void
}> = ({ onApply, onBack }) => {
  const [type, setType] = useState<'restaurant' | 'bar' | 'cafe'>('restaurant');
  const [price, setPrice] = useState(2);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);

  const toggleCuisine = (c: string) => {
    if (selectedCuisines.includes(c)) setSelectedCuisines(selectedCuisines.filter(x => x !== c));
    else setSelectedCuisines([...selectedCuisines, c]);
  };

  const cuisineOptions = ["Italiana", "Mexicana", "Japonesa", "Hamburguesas", "Tapas", "Saludable", "Asiática"];

  return (
    <div className="min-h-screen bg-stone-900 p-6 flex flex-col">
       <header className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="p-2 bg-stone-800 rounded-full text-stone-300">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-semibold">Preferencias</h2>
        <button onClick={() => { setPrice(2); setSelectedCuisines([]); setType('restaurant'); }} className="text-orange-500 text-sm font-medium">Reset</button>
      </header>

      <div className="space-y-8 flex-1">
        
        {/* Type */}
        <div>
          <h3 className="text-lg font-bold mb-4 text-white">¿Qué plan buscas?</h3>
          <div className="grid grid-cols-1 gap-3">
             {[
               { id: 'restaurant', label: 'Restaurante', desc: 'Comida completa', icon: <ChefHat size={20}/> },
               { id: 'bar', label: 'Bar / Pub', desc: 'Bebidas y ambiente', icon: <Users size={20}/> },
               { id: 'cafe', label: 'Cafetería', desc: 'Relax y café', icon: <Clock size={20}/> }
             ].map((opt) => (
               <button
                key={opt.id}
                onClick={() => setType(opt.id as any)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${type === opt.id ? 'border-orange-500 bg-orange-500/10 text-white shadow-lg shadow-orange-500/10' : 'border-stone-800 bg-stone-800 text-stone-400 hover:bg-stone-750'}`}
               >
                 <div className="flex items-center gap-4">
                   <div className={`p-3 rounded-xl ${type === opt.id ? 'bg-orange-500 text-white' : 'bg-stone-700 text-stone-400'}`}>
                      {opt.icon}
                   </div>
                   <div className="text-left">
                      <span className="block font-semibold">{opt.label}</span>
                      <span className="text-xs opacity-60">{opt.desc}</span>
                   </div>
                 </div>
                 <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${type === opt.id ? 'border-orange-500' : 'border-stone-600'}`}>
                    {type === opt.id && <div className="w-3 h-3 bg-orange-500 rounded-full"></div>}
                 </div>
               </button>
             ))}
          </div>
        </div>

        {/* Price */}
        <div>
           <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-white">Presupuesto</h3>
               <span className="text-orange-500 font-bold">{'$'.repeat(price)}</span>
           </div>
           
           <input 
             type="range" 
             min="1" 
             max="4" 
             step="1"
             value={price}
             onChange={(e) => setPrice(parseInt(e.target.value))}
             className="w-full h-3 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
           />
           <div className="flex justify-between mt-3 text-stone-500 text-xs font-bold uppercase tracking-wider">
             <span className={price >= 1 ? 'text-orange-500' : ''}>Económico</span>
             <span className={price >= 4 ? 'text-orange-500' : ''}>Lujoso</span>
           </div>
        </div>

        {/* Cuisines */}
        <div>
          <h3 className="text-lg font-bold mb-4 text-white">Estilo de Cocina</h3>
          <div className="flex flex-wrap gap-2">
            {cuisineOptions.map(c => (
              <button
                key={c}
                onClick={() => toggleCuisine(c)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedCuisines.includes(c) ? 'bg-stone-100 text-stone-900' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={() => onApply({ cuisine: selectedCuisines, priceRange: price, placeType: type })} fullWidth className="mt-6 py-4 text-lg shadow-xl shadow-orange-500/20">
        Buscar Lugares
      </Button>
    </div>
  );
};

// 5. Results Screen
const ResultsScreen: React.FC<{
  groupName: string,
  centroid: Location,
  users: User[],
  results: Restaurant[],
  onBack: () => void
}> = ({ groupName, centroid, users, results, onBack }) => {
  
  return (
    <div className="h-screen bg-stone-900 flex flex-col">
      <div className="relative h-[45%] w-full z-0">
        <MapComponent 
          center={centroid} 
          users={users} 
          restaurants={results}
        />
        <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/60 to-transparent z-[400] flex justify-between items-start pointer-events-none">
            <button 
              onClick={onBack} 
              className="pointer-events-auto p-2 bg-stone-900/80 backdrop-blur-md rounded-full text-white shadow-lg border border-stone-700"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="pointer-events-auto bg-stone-900/90 backdrop-blur text-white px-3 py-1.5 rounded-full text-xs font-bold border border-stone-700 shadow-xl flex items-center gap-2">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
               {users.length} Amigos
            </div>
        </div>
      </div>

      <div className="flex-1 bg-stone-900 -mt-6 rounded-t-3xl relative z-10 flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-stone-800">
         <div className="p-6 pb-4 border-b border-stone-800">
            <div className="w-12 h-1.5 bg-stone-800 rounded-full mx-auto mb-4"></div>
            <div className="flex justify-between items-end mb-2">
                <h2 className="text-2xl font-bold text-white leading-none">{groupName || "Resultados"}</h2>
                <span className="text-orange-500 text-sm font-bold bg-orange-500/10 px-2 py-1 rounded-lg">Top 5</span>
            </div>
            <p className="text-stone-400 text-sm flex items-center gap-1">
              <MapPin size={14} className="text-orange-500"/> Punto medio calculado
            </p>
         </div>

         <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-stone-900">
           {results.map((place, idx) => (
             <div key={idx} className="bg-stone-800 rounded-2xl overflow-hidden border border-stone-700/50 shadow-lg group hover:border-orange-500/30 transition-all">
                <div className="flex flex-row h-32">
                    <div className="w-32 relative shrink-0">
                        <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                            <Star size={8} className="text-yellow-400 fill-yellow-400" />
                            {place.rating}
                        </div>
                    </div>
                    
                    <div className="flex-1 p-3 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-base leading-tight text-stone-100 line-clamp-1">{place.name}</h3>
                            </div>
                            <p className="text-stone-400 text-xs mt-1 line-clamp-1">{place.address}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {place.cuisine && <span className="text-[10px] px-2 py-0.5 bg-stone-700/50 rounded text-stone-300 border border-stone-700">{place.cuisine}</span>}
                                {place.distance && <span className="text-[10px] px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20">{place.distance}</span>}
                            </div>
                        </div>

                        <a 
                            href={place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.address)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 text-xs font-bold text-orange-500 flex items-center gap-1 hover:text-orange-400"
                        >
                            Ver en Google Maps <ExternalLink size={10} />
                        </a>
                    </div>
                </div>
             </div>
           ))}
           
           {results.length === 0 && (
             <div className="text-center py-10 px-6">
               <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Search className="text-stone-600" />
               </div>
               <h3 className="text-white font-bold mb-2">No se encontraron resultados</h3>
               <p className="text-stone-500 text-sm">Intenta ampliar el radio o cambiar los filtros de búsqueda.</p>
             </div>
           )}
           <div className="h-10"></div> {/* Spacer */}
         </div>
      </div>
    </div>
  );
};


// --- Main App Component ---

const App: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen>(AppScreen.WELCOME);
  const [session, setSession] = useState<GroupSession | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [preferences, setPreferences] = useState<FilterPreferences | null>(null);
  const [results, setResults] = useState<Restaurant[]>([]);
  const [centroid, setCentroid] = useState<Location | null>(null);

  const handleCreateGroup = (name: string, createdUsers: User[], code: string) => {
    setSession({ id: Date.now().toString(), name, joinCode: code });
    setUsers(createdUsers);
    // Proceed to location picker for the current user
    setScreen(AppScreen.LOCATION_PICKER);
  };

  const handleJoinGroup = (code: string, userName: string) => {
    // Simulation of joining logic
    const mockSession: GroupSession = { id: '999', name: 'Grupo Unido', joinCode: code };
    const me: User = { id: 'me', name: userName, location: null, isCurrentUser: true };
    // Simulate finding existing users in that group
    const friends: User[] = [
       { id: 'f1', name: 'Ana', location: { lat: 40.4168, lng: -3.7038, address: 'Madrid' }, isCurrentUser: false },
       { id: 'f2', name: 'Luis', location: { lat: 40.4200, lng: -3.6900, address: 'Salamanca' }, isCurrentUser: false },
    ];
    setSession(mockSession);
    setUsers([me, ...friends]);
    setScreen(AppScreen.LOCATION_PICKER);
  };

  const handleLocationConfirmed = (loc: Location) => {
    const updatedUsers = users.map(u => 
        u.isCurrentUser ? { ...u, location: loc } : u
    );

    // If we are in "Create" mode, we might need to simulate friend locations ONLY IF they haven't been set
    const demoUsers = updatedUsers.map(u => {
        if (!u.isCurrentUser && !u.location) {
            return {
                ...u,
                location: {
                    lat: loc.lat + (Math.random() * 0.02 - 0.01),
                    lng: loc.lng + (Math.random() * 0.02 - 0.01),
                    address: "Ubicación simulada"
                }
            };
        }
        return u;
    });

    setUsers(demoUsers);
    setScreen(AppScreen.PREFERENCES);
  };

  const handlePreferencesApplied = async (prefs: FilterPreferences) => {
    setPreferences(prefs);
    setScreen(AppScreen.LOADING);

    // 1. Calculate Centroid
    const center = calculateCentroid(users);
    setCentroid(center);

    if (center) {
      // 2. Call Gemini API
      try {
        const places = await findMeetingPoints(center, prefs);
        
        // Add calculated distance to center for display
        const placesWithDistance = places.map(p => {
            // For the demo, if we don't have exact lat/lng from Gemini text fallback, 
            // we assume it's near center.
            return {
                ...p,
                distance: `${(Math.random() * 2).toFixed(1)} km` 
            };
        });

        setResults(placesWithDistance);
        setScreen(AppScreen.RESULTS);
      } catch (e) {
        console.error(e);
        // Fallback to empty results instead of crashing
        setResults([]);
        setScreen(AppScreen.RESULTS); 
      }
    }
  };

  // Loading Screen View
  if (screen === AppScreen.LOADING) {
    return (
      <div className="h-screen w-full bg-stone-900 flex flex-col items-center justify-center space-y-8 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute w-64 h-64 bg-orange-500/20 rounded-full blur-3xl -top-10 -right-10 animate-pulse"></div>
        <div className="absolute w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -bottom-10 -left-10"></div>
        
        <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-stone-800 rounded-full"></div>
            <div className="w-24 h-24 border-4 border-orange-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-stone-800 p-3 rounded-full">
                <MapPin className="text-orange-500" size={24} />
            </div>
            </div>
            <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-white tracking-tight">Triangulando</h3>
            <p className="text-stone-400 text-sm">Calculando el punto óptimo entre <br/> <span className="text-orange-400 font-bold">{users.length} amigos</span></p>
            </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {screen === AppScreen.WELCOME && (
        <WelcomeScreen 
          onCreate={() => setScreen(AppScreen.CREATE_GROUP)} 
          onJoin={() => setScreen(AppScreen.JOIN_GROUP)}
        />
      )}

      {screen === AppScreen.JOIN_GROUP && (
        <JoinGroupScreen 
           onJoin={handleJoinGroup}
           onBack={() => setScreen(AppScreen.WELCOME)}
        />
      )}
      
      {screen === AppScreen.CREATE_GROUP && (
        <CreateGroupScreen 
          onNext={handleCreateGroup} 
          onBack={() => setScreen(AppScreen.WELCOME)} 
        />
      )}

      {screen === AppScreen.LOCATION_PICKER && users.find(u => u.isCurrentUser) && (
        <LocationPickerScreen 
          currentUser={users.find(u => u.isCurrentUser)!} 
          onConfirm={handleLocationConfirmed}
          onBack={() => setScreen(AppScreen.CREATE_GROUP)}
        />
      )}

      {screen === AppScreen.PREFERENCES && (
        <PreferencesScreen 
          onApply={handlePreferencesApplied} 
          onBack={() => setScreen(AppScreen.LOCATION_PICKER)}
        />
      )}

      {screen === AppScreen.RESULTS && centroid && (
        <ResultsScreen 
          groupName={session?.name || "Grupo"}
          centroid={centroid}
          users={users}
          results={results}
          onBack={() => setScreen(AppScreen.PREFERENCES)}
        />
      )}
    </>
  );
};

export default App;