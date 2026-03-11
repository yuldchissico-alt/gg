import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

interface LocationPickerProps {
  value?: LocationData;
  onChange: (location: LocationData) => void;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);

  const searchAddress = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Digite um endereço",
        description: "Informe um endereço para buscar",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        {
          headers: {
            'Accept-Language': 'pt-BR',
          },
        }
      );
      
      if (!response.ok) throw new Error('Falha na busca');
      
      const data: NominatimResult[] = await response.json();
      
      if (data.length === 0) {
        toast({
          title: "Nenhum resultado",
          description: "Não encontramos esse endereço. Tente outro termo.",
          variant: "destructive",
          duration: 2000,
        });
      }
      
      setSearchResults(data);
    } catch (error) {
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar o endereço. Tente novamente.",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, toast]);

  const selectLocation = (result: NominatimResult) => {
    const location: LocationData = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      address: result.display_name,
    };
    onChange(location);
    setSearchResults([]);
    setSearchQuery('');
    
    toast({
      title: "Localização selecionada",
      description: result.display_name.substring(0, 50) + '...',
      duration: 2000,
    });
  };

  const getMapEmbedUrl = (lat: number, lon: number) => {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01}%2C${lat - 0.01}%2C${lon + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lon}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-gray-300">Buscar endereço</Label>
        <div className="flex gap-2 mt-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Digite o endereço..."
            className="flex-1 bg-[#1a1a1a] border-gray-700 text-white"
            onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
            data-testid="input-location-search"
          />
          <Button
            size="icon"
            onClick={searchAddress}
            disabled={isSearching}
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="button-search-location"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-700 rounded-lg p-2 bg-[#1a1a1a]">
          <Label className="text-gray-400 text-xs">Resultados da busca:</Label>
          {searchResults.map((result, index) => (
            <button
              key={index}
              onClick={() => selectLocation(result)}
              className="w-full text-left p-2 rounded hover:bg-purple-600/20 transition-colors flex items-start gap-2"
              data-testid={`location-result-${index}`}
            >
              <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-300 line-clamp-2">
                {result.display_name}
              </span>
            </button>
          ))}
        </div>
      )}

      {value && (
        <div className="space-y-2">
          <Label className="text-gray-300">Localização selecionada</Label>
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden">
            <iframe
              src={getMapEmbedUrl(value.latitude, value.longitude)}
              width="100%"
              height="200"
              style={{ border: 0 }}
              className="rounded-t-lg"
              data-testid="location-map-preview"
            />
            <div className="p-3 border-t border-gray-700">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 line-clamp-2">{value.address}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!value && !searchResults.length && (
        <div className="bg-[#1a1a1a] border border-gray-700 border-dashed rounded-lg p-6 text-center">
          <MapPin className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Busque um endereço para selecionar a localização
          </p>
        </div>
      )}
    </div>
  );
}
