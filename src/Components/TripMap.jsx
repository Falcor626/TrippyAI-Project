import { GoogleMap, DirectionsRenderer, useLoadScript } from '@react-google-maps/api';
import { useEffect, useState } from 'react';

const mapStyles = {
  height: '400px',
  width: '100%',
  borderRadius: '8px',
};

const libraries = ['routes'];
const FALLBACK_CENTER = { lat: 34.0522, lng: -118.2437 };

function TripMap({ destination, departureCity }) {
  const [directions, setDirections] = useState(null);
  const [mapCenter, setMapCenter] = useState(FALLBACK_CENTER);
  const [mapMessage, setMapMessage] = useState('');

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
  const hasValidApiKey = Boolean(apiKey && apiKey !== 'YOUR_API_KEY_HERE');

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries,
  });

  useEffect(() => {
    if (!hasValidApiKey || !isLoaded || !window.google || !destination || !departureCity) {
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: departureCity,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result?.routes?.[0]) {
          setDirections(result);
          setMapMessage('');
          const bounds = new window.google.maps.LatLngBounds();
          result.routes[0].overview_path.forEach((point) => bounds.extend(point));
          setMapCenter(bounds.getCenter().toJSON());
        } else {
          setDirections(null);
          setMapMessage('Map route unavailable for this origin and destination pair.');
        }
      }
    );
  }, [destination, departureCity, hasValidApiKey, isLoaded]);

  if (!hasValidApiKey) {
    return (
      <div className="trip-map-container">
        <h3 className="trip-map-title">🗺️ Route Preview</h3>
        <p className="trip-map-subtitle">Add a Google Maps API key to enable the interactive map.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="trip-map-container">
        <h3 className="trip-map-title">🗺️ Route Preview</h3>
        <p className="trip-map-subtitle">Google Maps could not be loaded right now.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="trip-map-container">
        <h3 className="trip-map-title">🗺️ Route Preview</h3>
        <p className="trip-map-subtitle">Loading interactive map...</p>
      </div>
    );
  }

  return (
    <div className="trip-map-container">
      <h3 className="trip-map-title">🗺️ Your Route</h3>
      <p className="trip-map-subtitle">From {departureCity} to {destination}</p>
      {mapMessage && <p className="trip-map-subtitle">{mapMessage}</p>}

      <GoogleMap
        mapContainerStyle={mapStyles}
        center={mapCenter}
        zoom={6}
        options={{
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#f7f4ee' }] },
            { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#38414e' }] },
            { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#212121' }] },
            { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3a2a' }] },
            { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
            { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f2540' }] },
          ],
        }}
      >
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: false,
              polylineOptions: {
                zIndex: 50,
                strokeColor: '#f0b86c',
                strokeWeight: 5,
                strokeOpacity: 0.9,
              },
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}

export default TripMap;
