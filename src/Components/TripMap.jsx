import { DirectionsRenderer, GoogleMap, Marker, Polyline, useLoadScript } from '@react-google-maps/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { validateLocation } from '../services/travelApi';

const mapStyles = {
  height: '400px',
  width: '100%',
  borderRadius: '8px',
};

const libraries = ['routes'];
const FALLBACK_CENTER = { lat: 34.0522, lng: -118.2437 };

const simplifyLocation = (value = '') => value.split(',').slice(0, 2).join(',').trim() || value;
const cityLabel = (value = '') => value.split(',')[0]?.trim() || value || 'TBD';

function TripMap({ destination, departureCity }) {
  const mapRef = useRef(null);
  const [directions, setDirections] = useState(null);
  const [fallbackRoute, setFallbackRoute] = useState(null);
  const [mapCenter, setMapCenter] = useState(FALLBACK_CENTER);
  const [mapMessage, setMapMessage] = useState('');
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
  const hasValidApiKey = Boolean(apiKey && apiKey !== 'YOUR_API_KEY_HERE');
  const routeSummary = `${cityLabel(departureCity)} \u2192 ${cityLabel(destination)}`;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries,
  });

  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const handleMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  useEffect(() => {
    if (!hasValidApiKey || !isLoaded || !window.google || !destination || !departureCity) {
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    const geocoder = new window.google.maps.Geocoder();

    const geocodeWithGoogle = async (address) => {
      const result = await geocoder.geocode({ address });
      const location = result.results?.[0]?.geometry?.location;
      return location ? location.toJSON() : null;
    };

    const geocodeWithFallback = async (address) => {
      try {
        return await geocodeWithGoogle(address);
      } catch (error) {
        try {
          return await geocodeWithGoogle(simplifyLocation(address));
        } catch (simplifiedError) {
          const validated = await validateLocation(simplifyLocation(address), { autoSelect: true });
          return validated?.lat != null && validated?.lon != null
            ? { lat: validated.lat, lng: validated.lon }
            : null;
        }
      }
    };

    const buildFallbackRoute = () => {
      Promise.all([geocodeWithFallback(departureCity), geocodeWithFallback(destination)])
        .then(([origin, destinationPoint]) => {
          if (!origin || !destinationPoint) {
            setFallbackRoute(null);
            setMapMessage('Map route unavailable for this origin and destination pair.');
            return;
          }

          const originLatLng = new window.google.maps.LatLng(origin.lat, origin.lng);
          const destinationLatLng = new window.google.maps.LatLng(destinationPoint.lat, destinationPoint.lng);
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(originLatLng);
          bounds.extend(destinationLatLng);

          setDirections(null);
          setFallbackRoute({
            origin,
            destination: destinationPoint,
            bounds: {
              north: bounds.getNorthEast().lat(),
              east: bounds.getNorthEast().lng(),
              south: bounds.getSouthWest().lat(),
              west: bounds.getSouthWest().lng(),
            },
          });
          setMapCenter(bounds.getCenter().toJSON());
          setMapMessage('');
        })
        .catch(() => {
          setFallbackRoute(null);
          setMapMessage('Map route unavailable for this origin and destination pair.');
        });
    };

    directionsService.route(
      {
        origin: departureCity,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result?.routes?.[0]) {
          setDirections(result);
          setFallbackRoute(null);
          setMapMessage('');
          const bounds = new window.google.maps.LatLngBounds();
          result.routes[0].overview_path.forEach((point) => bounds.extend(point));
          setMapCenter(bounds.getCenter().toJSON());
        } else {
          buildFallbackRoute();
        }
      }
    );
  }, [destination, departureCity, hasValidApiKey, isLoaded]);

  useEffect(() => {
    if (!mapRef.current || !window.google) {
      return;
    }

    if (directions?.routes?.[0]) {
      const bounds = new window.google.maps.LatLngBounds();
      directions.routes[0].overview_path.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 48);
      return;
    }

    if (fallbackRoute?.bounds) {
      mapRef.current.fitBounds(fallbackRoute.bounds, 48);
    }
  }, [directions, fallbackRoute]);

  if (!hasValidApiKey) {
    return (
      <div className="trip-map-container">
        <h3 className="trip-map-title">Your Route</h3>
        <p className="trip-map-subtitle">Add a Google Maps API key to enable the interactive map.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="trip-map-container">
        <h3 className="trip-map-title">Your Route</h3>
        <p className="trip-map-subtitle">Google Maps could not be loaded right now.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="trip-map-container">
        <h3 className="trip-map-title">Your Route</h3>
        <p className="trip-map-subtitle">Loading interactive map...</p>
      </div>
    );
  }

  return (
    <div className="trip-map-container trip-map-live">
      <div className="trip-map-overlay">
        <span className="trip-map-pill trip-map-title-pill">Your Route</span>
        <span className="trip-map-pill trip-map-route-pill">{routeSummary}</span>
      </div>
      {mapMessage && <p className="trip-map-message">{mapMessage}</p>}
      <GoogleMap
        mapContainerStyle={mapStyles}
        center={mapCenter}
        zoom={3}
        onLoad={handleMapLoad}
        onUnmount={handleMapUnmount}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#172434' }] },
            { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#8ea0b2' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#172434' }, { weight: 2 }] },
            { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#34465a' }] },
            { featureType: 'administrative.province', stylers: [{ visibility: 'off' }] },
            { featureType: 'landscape', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'road', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f2540' }] },
            { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6e879e' }] },
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
        {!directions && fallbackRoute && (
          <>
            <Marker position={fallbackRoute.origin} label="A" title={departureCity} />
            <Marker position={fallbackRoute.destination} label="B" title={destination} />
            <Polyline
              path={[fallbackRoute.origin, fallbackRoute.destination]}
              options={{
                geodesic: true,
                zIndex: 50,
                strokeColor: '#f0b86c',
                strokeWeight: 4,
                strokeOpacity: 0.9,
              }}
            />
          </>
        )}
      </GoogleMap>
    </div>
  );
}

export default TripMap;
