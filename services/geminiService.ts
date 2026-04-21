import { GoogleGenAI } from "@google/genai";
import { FilterPreferences, Restaurant, Location } from '../types';

export const findMeetingPoints = async (
  centroid: Location,
  filters: FilterPreferences
): Promise<Restaurant[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const priceSymbol = '$'.repeat(filters.priceRange);
    const placeType = filters.placeType === 'restaurant' ? 'restaurantes' : filters.placeType === 'bar' ? 'bares' : 'cafeterías';
    const cuisines = filters.cuisine.length > 0 ? `de cocina ${filters.cuisine.join(', ')}` : '';

    // We ask for a specific format to help parsing if the tool chunks aren't perfect
    const prompt = `
      Actúa como un experto local. Busca 5 excelentes ${placeType} ${cuisines} que estén muy cerca de las coordenadas: ${centroid.lat}, ${centroid.lng}.
      El rango de precio preferido es ${priceSymbol}.
      
      Para cada lugar, proporciona:
      1. Nombre exacto
      2. Dirección corta
      3. Una calificación estimada (0.0 a 5.0)
      4. Tipo de cocina principal

      Usa la herramienta Google Maps para verificar que existen.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: centroid.lat,
              longitude: centroid.lng
            }
          }
        }
      },
    });

    const restaurants: Restaurant[] = [];
    
    // 1. Try to extract from Grounding Metadata (Best source for real Maps data)
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
       for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
          if (chunk.web && chunk.web.uri && chunk.web.title) {
            // Using a deterministic random for the photo based on name length to keep it consistent per render
            const seed = chunk.web.title.length; 
            
            restaurants.push({
              name: chunk.web.title,
              address: "Ver ubicación en mapa", // Grounding sometimes lacks full address string, maps handles it
              rating: 4.0 + (seed % 10) / 10, // Mock rating between 4.0 and 4.9
              googleMapsUri: chunk.web.uri,
              photoUrl: `https://images.unsplash.com/photo-${seed % 2 === 0 ? '1517248135467-4c7edcad34c4' : '1552566626-52f8b828add9'}?q=80&w=800&auto=format&fit=crop` 
            });
          }
       }
    }

    // 2. Fallback: Parse the text if grounding didn't give us a clean list
    if (restaurants.length === 0 && response.text) {
      const lines = response.text.split('\n');
      lines.forEach(line => {
        // Look for numbered lists: "1. Name - Address" or "**Name**"
        if (line.match(/^\d+\./) || line.trim().startsWith('- ')) {
           const parts = line.replace(/^\d+\.|- /, '').trim().split(/[-:|]/);
           const name = parts[0].replace(/\*\*/g, '').trim();
           if (name.length > 2) {
             restaurants.push({
               name: name,
               address: parts[1] ? parts[1].trim() : "Cerca del punto medio",
               rating: 4.5,
               photoUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=800&auto=format&fit=crop"
             });
           }
        }
      });
    }
    
    // Deduplicate based on name
    const uniqueRestaurants = Array.from(new Map(restaurants.map(item => [item.name, item])).values());
    
    return uniqueRestaurants.slice(0, 5);

  } catch (error) {
    console.error("Error fetching places:", error);
    return [];
  }
};